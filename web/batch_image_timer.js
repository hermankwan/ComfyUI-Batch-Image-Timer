/**
 * ComfyUI-Batch-Image-Timer
 * A specialized 7-segment LED timer for tracking the total execution time of batch image processing workflows.
 * 
 * @version 0.2.3
 * @copyright Copyright (c) 2026 Herman Kwan
 * @license MIT
 */

import { app } from "/scripts/app.js";
import { api } from "/scripts/api.js";
import { TimerEngine } from "./timer_engine.js";
import { ProgressEngine } from "./progress_engine.js";
import { renderTimerUI } from "./ui_renderer.js";

const timer = new TimerEngine();
const progress = new ProgressEngine();

// Track the graph and node that initiated the current execution
let activeGraph = null;
let activeNodeId = null;

let isMacroRunning = false;
let lastCompletionTime = 0;
let queueEmptyTimeout = null;
let lastHeartbeatTime = Date.now();

const DEADLOCK_TIMEOUT_MS = 10 * 60 * 1000;

setInterval(() => {
    if ((timer.compute.isRunning && !timer.compute.isPaused) || timer.total.isRunning) {
        app.graph?.setDirtyCanvas(true, true);
    }

    if (isMacroRunning) {
        const silence = Date.now() - lastHeartbeatTime;
        if (silence > DEADLOCK_TIMEOUT_MS) {
            lastHeartbeatTime = Date.now();
            fetch("/prompt")
                .then(res => res.json())
                .then(data => {
                    if (data?.exec_info?.executing == null) {
                        isMacroRunning = false;
                        lastCompletionTime = Date.now();
                        timer.compute.stop();
                        timer.total.stop();
                        timer.eta.stop();
                        progress.status = "INTERRUPT";
                        fetch("/batch_timer/reset", { method: "POST" }).catch(() => {});
                        app.graph?.setDirtyCanvas(true, true);
                    }
                })
                .catch(() => {});
        }
    }
}, 100);

