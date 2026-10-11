import { app } from "/scripts/app.js";
import { api } from "/scripts/api.js";

window.__BATCH_TIMER__ = window.__BATCH_TIMER__ || {
    isRunning: false,
    isLocked: false,
    baseElapsedMs: 0,
    syncClientTime: 0,
    completedCount: 0,
    totalImages: 0,
    intervalId: null,
    progressText: "READY",
    activeColor: "#FFFFFF",
    isTerminated: false,
    isPaused: false
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
            if (timerState.isRunning && !timerState.isPaused) {
                app.graph?.setDirtyCanvas(true, true);
            }
        }, 100);
    }
}

function stopClientTicker() {
    if (timerState.isRunning) {
        if (!timerState.isLocked && timerState.syncClientTime > 0 && !timerState.isPaused) {
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
    node._counterHovered = false;
    node._digitArea = null;
    node._counterArea = null;

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
                    this.properties.activeColor = swatch.color; 
                    app.graph?.setDirtyCanvas(true, true);
                    return true;
                }
            }
        }

        // 2. 检查是否点击了计数器区域（实现 暂停 / 恢复 切换功能）
        if (this._counterArea &&
            pos[0] >= this._counterArea.x &&
            pos[0] <= this._counterArea.x + this._counterArea.w &&
            pos[1] >= this._counterArea.y &&
            pos[1] <= this._counterArea.y + this._counterArea.h
        ) {
            if (timerState.isRunning && !timerState.isTerminated) {
                if (!timerState.isPaused) {
                    if (!timerState.isLocked && timerState.syncClientTime > 0) {
                        timerState.baseElapsedMs += (performance.now() - timerState.syncClientTime);
                    }
                    timerState.syncClientTime = 0;
                    timerState.isPaused = true;
                } else {
                    timerState.syncClientTime = performance.now();
                    timerState.isPaused = false;
                }
                app.graph?.setDirtyCanvas(true, true);
                return true;
            }
        }

        // 3. 检查是否点击了灯管数字区域（重置计时）
        if (this._digitArea &&
            pos[0] >= this._digitArea.x &&
            pos[0] <= this._digitArea.x + this._digitArea.w &&
            pos[1] >= this._digitArea.y &&
            pos[1] <= this._digitArea.y + this._digitArea.h
        ) {
            fetch("/batch_timer/reset", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ force: false })
            }).catch(err => console.error("Timer reset fetch failed", err));

            timerState.baseElapsedMs = 0;
            timerState.syncClientTime = performance.now();
            timerState.isLocked = false;
            timerState.isPaused = false;
            if (!timerState.isRunning) {
                timerState.isTerminated = false;
                timerState.completedCount = 0;
                timerState.totalImages = 0;
                timerState.progressText = "READY";
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
            if (this._swatchHovered || this._digitHovered || this._counterHovered) {
                canvasEl.style.cursor = app.canvas?.default_connection_cursor || "crosshair";
                this._swatchHovered = false;
                this._digitHovered = false;
                this._counterHovered = false;
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
        if (timerState.isRunning && !timerState.isLocked && !timerState.isPaused && timerState.syncClientTime > 0) {
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

        // 7 段数码管数字绘制
        if (this.properties && this.properties.activeColor) {
            timerState.activeColor = this.properties.activeColor;
        }
        const activeColor = timerState.activeColor || "#FFFFFF";
        const inactiveColor = INACTIVE_COLOR_MAP[activeColor] || "#2A2A2A";

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

        // 调色板小方块绘制
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

        // ==========================================
        // UI 精修: 方括号独立固定 + 统一字号规范 + 悬停显示 PAUSE/RESUME
        // ==========================================
        const statusFontSize = Math.max(10, Math.round(11 * scale));
        const statusY = swatchY + swatchSize + 14 * scale;

        const isHovering = timerState.isRunning && this._counterHovered && !timerState.isTerminated;
        let rawText;
        if (isHovering) {
            rawText = timerState.isPaused ? "RESUME" : "PAUSE";
        } else {
            rawText = timerState.isTerminated ? timerState.progressText : (timerState.totalImages > 0 ? `${timerState.completedCount} / ${timerState.totalImages}` : timerState.progressText);
        }
        const innerText = rawText.replace(/^\[\s*\vert{}\s*\]$/g, '');

        const bracketColor = "#666666";
        const halfContainerWidth = 32; 
        const leftBracketX = (nodeW / 2) - halfContainerWidth;
        const rightBracketX = (nodeW / 2) + halfContainerWidth;

        // 渲染左方括号
        ctx.font = `bold ${statusFontSize}px monospace`;
        ctx.fillStyle = bracketColor;
        ctx.textAlign = "left";
        ctx.fillText("[", leftBracketX, statusY);

        // 渲染右方括号
        ctx.textAlign = "right";
        ctx.fillText("]", rightBracketX, statusY);

        // 渲染中间文本：使用统一字号规范。悬停时赋提示色，平时 x/y 始终保持标准亮蓝色
        ctx.font = `bold ${statusFontSize}px monospace`;
        if (isHovering) {
            ctx.fillStyle = timerState.isPaused ? "#00FF88" : "#FFB300"; 
        } else {
            ctx.fillStyle = timerState.isRunning ? "#00BFFF" : "#5A8B9B"; 
        }
        ctx.textAlign = "center";
        ctx.fillText(innerText, nodeW / 2, statusY);

        this._counterArea = {
            x: leftBracketX - 4,
            y: statusY - statusFontSize,
            w: (halfContainerWidth * 2) + 8,
            h: statusFontSize + 6
        };

        ctx.restore();

        const canvasEl = app.canvas?.canvas;
        if (canvasEl && this.lastMousePos && this.colorSwatches.length > 0) {
            const [mx, my] = this.lastMousePos;
            let isHoveringSwatch = false;
            let isHoveringDigit = false;
            let isHoveringCounter = false;

            for (const swatch of this.colorSwatches) {
                if (mx >= swatch.x && mx <= swatch.x + swatch.w && my >= swatch.y && my <= swatch.y + swatch.h) {
                    isHoveringSwatch = true;
                    break;
                }
            }

            if (this._digitArea && mx >= this._digitArea.x && mx <= this._digitArea.x + this._digitArea.w && my >= this._digitArea.y && my <= this._digitArea.y + this._digitArea.h) {
                isHoveringDigit = true;
            }

            if (this._counterArea && mx >= this._counterArea.x && mx <= this._counterArea.x + this._counterArea.w && my >= this._counterArea.y && my <= this._counterArea.y + this._counterArea.h) {
                isHoveringCounter = true;
            }

            const currentCursor = canvasEl.style.cursor;
            if (!currentCursor.includes("resize")) {
                if (isHoveringSwatch) {
                    canvasEl.style.cursor = "default"; 
                    this._swatchHovered = true;
                    this._digitHovered = false;
                    this._counterHovered = false;
                } else if (isHoveringDigit) {
                    canvasEl.style.cursor = "pointer"; 
                    this._swatchHovered = false;
                    this._digitHovered = true;
                    this._counterHovered = false;
                } else if (timerState.isRunning && isHoveringCounter && !timerState.isTerminated) {
                    canvasEl.style.cursor = "pointer"; 
                    this._swatchHovered = false;
                    this._digitHovered = false;
                    this._counterHovered = true;
                } else if (this._swatchHovered || this._digitHovered || this._counterHovered) {
                    canvasEl.style.cursor = app.canvas?.default_connection_cursor || "crosshair"; 
                    this._swatchHovered = false;
                    this._digitHovered = false;
                    this._counterHovered = false;
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
                        timerState.isTerminated = false; 
                        timerState.isPaused = false; 
                        timerState.baseElapsedMs = 0;
                        timerState.completedCount = 0;
                        timerState.syncClientTime = performance.now();
                        timerState.progressText = "READY";
                    }
                    startClientTicker();
                } catch (e) {
                    console.error("Timer reset fetch failed", e);
                }
                return origQueuePrompt(...args);
            };
        }

        api.addEventListener("batch_timer_update", (event) => {
            if (timerState.isTerminated) return;

            const { current, total } = event.detail || {};

            // 仅更新图片计数（x / y），时间交由前端独立自增，彻底隔绝后端绝对时间的干扰
            timerState.completedCount = current;
            timerState.totalImages = total;
            timerState.progressText = `${current} / ${total}`;

            if (!timerState.isPaused) {
                timerState.isRunning = true;
                timerState.isLocked = false;
                startClientTicker();
            }

            app.graph?.setDirtyCanvas(true, true);
        });

        api.addEventListener("executing", (event) => {
            const node = event.detail;
            if (!node && !timerState.isTerminated) {
                if (timerState.completedCount >= timerState.totalImages && timerState.totalImages > 0) {
                    stopClientTicker();
                }
            }
        });

        api.addEventListener("status", (event) => {
            const queueRemaining = event.detail?.status?.exec_info?.queue_remaining;
            if (queueRemaining === 0 && timerState.completedCount >= timerState.totalImages && timerState.totalImages > 0 && !timerState.isTerminated) {
                stopClientTicker();
            }
        });

        api.addEventListener("execution_error", () => {
            timerState.isLocked = false;
            stopClientTicker();
            timerState.progressText = "ERROR";
            timerState.isTerminated = true; 
            app.graph?.setDirtyCanvas(true, true);
        });

        api.addEventListener("execution_interrupted", () => {
            timerState.isLocked = false;
            stopClientTicker();
            timerState.progressText = "CANCEL";
            timerState.isTerminated = true; 
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