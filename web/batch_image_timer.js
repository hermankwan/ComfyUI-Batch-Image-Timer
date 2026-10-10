import { app } from "/scripts/app.js";
import { api } from "/scripts/api.js";

window.__BATCH_TIMER__ = window.__BATCH_TIMER__ || {
    isRunning: false,
    isLocked: false,          // 标记是否已完成并锁定最终精确时间
    baseElapsedMs: 0,
    syncClientTime: 0,
    completedCount: 0,
    totalImages: 0,
    intervalId: null,
    progressText: "[ READY ]",
    activeColor: "#FFFFFF",
    // MOD 002: 记录后端最近一次传来的总耗时与重置时的累积偏移量
    lastBackendElapsedMs: 0,  
    resetElapsedOffsetMs: 0   
};

const timerState = window.__BATCH_TIMER__;

const COLOR_PALETTE = [
    "#FFFFFF", // 经典白
    "#00BFFF", // 科技蓝
    "#00FF88", // 荧光绿
    "#FFCC00", // 暖黄
    "#FF007F"  // 霓虹粉
];

const INACTIVE_COLOR_MAP = {
    "#FFFFFF": "#2A2A2A",
    "#00BFFF": "#002B36",
    "#00FF88": "#003311",
    "#FFCC00": "#332600",
    "#FF007F": "#33001A"
};

function startClientTicker() {
    if (!timerState.intervalId) {
        timerState.intervalId = setInterval(() => {
            if (timerState.isRunning) {
                app.graph?.setDirtyCanvas(true, true);
            }
        }, 100);
    }
}

function stopClientTicker() {
    if (timerState.isRunning) {
        if (!timerState.isLocked && timerState.syncClientTime > 0) {
            timerState.baseElapsedMs += (performance.now() - timerState.syncClientTime);
        }
        timerState.syncClientTime = 0;
        timerState.isRunning = false;
    }
    if (timerState.intervalId) {
        clearInterval(timerState.intervalId);
        timerState.intervalId = null;
    }
    app.graph?.setDirtyCanvas(true, true);
}

function formatTime(msTotal) {
    const totalSec = Math.floor(Math.max(0, msTotal) / 1000);
    const p = (n) => String(n).padStart(2, "0");

    const h = p(Math.floor(totalSec / 3600));
    const m = p(Math.floor((totalSec % 3600) / 60));
    const s = p(totalSec % 60);

    return `${h}:${m}:${s}`;
}

const SEGMENT_MAP = {
    '0': [1, 1, 1, 1, 1, 1, 0],
    '1': [0, 1, 1, 0, 0, 0, 0],
    '2': [1, 1, 0, 1, 1, 0, 1],
    '3': [1, 1, 1, 1, 0, 0, 1],
    '4': [0, 1, 1, 0, 0, 1, 1],
    '5': [1, 0, 1, 1, 0, 1, 1],
    '6': [1, 0, 1, 1, 1, 1, 1],
    '7': [1, 1, 1, 0, 0, 0, 0],
    '8': [1, 1, 1, 1, 1, 1, 1],
    '9': [1, 1, 1, 1, 0, 1, 1]
};

function draw7SegmentDigit(ctx, x, y, width, height, digitChar, activeColor, inactiveColor) {
    const segments = SEGMENT_MAP[digitChar] || [0, 0, 0, 0, 0, 0, 0];
    const t = Math.max(2, width * 0.14);
    const gap = width * 0.08;

    const hW = width;
    const hH = height / 2;

    const segs = [
        () => ctx.fillRect(x + t + gap, y, hW - 2 * t - 2 * gap, t),
        () => ctx.fillRect(x + hW - t, y + t + gap, t, hH - t - 2 * gap),
        () => ctx.fillRect(x + hW - t, y + hH + gap, t, hH - t - 2 * gap),
        () => ctx.fillRect(x + t + gap, y + height - t, hW - 2 * t - 2 * gap, t),
        () => ctx.fillRect(x, y + hH + gap, t, hH - t - 2 * gap),
        () => ctx.fillRect(x, y + t + gap, t, hH - t - 2 * gap),
        () => ctx.fillRect(x + t + gap, y + hH - t / 2, hW - 2 * t - 2 * gap, t)
    ];

    for (let i = 0; i < 7; i++) {
        ctx.fillStyle = segments[i] ? activeColor : inactiveColor;
        segs[i]();
    }
}

