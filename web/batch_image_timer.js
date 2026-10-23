import { app } from "/scripts/app.js";
import { api } from "/scripts/api.js";
import { TimerEngine } from "./timer_engine.js";
import { ProgressEngine } from "./progress_engine.js";
import { renderTimerUI } from "./ui_renderer.js";

const timer = new TimerEngine();
const progress = new ProgressEngine();
let activeNodeId = null;
let isMacroRunning = false;
let lastCompletionTime = 0;
let queueEmptyTimeout = null;

setInterval(() => {
    if (timer.isRunning && !timer.isPaused) {
        app.graph?.setDirtyCanvas(true, true);
    }
}, 100);

app.registerExtension({
    name: "BatchImageTimer.Final",

    async setup() {
        api.addEventListener("batch_timer_update", (event) => {
            const d = event.detail || {};
            if (d.node_id) activeNodeId = String(d.node_id);

            if (queueEmptyTimeout) {
                clearTimeout(queueEmptyTimeout);
                queueEmptyTimeout = null;
            }

            const now = Date.now();
            if (!isMacroRunning && (now - lastCompletionTime < 200)) {
                return; 
            }

            if (!isMacroRunning) {
                isMacroRunning = true;
                timer.start();
                progress.start(d.total || 1);
            }
            
            progress.update(d);
            app.graph?.setDirtyCanvas(true, true);
        });

        api.addEventListener("execution_success", () => {
            if (isMacroRunning && progress.current >= progress.total) {
                isMacroRunning = false;
                lastCompletionTime = Date.now();
                timer.stop();
                progress.markCompleted();
                app.graph?.setDirtyCanvas(true, true);
            }
        });

        api.addEventListener("status", (event) => {
            const queueRemaining = event.detail?.status?.exec_info?.queue_remaining;
            if (queueRemaining === 0 && isMacroRunning) {
                if (queueEmptyTimeout) clearTimeout(queueEmptyTimeout);
                queueEmptyTimeout = setTimeout(() => {
                    if (isMacroRunning) {
                        isMacroRunning = false;
                        lastCompletionTime = Date.now();
                        timer.stop();
                        if (progress.current < progress.total) {
                            progress.status = "INTERRUPT";
                        } else {
                            progress.markCompleted();
                        }
                        fetch("/batch_timer/reset", { method: "POST" }).catch(() => {});
                        app.graph?.setDirtyCanvas(true, true);
                    }
                    queueEmptyTimeout = null;
                }, 1000);
            }
        });

        api.addEventListener("execution_error", () => {
            if (isMacroRunning) {
                setTimeout(() => {
                    if (isMacroRunning) {
                        isMacroRunning = false;
                        progress.status = "ERROR";
                        timer.stop();
                        fetch("/batch_timer/reset", { method: "POST" }).catch(() => {});
                        app.graph?.setDirtyCanvas(true, true);
                    }
                }, 500);
            }
        });

        api.addEventListener("execution_interrupted", () => {
            if (isMacroRunning) {
                setTimeout(() => {
                    if (isMacroRunning) {
                        isMacroRunning = false;
                        progress.status = "INTERRUPT";
                        timer.stop();
                        fetch("/batch_timer/reset", { method: "POST" }).catch(() => {});
                        app.graph?.setDirtyCanvas(true, true);
                    }
                }, 500);
            }
        });
    },

    async nodeCreated(node) {
        if (node.comfyClass !== "BatchImageTimer") return;

        node.properties = node.properties || {};
        node.properties.activeColor = node.properties.activeColor || "#FFFFFF";
        node._lastDigitClick = 0;

        if (!node._hasInitialSized) {
            node._hasInitialSized = true;
            requestAnimationFrame(() => {
                if (!node.widgets || node.widgets.length === 0) return;
                
                const w = node.widgets[0];
                const widgetBottom = (w.last_y !== undefined) ? w.last_y + (w.computeSize ? w.computeSize()[1] : 24) : 60;
                const minHeight = widgetBottom + 15 + 115; 
                
                if (!node.size || node.size[1] < minHeight) {
                    node.size = [Math.max(node.size ? node.size[0] : 280, 280), minHeight];
                    app.graph?.setDirtyCanvas(true, true);
                }
            });
        }

        node.onDrawBackground = function (ctx) {
            const isThisNodeActive = (activeNodeId === String(this.id));
            
            let timerMs = timer.getElapsedMs();
            let displayText = progress.getDisplayText();
            let isCompleted = progress.isCompleted;

            if (!isThisNodeActive) {
                if (!timer.isRunning && progress.isCompleted) {
                    if (activeNodeId !== String(this.id)) {
                        timerMs = 0;
                        displayText = "READY";
                        isCompleted = false;
                    }
                } else {
                    timerMs = 0;
                    displayText = "READY";
                    isCompleted = false;
                }
            }

            const activeColor = this.properties.activeColor;
            renderTimerUI(ctx, this, timerMs, displayText, activeColor, isCompleted);
        };

        node.onMouseDown = function (e, pos) {
            const isThisNodeActive = (activeNodeId === String(this.id)) || !timer.isRunning;

            if (this._hitSwatches) {
                for (const s of this._hitSwatches) {
                    if (pos[0] >= s.x && pos[0] <= s.x + s.w && pos[1] >= s.y && pos[1] <= s.y + s.h) {
                        this.properties.activeColor = s.color;
                        app.graph.setDirtyCanvas(true, true);
                        return true;
                    }
                }
            }

            if (!isThisNodeActive) return false;

            const d = this._hitDigit;
            if (d && pos[0] >= d.x && pos[0] <= d.x + d.w && pos[1] >= d.y && pos[1] <= d.y + d.h) {
                const now = Date.now();
                if (now - this._lastDigitClick < 300) {
                    this._lastDigitClick = 0;
                    const keepRunning = timer.isRunning;
                    timer.reset(keepRunning);
                    if (!keepRunning) {
                        progress.resetAll();
                        activeNodeId = null;
                    }
                } else {
                    this._lastDigitClick = now;
                    if (timer.isRunning) {
                        timer.isPaused ? timer.resume() : timer.pause();
                    }
                }
                app.graph.setDirtyCanvas(true, true);
                return true;
            }
        };

        node.onMouseMove = function (e, pos) {
            const canvasEl = app.canvas?.canvas;
            if (!canvasEl) return;
            
            const currentCursor = canvasEl.style.cursor || "";
            if (currentCursor.includes("resize")) return;

            let cursor = "crosshair";
            if (this._hitSwatches?.some(s => pos[0] >= s.x && pos[0] <= s.x + s.w && pos[1] >= s.y && pos[1] <= s.y + s.h)) {
                cursor = "default";
            } else if (this._hitDigit && pos[0] >= this._hitDigit.x && pos[0] <= this._hitDigit.x + this._hitDigit.w && pos[1] >= this._hitDigit.y && pos[1] <= this._hitDigit.y + this._hitDigit.h) {
                cursor = "pointer";
            }
            
            if (canvasEl.style.cursor !== cursor) {
                canvasEl.style.cursor = cursor;
            }
        };

        node.onMouseLeave = function () {
            const canvasEl = app.canvas?.canvas;
            if (canvasEl) canvasEl.style.cursor = "crosshair";
        };
    },

    async loadedGraphNode(node) {
        this.nodeCreated(node);
    }
});