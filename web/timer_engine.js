/**
 * ComfyUI-Batch-Image-Timer
 * A specialized 7-segment LED timer for tracking the total execution time of batch image processing workflows.
 * 
 * @version 0.2.3
 * @copyright Copyright (c) 2026 Herman Kwan
 * @license MIT
 */

// Compute Clock (COMPUTE)
class ComputeClock {
    constructor() {
        this.isRunning = false;
        this.isPaused = false;
        this.baseMs = 0;
        this.syncAt = 0;
    }
    start() {
        this.isRunning = true;
        this.isPaused = false;
        this.baseMs = 0;
        this.syncAt = performance.now();
    }
    pause() {
        if (!this.isRunning || this.isPaused) return;
        this.baseMs += performance.now() - this.syncAt;
        this.isPaused = true;
    }
    resume() {
        if (!this.isRunning || !this.isPaused) return;
        this.syncAt = performance.now();
        this.isPaused = false;
    }
    reset(keepRunning) {
        this.baseMs = 0;
        this.syncAt = performance.now();
        this.isPaused = false;
        this.isRunning = keepRunning;
    }
    stop() {
        if (this.isRunning && !this.isPaused) {
            this.baseMs += performance.now() - this.syncAt;
        }
        this.isRunning = false;
        this.isPaused = false;
        this.syncAt = 0;
    }
    getMs() {
        let ms = this.baseMs;
        if (this.isRunning && !this.isPaused && this.syncAt > 0) {
            ms += performance.now() - this.syncAt;
        }
        return ms;
    }
}

// Wall-Clock (TOTAL)
class TotalClock {
    constructor() {
        this.isRunning = false;
        this.startTime = 0;
        this.frozenMs = 0;
    }
    start() {
        this.isRunning = true;
        this.startTime = Date.now();
        this.frozenMs = 0;
    }
    reset() {
        if (this.isRunning) {
            this.startTime = Date.now();
        } else {
            this.frozenMs = 0;
        }
    }
    stop() {
        if (this.isRunning) {
            this.frozenMs = Date.now() - this.startTime;
            this.isRunning = false;
        }
    }
    getMs() {
        if (this.isRunning) {
            return Date.now() - this.startTime;
        }
        return this.frozenMs;
    }
}

// ETA Forecast (ETA)
class EtaClock {
    constructor() {
        this.isRunning = false;
        this.frozenEtaMs = (99 * 3600 + 99 * 60 + 99) * 1000; 
        this.completedCount = 0; 
        this.smoothedCostMs = 0;
        this.lastTotalClockMs = 0;
    }
    start() {
        this.isRunning = true;
        this.frozenEtaMs = (99 * 3600 + 99 * 60 + 99) * 1000;
        this.completedCount = 0;
        this.smoothedCostMs = 0;
        this.lastTotalClockMs = 0;
    }
    stop() {
        this.isRunning = false;
        this.frozenEtaMs = 0;
    }
    reset() {
        this.start();
    }

    calculateOnce(current, total, currentTotalClockMs) {
        const realCompleted = current - 1;

        if (realCompleted > this.completedCount) {
            this.completedCount = realCompleted;
            
            let thisCostMs = 0;
            if (this.lastTotalClockMs > 0) {
                thisCostMs = currentTotalClockMs - this.lastTotalClockMs;
            } else {
                thisCostMs = currentTotalClockMs;
            }
            this.lastTotalClockMs = currentTotalClockMs;

            const avgHistory = currentTotalClockMs / this.completedCount;
            // EMA smoothing: 30% history, 70% current
            this.smoothedCostMs = (avgHistory * 0.3) + (thisCostMs * 0.7);

            const remaining = total - this.completedCount;
            this.frozenEtaMs = this.smoothedCostMs * remaining;
        }
    }
    getMs() { return this.frozenEtaMs; }
}

export class TimerEngine {
    constructor() {
        this.compute = new ComputeClock();
        this.total = new TotalClock();
        this.eta = new EtaClock();
    }
}