function drawColon(ctx, x, y, width, height, color) {
    const dotSize = Math.max(3, width * 0.35);
    const centerX = x + width / 2 - dotSize / 2;
    ctx.fillStyle = color;
    ctx.fillRect(centerX, y + height * 0.3 - dotSize / 2, dotSize, dotSize);
    ctx.fillRect(centerX, y + height * 0.7 - dotSize / 2, dotSize, dotSize);
}

function patchTimerNodeUI(node) {
    if (!node || node.comfyClass !== "BatchImageTimer" || node._batchTimerPatched) return;

    node._batchTimerPatched = true;
    node.size = [280, 175];
    node.colorSwatches = [];
    node.lastMousePos = [0, 0];
    node._swatchHovered = false;
    node._digitHovered = false;
    node._digitArea = null;

    // MOD 001: 初始化工作流持久化属性（颜色保存与状态恢复）
    node.properties = node.properties || {};
    if (!node.properties.activeColor) {
        node.properties.activeColor = "#FFFFFF";
    }
    timerState.activeColor = node.properties.activeColor;

    node.onMouseDown = function (e, pos) {
        // 1. 检查是否点击了调色板
        if (this.colorSwatches && this.colorSwatches.length > 0) {
            for (const swatch of this.colorSwatches) {
                if (
                    pos[0] >= swatch.x &&
                    pos[0] <= swatch.x + swatch.w &&
                    pos[1] >= swatch.y &&
                    pos[1] <= swatch.y + swatch.h
                ) {
                    timerState.activeColor = swatch.color;
                    // MOD 001: 将选中的颜色绑定到节点属性，随工作流保存
                    this.properties.activeColor = swatch.color; 
                    app.graph?.setDirtyCanvas(true, true);
                    return true;
                }
            }
        }

        // 2. 检查是否点击了灯管数字区域（纯前端重置，不影响工作流）
        if (this._digitArea &&
            pos[0] >= this._digitArea.x &&
            pos[0] <= this._digitArea.x + this._digitArea.w &&
            pos[1] >= this._digitArea.y &&
            pos[1] <= this._digitArea.y + this._digitArea.h
        ) {
            if (timerState.isRunning) {
                // MOD 002: 运行中点击：记录当前后端对应的时间点作为偏移量，使后续更新减去此偏移实现清零重计
                let currentBackendTime = timerState.lastBackendElapsedMs;
                if (timerState.syncClientTime > 0) {
                    currentBackendTime += (performance.now() - timerState.syncClientTime);
                }
                timerState.resetElapsedOffsetMs = currentBackendTime;
                timerState.baseElapsedMs = 0;
                timerState.syncClientTime = performance.now();
                timerState.isLocked = false;
            } else {
                // MOD 002: 停止状态点击：计时归零，偏移清零，计数器恢复成 [ READY ]
                timerState.resetElapsedOffsetMs = 0;
                timerState.baseElapsedMs = 0;
                timerState.lastBackendElapsedMs = 0;
                timerState.syncClientTime = 0;
                timerState.isLocked = false;
                timerState.progressText = "[ READY ]";
            }
            app.graph?.setDirtyCanvas(true, true);
            return true;
        }
    };

    node.onMouseMove = function (e, pos) {
        this.lastMousePos = pos;
        app.graph?.setDirtyCanvas(true, false);
    };

    node.onMouseLeave = function (e) {
        const canvasEl = app.canvas?.canvas;
        if (canvasEl) {
            if (this._swatchHovered || this._digitHovered) {
                canvasEl.style.cursor = app.canvas?.default_connection_cursor || "crosshair";
                this._swatchHovered = false;
                this._digitHovered = false;
            }
        }
    };

    node.onDrawBackground = function (ctx) {
        const nodeW = this.size[0];
        const nodeH = this.size[1];

        let headerOffset = 30;
        if (this.widgets && this.widgets.length > 0) {
            let maxY = 0;
            for (const w of this.widgets) {
                if (w.last_y !== undefined) {
                    const h = w.computeSize ? w.computeSize()[1] : 20;
                    const bottom = w.last_y + h;
                    if (bottom > maxY) maxY = bottom;
                }
            }
            headerOffset = maxY > 0 ? maxY + 15 : 65;
        }

        const margin = 10;
        const topOffset = headerOffset;
        const rectW = nodeW - margin * 2;
        const rectH = Math.max(80, nodeH - topOffset - margin);

        ctx.save();

        // 黑色底框
        ctx.fillStyle = "#000000";
        ctx.fillRect(margin, topOffset, rectW, rectH);
        ctx.strokeStyle = "#222222";
        ctx.lineWidth = 1;
        ctx.strokeRect(margin, topOffset, rectW, rectH);

        const scaleW = rectW / 240;
        const scaleH = rectH / 90;
        const scale = Math.max(0.5, Math.min(scaleW, scaleH));

        const centerY = topOffset + rectH * 0.42;

        let currentElapsed = timerState.baseElapsedMs;
        if (timerState.isRunning && !timerState.isLocked && timerState.syncClientTime > 0) {
            currentElapsed += (performance.now() - timerState.syncClientTime);
        }

        const timeStr = formatTime(currentElapsed);

        const digitWidth = 14 * scale;
        const digitHeight = 26 * scale;
        const digitGap = 5 * scale;
        const colonWidth = 8 * scale;

        const totalDisplayWidth = (6 * digitWidth) + (4 * digitGap) + (2 * colonWidth) + (2 * digitGap);
        let startX = (nodeW - totalDisplayWidth) / 2;
        const digitStartY = centerY - (digitHeight / 2);

        // MOD 002: 记录灯管数字区域，用于光标小手悬停检测与点击响应
        this._digitArea = {
            x: startX - 4,
            y: digitStartY - 4,
            w: totalDisplayWidth + 8,
            h: digitHeight + 8
        };

        // 标题
        const titleFontSize = Math.max(9, Math.round(10 * scale));
        ctx.fillStyle = "#666666";
        ctx.font = `bold ${titleFontSize}px monospace`;
        ctx.textAlign = "center";
        ctx.fillText("TOTAL ELAPSED", nodeW / 2, digitStartY - 8 * scale);

        // 7 段数码管数字
        // MOD 001: 确保渲染时优先同步节点内保存的属性颜色
        if (this.properties && this.properties.activeColor) {
            timerState.activeColor = this.properties.activeColor;
        }
        const activeColor = timerState.activeColor || "#FFFFFF";
        const inactiveColor = INACTIVE_COLOR_MAP[activeColor] || "#1A1A1A";

        for (let i = 0; i < timeStr.length; i++) {
            const char = timeStr[i];
            if (char === ':') {
                drawColon(ctx, startX, digitStartY, colonWidth, digitHeight, activeColor);
                startX += colonWidth + digitGap;
            } else {
                draw7SegmentDigit(ctx, startX, digitStartY, digitWidth, digitHeight, char, activeColor, inactiveColor);
                startX += digitWidth + digitGap;
            }
        }

        // 调色板小方块
        const swatchSize = Math.max(5, Math.round(6 * scale));
        const swatchGap = 6 * scale;
        const totalSwatchesW = COLOR_PALETTE.length * swatchSize + (COLOR_PALETTE.length - 1) * swatchGap;
        let swatchStartX = (nodeW - totalSwatchesW) / 2;
        const swatchY = digitStartY + digitHeight + 6 * scale;

        this.colorSwatches = [];

        COLOR_PALETTE.forEach((color) => {
            ctx.fillStyle = color;
            ctx.fillRect(swatchStartX, swatchY, swatchSize, swatchSize);

            if (color === activeColor) {
                ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
                ctx.lineWidth = 1;
                ctx.strokeRect(swatchStartX - 1.5, swatchY - 1.5, swatchSize + 3, swatchSize + 3);
            }

            this.colorSwatches.push({
                x: swatchStartX - 3,
                y: swatchY - 3,
                w: swatchSize + 6,
                h: swatchSize + 6,
                color: color
            });

            swatchStartX += swatchSize + swatchGap;
        });

        // 进度文本 [ X / Y ]
        const statusFontSize = Math.max(10, Math.round(11 * scale));
        ctx.fillStyle = timerState.isRunning ? "#00BFFF" : "#5A8B9B";
        ctx.font = `bold ${statusFontSize}px monospace`;
        ctx.textAlign = "center";
        ctx.fillText(timerState.progressText, nodeW / 2, swatchY + swatchSize + 14 * scale);

        ctx.restore();

        // MOD 002: 光标与悬停状态精细控制（仅在调色板或数字区域显示小手）
        const canvasEl = app.canvas?.canvas;
        if (canvasEl && this.lastMousePos) {
            const [mx, my] = this.lastMousePos;
            let isHoveringSwatch = false;
            let isHoveringDigit = false;

            for (const swatch of this.colorSwatches) {
                if (mx >= swatch.x && mx <= swatch.x + swatch.w && my >= swatch.y && my <= swatch.y + swatch.h) {
                    isHoveringSwatch = true;
                    break;
                }
            }

            if (this._digitArea &&
                mx >= this._digitArea.x && mx <= this._digitArea.x + this._digitArea.w &&
                my >= this._digitArea.y && my <= this._digitArea.y + this._digitArea.h
            ) {
                isHoveringDigit = true;
            }

            const currentCursor = canvasEl.style.cursor;
            if (!currentCursor.includes("resize")) {
                if (isHoveringSwatch || isHoveringDigit) {
                    canvasEl.style.cursor = "pointer";
                    this._swatchHovered = isHoveringSwatch;
                    this._digitHovered = isHoveringDigit;
                } else if (this._swatchHovered || this._digitHovered) {
                    canvasEl.style.cursor = app.canvas?.default_connection_cursor || "crosshair";
                    this._swatchHovered = false;
                    this._digitHovered = false;
                }
            }
        }
    };

    app.graph?.setDirtyCanvas(true, true);
}

