export class TimerEngine {
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

    getElapsedMs() {
        let ms = this.baseMs;
        if (this.isRunning && !this.isPaused && this.syncAt > 0) {
            ms += performance.now() - this.syncAt;
        }
        return ms;
    }
}