app.registerExtension({
    name: "BatchImageTimer.Final",

    async setup() {
        api.addEventListener("batch_timer_update", (event) => {
            const d = event.detail || {};
            if (d.node_id) {
                activeNodeId = String(d.node_id);
                // Lock the current graph to isolate other workflows
                activeGraph = app.graph; 
            }

            lastHeartbeatTime = Date.now();

            if (queueEmptyTimeout) {
                clearTimeout(queueEmptyTimeout);
                queueEmptyTimeout = null;
            }

            const now = Date.now();
            if (!isMacroRunning && (now - lastCompletionTime < 200)) {
                return; 
            }

            if (!isMacroRunning || d.current === 1) {
                isMacroRunning = true;
                timer.compute.start();
                timer.total.start(); 
                timer.eta.start();
                progress.start(d.total || 1);
            }
            
            progress.update(d);
            timer.eta.calculateOnce(d.current, d.total, timer.total.getMs());
            
            app.graph?.setDirtyCanvas(true, true);
        });

        api.addEventListener("execution_success", () => {
            if (isMacroRunning && progress.current >= progress.total) {
                isMacroRunning = false;
                lastCompletionTime = Date.now();
                timer.compute.stop();
                timer.total.stop();
                timer.eta.stop();
                progress.markCompleted();
                app.graph?.setDirtyCanvas(true, true);
            }
        });

        api.addEventListener("status", (event) => {
            const queueRemaining = event.detail?.status?.exec_info?.queue_remaining;
            
            if (queueRemaining === 0 && isMacroRunning) {
                if (queueEmptyTimeout) clearTimeout(queueEmptyTimeout);
                queueEmptyTimeout = setTimeout(() => {
                    fetch("/prompt")
                        .then(res => res.json())
                        .then(data => {
                            const isExecuting = data?.exec_info?.executing != null;
                            if (isExecuting) return;
                            
                            if (isMacroRunning && progress.current < progress.total) {
                                return; 
                            }

                            if (isMacroRunning) {
                                isMacroRunning = false;
                                lastCompletionTime = Date.now();
                                timer.compute.stop();
                                timer.total.stop();
                                timer.eta.stop();
                                progress.markCompleted();
                                fetch("/batch_timer/reset", { method: "POST" }).catch(() => {});
                                app.graph?.setDirtyCanvas(true, true);
                            }
                        })
                        .catch(() => {
                            if (isMacroRunning && progress.current < progress.total) {
                                return;
                            }
                            if (isMacroRunning) {
                                isMacroRunning = false;
                                lastCompletionTime = Date.now();
                                timer.compute.stop();
                                timer.total.stop();
                                timer.eta.stop();
                                progress.status = "INTERRUPT";
                                fetch("/batch_timer/reset", { method: "POST" }).catch(() => {});
                                app.graph?.setDirtyCanvas(true, true);
                            }
                        })
                        .finally(() => {
                            queueEmptyTimeout = null;
                        });
                }, 1500);
            }
        });

        api.addEventListener("execution_error", () => {
            if (isMacroRunning) {
                isMacroRunning = false;
                progress.status = "ERROR";
                timer.compute.stop();
                timer.total.stop();
                timer.eta.stop();
                fetch("/batch_timer/reset", { method: "POST" }).catch(() => {});
                app.graph?.setDirtyCanvas(true, true);
            }
        });

        api.addEventListener("execution_interrupted", () => {
            if (isMacroRunning) {
                isMacroRunning = false;
                progress.status = "INTERRUPT";
                timer.compute.stop();
                timer.total.stop();
                timer.eta.stop();
                fetch("/batch_timer/reset", { method: "POST" }).catch(() => {});
                setTimeout(() => app.graph?.setDirtyCanvas(true, true), 50);
            }
        });
    },

    async nodeCreated(node) {
        if (node.comfyClass !== "BatchImageTimer") return;

        node.properties = node.properties || {};
        node.properties.activeColor = node.properties.activeColor || "#FFFFFF";
        node.properties.displayMode = node.properties.displayMode || "COMPUTE"; 
        node._lastDigitClick = 0;
        node._flashTime = 0;

        if (!node._hasInitialSized) {
            node._hasInitialSized = true;
            requestAnimationFrame(() => {
                if (!node.widgets || node.widgets.length === 0) return;
                const w = node.widgets[0];
                let widgetBottom = 60;
                if (w.last_y !== undefined && !isNaN(w.last_y)) {
                    const h = (typeof w.computeSize === "function") ? w.computeSize()[1] : 24;
                    widgetBottom = w.last_y + (isNaN(h) ? 24 : h);
                }
                const minHeight = widgetBottom + 15 + 130; 
                if (!node.size || isNaN(node.size[1]) || node.size[1] < minHeight) {
                    node.size = [Math.max((node.size && node.size[0]) || 280, 280), isNaN(minHeight) ? 200 : minHeight];
                    app.graph?.setDirtyCanvas(true, true);
                }
            });
        }

        node.onDrawBackground = function (ctx) {
            let displayMs = 0;
            let displayText = "READY";
            let isCompleted = false;
            let pStatus = "READY";

            // Only render dynamic data if this node belongs to the active graph and is the active node
            if (activeGraph === this.graph && activeNodeId === String(this.id)) {
                const mode = this.properties.displayMode;
                if (mode === "COMPUTE") {
                    displayMs = timer.compute.getMs();
                } else if (mode === "TOTAL") {
                    displayMs = timer.total.getMs(); 
                } else if (mode === "ETA") {
                    displayMs = timer.eta.getMs();
                }
                displayText = progress.getDisplayText();
                isCompleted = progress.isCompleted;
                pStatus = progress.status;
            }

            const activeColor = this.properties.activeColor;
            renderTimerUI(ctx, this, displayMs, displayText, activeColor, isCompleted, this.properties.displayMode, pStatus, this._flashTime);
        };

        node.onMouseDown = function (e, pos) {
            if (this._hitTabs) {
                for (const tab of this._hitTabs) {
                    if (pos[0] >= tab.x && pos[0] <= tab.x + tab.w && pos[1] >= tab.y && pos[1] <= tab.y + tab.h) {
                        this.properties.displayMode = tab.mode;
                        app.graph.setDirtyCanvas(true, true);
                        return true;
                    }
                }
            }

            if (this._hitSwatches) {
                for (const s of this._hitSwatches) {
                    if (pos[0] >= s.x && pos[0] <= s.x + s.w && pos[1] >= s.y && pos[1] <= s.y + s.h) {
                        this.properties.activeColor = s.color;
                        app.graph.setDirtyCanvas(true, true);
                        return true;
                    }
                }
            }

            const isThisNodeActive = (activeNodeId === String(this.id)) || !timer.compute.isRunning;
            if (!isThisNodeActive) return false;

            const d = this._hitDigit;
            if (d && pos[0] >= d.x && pos[0] <= d.x + d.w && pos[1] >= d.y && pos[1] <= d.y + d.h) {
                const now = Date.now();
                const isDoubleClick = now - this._lastDigitClick < 300;

                if (this.properties.displayMode === "COMPUTE") {
                    if (isDoubleClick) {
                        this._lastDigitClick = 0;
                        const keepRunning = timer.compute.isRunning;
                        timer.compute.reset(keepRunning);
                        if (!keepRunning) {
                            progress.resetAll();
                            activeNodeId = null;
                            activeGraph = null;
                        }
                    } else {
                        this._lastDigitClick = now;
                        if (timer.compute.isRunning) {
                            timer.compute.isPaused ? timer.compute.resume() : timer.compute.pause();
                        }
                    }
                    app.graph.setDirtyCanvas(true, true);
                    return true;
                } else if (this.properties.displayMode === "TOTAL") {
                    if (isDoubleClick) {
                        this._lastDigitClick = 0;
                        timer.total.reset();
                        if (!timer.compute.isRunning) {
                            progress.resetAll();
                            activeNodeId = null;
                            activeGraph = null;
                        }
                    } else {
                        this._lastDigitClick = now;
                        if (timer.compute.isRunning) {
                            this._flashTime = Date.now();
                            app.graph.setDirtyCanvas(true, true);
                            setTimeout(() => {
                                if (this._flashTime > 0) {
                                    this._flashTime = 0;
                                    app.graph.setDirtyCanvas(true, true);
                                }
                            }, 150);
                        }
                    }
                    app.graph.setDirtyCanvas(true, true);
                    return true;
                } else if (this.properties.displayMode === "ETA") {
                    this._lastDigitClick = now;
                    if (timer.compute.isRunning) {
                        this._flashTime = Date.now();
                        app.graph.setDirtyCanvas(true, true);
                        setTimeout(() => {
                            if (this._flashTime > 0) {
                                this._flashTime = 0;
                                app.graph.setDirtyCanvas(true, true);
                            }
                        }, 150);
                    }
                    app.graph.setDirtyCanvas(true, true);
                    return true;
                }
            }
        };

        node.onMouseMove = function (e, pos) {
            const canvasEl = app.canvas?.canvas;
            if (!canvasEl) return;

            const currentCursor = canvasEl.style.cursor || "";
            if (currentCursor.includes("resize")) return;

            const margin = 10;
            const nodeW = this.size[0];
            const nodeH = this.size[1];
            
            let headerOffset = 30;
            if (this.widgets && this.widgets.length > 0) {
                let maxY = 0;
                for (const w of this.widgets) {
                    if (w.last_y !== undefined && w.type !== "hidden_seq_index") {
                        const h = (typeof w.computeSize === "function") ? w.computeSize()[1] : 20;
                        const bottom = w.last_y + h;
                        if (bottom > maxY) maxY = bottom;
                    }
                }
                headerOffset = maxY > 0 ? maxY + 15 : 65;
            }

            const panelX = margin;
            const panelY = headerOffset;
            const panelW = nodeW - margin * 2;
            let rawH = nodeH - headerOffset - margin;
            if (isNaN(rawH)) rawH = 100;
            const panelH = Math.max(80, rawH);

            const insidePanel = pos[0] >= panelX && pos[0] <= panelX + panelW && 
                                pos[1] >= panelY && pos[1] <= panelY + panelH;

            if (!insidePanel) {
                const defaultCursor = app.canvas?.default_connection_cursor || "crosshair";
                if (canvasEl.style.cursor !== defaultCursor && !canvasEl.style.cursor.includes("resize")) {
                    canvasEl.style.cursor = defaultCursor;
                }
                return; 
            }

            let cursor = "crosshair";
            if (this._hitTabs?.some(t => pos[0] >= t.x && pos[0] <= t.x + t.w && pos[1] >= t.y && pos[1] <= t.y + t.h)) {
                cursor = "pointer";
            } else if (this._hitSwatches?.some(s => pos[0] >= s.x && pos[0] <= s.x + s.w && pos[1] >= s.y && pos[1] <= s.y + s.h)) {
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
            if (canvasEl) canvasEl.style.cursor = app.canvas?.default_connection_cursor || "crosshair";
        };
    },

    async loadedGraphNode(node) {
        this.nodeCreated(node);
    }
});