app.registerExtension({
    name: "BatchImageTimer.UI",
    async setup() {
        const origQueuePrompt = app.queuePrompt?.bind(app);
        if (origQueuePrompt) {
            app.queuePrompt = async function (...args) {
                try {
                    const isAlreadyRunning = timerState.isRunning;
                    await fetch("/batch_timer/reset", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ force: !isAlreadyRunning })
                    });

                    if (!isAlreadyRunning) {
                        timerState.isRunning = true;
                        timerState.isLocked = false;
                        timerState.baseElapsedMs = 0;
                        // MOD 002: 新运行开始，重置偏移量与后端记录
                        timerState.resetElapsedOffsetMs = 0; 
                        timerState.lastBackendElapsedMs = 0;
                        timerState.syncClientTime = performance.now();
                        timerState.progressText = "[ STARTING... ]";
                    }
                    startClientTicker();
                } catch (e) {
                    console.error("Timer reset fetch failed", e);
                }
                return origQueuePrompt(...args);
            };
        }

        api.addEventListener("batch_timer_update", (event) => {
            const { current, total, elapsed_sec } = event.detail || {};

            timerState.completedCount = current;
            timerState.totalImages = total;
            timerState.progressText = `[ ${current} / ${total} ]`;

            // MOD 002: 记录后端最近一次传来的总耗时
            timerState.lastBackendElapsedMs = elapsed_sec * 1000;
            // MOD 002: 用后端总耗时减去用户点击重置时产生的偏移量，实现局部独立清零重计
            timerState.baseElapsedMs = Math.max(0, timerState.lastBackendElapsedMs - timerState.resetElapsedOffsetMs);
            timerState.syncClientTime = performance.now();
            timerState.isRunning = true;
            timerState.isLocked = false;
            startClientTicker();

            app.graph?.setDirtyCanvas(true, true);
        });

        api.addEventListener("executing", (event) => {
            const node = event.detail;
            if (!node) {
                if (timerState.completedCount >= timerState.totalImages && timerState.totalImages > 0) {
                    stopClientTicker();
                    timerState.progressText = `[ ${timerState.completedCount} / ${timerState.totalImages} ]`;
                }
            }
        });

        api.addEventListener("status", (event) => {
            const queueRemaining = event.detail?.status?.exec_info?.queue_remaining;
            if (queueRemaining === 0 && timerState.completedCount >= timerState.totalImages && timerState.totalImages > 0) {
                stopClientTicker();
            }
        });

        api.addEventListener("execution_error", () => {
            timerState.isLocked = false;
            stopClientTicker();
            timerState.progressText = "[ ERROR ]";
            app.graph?.setDirtyCanvas(true, true);
        });

        api.addEventListener("execution_interrupted", () => {
            timerState.isLocked = false;
            stopClientTicker();
            timerState.progressText = "[ CANCEL ]";
            app.graph?.setDirtyCanvas(true, true);
        });
    },

    async nodeCreated(node) {
        patchTimerNodeUI(node);
    },

    async loadedGraphNode(node) {
        patchTimerNodeUI(node);
    },

    async afterConfigureGraph() {
        if (app.graph && app.graph._nodes) {
            for (const node of app.graph._nodes) {
                if (node.comfyClass === "BatchImageTimer") {
                    patchTimerNodeUI(node);
                }
            }
        }
    }
});