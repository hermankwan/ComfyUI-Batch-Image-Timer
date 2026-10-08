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
    activeColor: "#FFFFFF"
};

const timerState = window.__BATCH_TIMER__;

const COLOR_PALETTE = [
    "#FFFFFF", // 经典白
    "#00BFFF", // 科技蓝
    "#00FF88", // 荧光绿
    "#FFCC00", // 暖黄
    "#FF007F"  // 霓虹粉
];

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

    node.onMouseDown = function (e, pos) {
        if (this.colorSwatches && this.colorSwatches.length > 0) {
            for (const swatch of this.colorSwatches) {
                if (
                    pos[0] >= swatch.x &&
                    pos[0] <= swatch.x + swatch.w &&
                    pos[1] >= swatch.y &&
                    pos[1] <= swatch.y + swatch.h
                ) {
                    timerState.activeColor = swatch.color;
                    app.graph?.setDirtyCanvas(true, true);
                    return true;
                }
            }
        }
    };

    node.onMouseMove = function (e, pos) {
        this.lastMousePos = pos;
        app.graph?.setDirtyCanvas(true, false);
    };

    node.onMouseLeave = function (e) {
        const canvasEl = app.canvas?.canvas;
        if (canvasEl && this._swatchHovered) {
            canvasEl.style.cursor = app.canvas?.default_connection_cursor || "crosshair";
            this._swatchHovered = false;
        }
    };

    node.onDrawBackground = function (ctx) {
        const nodeW = this.size[0];
        const nodeH = this.size[1];

        // 健壮地计算所有 widgets 的真实占用底部位置
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

        // 标题
        const titleFontSize = Math.max(9, Math.round(10 * scale));
        ctx.fillStyle = "#666666";
        ctx.font = `bold ${titleFontSize}px monospace`;
        ctx.textAlign = "center";
        ctx.fillText("TOTAL ELAPSED", nodeW / 2, digitStartY - 8 * scale);

        // 7 段数码管数字
        const activeColor = timerState.activeColor || "#FFFFFF";
        const inactiveColor = "#1A1A1A";

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

        // 光标控制
        const canvasEl = app.canvas?.canvas;
        if (canvasEl && this.lastMousePos && this.colorSwatches.length > 0) {
            const [mx, my] = this.lastMousePos;
            let isHoveringSwatch = false;

            for (const swatch of this.colorSwatches) {
                if (
                    mx >= swatch.x &&
                    mx <= swatch.x + swatch.w &&
                    my >= swatch.y &&
                    my <= swatch.y + swatch.h
                ) {
                    isHoveringSwatch = true;
                    break;
                }
            }

            const currentCursor = canvasEl.style.cursor;
            if (!currentCursor.includes("resize")) {
                if (isHoveringSwatch) {
                    canvasEl.style.cursor = "pointer";
                    this._swatchHovered = true;
                } else if (this._swatchHovered) {
                    canvasEl.style.cursor = app.canvas?.default_connection_cursor || "crosshair";
                    this._swatchHovered = false;
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

            // 更新来自服务端的基准时间并保持计时运行
            timerState.baseElapsedMs = elapsed_sec * 1000;
            timerState.syncClientTime = performance.now();
            timerState.isRunning = true;
            timerState.isLocked = false;
            startClientTicker();

            app.graph?.setDirtyCanvas(true, true);
        });

        api.addEventListener("executing", (event) => {
            const node = event.detail;
            // 当 node 为 null 或 undefined 时，表示整个队列的工作流（包括最后一张图）完全执行完毕
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