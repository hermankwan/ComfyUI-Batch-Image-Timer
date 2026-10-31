/**
 * ComfyUI-Batch-Image-Timer
 * A specialized 7-segment LED timer for tracking the total execution time of batch image processing workflows.
 * 
 * @version 0.2.3
 * @copyright Copyright (c) 2026 Herman Kwan
 * @license MIT
 */

export class ProgressEngine {
    constructor() {
        this.current = 0;
        this.total = 0;
        this.status = "READY"; 
        this.isCompleted = false;
    }

    start(total = 1) {
        this.current = 1;
        this.total = total > 0 ? total : 1;
        this.status = "RUNNING";
        this.isCompleted = false;
    }

    update(data) {
        if (this.status !== "RUNNING") return;
        if (data.current != null) this.current = data.current;
        if (data.total != null) this.total = data.total;
        if (this.current > this.total) this.current = this.total;
    }

    markCompleted() {
        if (this.status === "RUNNING" && this.current >= this.total) {
            this.isCompleted = true;
            this.status = "COMPLETED";
        }
    }

    resetAll() {
        this.current = 0;
        this.total = 0;
        this.status = "READY";
        this.isCompleted = false;
    }

    getDisplayText() {
        if (this.status === "READY") return "READY";
        // Preserve the exact count on interrupt or error
        if (this.current > 0) {
            return `${this.current} / ${this.total}`;
        }
        return this.status;
    }
}