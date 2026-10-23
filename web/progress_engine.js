export class ProgressEngine {
    constructor() {
        this.current = 0;
        this.total = 0;
        this.status = "READY"; // READY | RUNNING | INTERRUPT | ERROR
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
        
        if (this.current > this.total) {
            this.current = this.total;
        }
    }

    markCompleted() {
        if (this.status === "RUNNING" && this.current >= this.total) {
            this.isCompleted = true;
        }
    }

    resetAll() {
        this.current = 0;
        this.total = 0;
        this.status = "READY";
        this.isCompleted = false;
    }

    getDisplayText() {
        switch (this.status) {
            case "READY": return "READY";
            case "ERROR": return "ERROR";
            case "INTERRUPT": return "INTERRUPT";
            case "RUNNING": return `${this.current} / ${this.total}`;
            default: return "READY";
        }
    }
}