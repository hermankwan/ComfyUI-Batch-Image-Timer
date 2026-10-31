# ⏱️ ComfyUI Batch Image Timer

![Version](https://img.shields.io/badge/version-0.2.3-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![ComfyUI](https://img.shields.io/badge/ComfyUI-custom%20node-orange)
![Platform](https://img.shields.io/badge/platform-web%20%2F%20canvas-lightgrey)

<p align="center">
  <img src="assets/bit_timer.gif" alt="Batch Image Timer Interaction Demo"><br>
  <sub>*Switch modes to view COMPUTE, TOTAL, or ETA. Click to Pause/Resume (COMPUTE), double-click to reset.*</sub>
</p>

A specialized custom node for ComfyUI focused on **batch image processing workflows**, providing a **real-time 7-segment LED timer** to track total execution duration across sequential loops and bulk image pipelines.

> 💡 **Timing other workflows (Video, Audio, Training)?** See the universal counterpart: [ComfyUI Universal Timer](https://github.com/hermankwan/ComfyUI-Universal-Timer).

---

## 📌 Where to Find It
Right-click the canvas → **utils/timer**, or search **`Batch Image Timer`**.

---

## ✨ Features

* 🎯 **Batch Image Focus**: Built for sequential loaders (e.g. *Sequential Image Loader*) and image-to-image batch pipelines.
* 🕒 **Triple Timing Modes**:
  * **COMPUTE** — Pure execution time (excludes queue wait). Supports Pause/Resume.
  * **TOTAL** — Wall-clock time from start to finish, including all waits.
  * **ETA** — Forecast of remaining batch time based on completed iterations.
* 📺 **7-Segment LED UI**: Retro digital display rendered directly on the canvas.
* 🎨 **Interactive Palette & Persistence**: Click a swatch to change color; the choice is saved in the **Workflow JSON**.
* ⏱️ **Batch-Level Timing (Sequential Mode)**: Measures the whole batch without resetting between iterations. For native tensor batches (`total_images = 1`), it tracks that single execution.
* 🚦 **Color-Coded Status Counter `[ X / Y ]`**:
  * ⚪ **Gray** `[ READY ]` — Idle.
  * 🔵 **Blue** `[ X / Y ]` — Running.
  * 🟢 **Green** `[ Y / Y ]` — Completed.
  * 🟡 **Yellow** `[ X / Y ]` — Interrupted (retains exact count).
  * 🔴 **Red** `[ X / Y ]` — Error (retains exact count).
  * *Edge case*: if interrupted/errored before the first image finishes (`current = 0`), the counter shows literal `[ INTERRUPT ]` / `[ ERROR ]` — there is no progress to retain.
* ⏸️ **Timer / Counter Independence**: Pausing or resetting the timer never affects the counter, and vice versa.
* 🔗 **Auto Batch Count Sync**: Connect `total_images` directly to batch loaders.
* 🛡️ **Multi-Workflow Display Isolation**: Only the workflow that initiated the current execution shows live timer data; other open workflows' timer nodes stay at `[ READY ]`, preventing visual cross-contamination.
* ⏳ **10-Minute Deadlock Fallback**: Safety net if a third-party node stops sending signals.


---

## 📦 Installation

> **Note:** This node relies strictly on native web standard components and ComfyUI API events. No external Python dependencies or `requirements.txt` are required.

### Method 1: Via ComfyUI-Manager (Recommended)
1. Open ComfyUI and click on **Manager** in the menu.
2. Select **Custom Nodes Manager**.
3. Search for `ComfyUI-Batch-Image-Timer`.
4. Click **Install** and restart your ComfyUI.

### Method 2: Manual Installation (Git Clone)
1. Navigate to your ComfyUI `custom_nodes` directory:
   ```bash
   cd ComfyUI/custom_nodes
   ```
2. Clone this repository:
   ```bash
   git clone https://github.com/hermankwan/ComfyUI-Batch-Image-Timer
   ```
3. Restart your ComfyUI instance.

---

## 🚀 Usage & Interactions

1. Add **Batch Image Timer** to your graph.
2. Link your image count to `total_images` (default `1` for native tensor batches; set/connect `N` for sequential loaders).
3. Click **Queue Prompt**.

The node UI has **four zones** — each responds only within its own area:

| Zone | Interaction |
|---|---|
| **1. Mode tabs** (`ETA`&nbsp;/&nbsp;`COMPUTE`&nbsp;/&nbsp;`TOTAL`) | Click to switch mode. Active tab is highlighted blue. |
| **2. LED timer digits** | **COMPUTE**: single-click = Pause/Resume, double-click = reset (continues if running, stays at `00:00:00` if idle).<br>**TOTAL**: single-click = brief flash (only while running); double-click = reset.<br>**ETA**: single/double-click = brief flash (only while running, no pause/reset). |
| **3. Color swatches** (5 blocks) | Click to change LED color. Saved with the workflow. |
| **4. Progress counter** `[&nbsp;X&nbsp;/&nbsp;Y&nbsp;]` | Display only — no interaction. |

> 💡 **Use only one Batch Image Timer per workflow.** With multiple timers, only the first-executed node tracks the active run; the others remain display-isolated.

---

## 💡 How It Works

### Timing Modes
* **COMPUTE** — Pure execution time, from first image start to last image end. Pausable to exclude away-time.
* **TOTAL** — Absolute wall-clock time. Keeps ticking even if COMPUTE is paused.
* **ETA** — Estimated remaining time using a smoothed blend of the **global average per-image cost** and the **latest iteration cost** (30% / 70% weighting). It adapts quickly to speed changes while staying stable. Shows `99:99:99` until the first image completes (`current` reaches 2), then counts down; only zeroes out when the workflow finishes.

> ⚠️ **ETA is for sequential loops (`total_images > 1`).** For single-image workflows (`total_images = 1`), ETA stays at `99:99:99` — use COMPUTE or TOTAL instead.

### `total_images` Principles
* **Native tensor batch** (`batch_size = N`): keep `total_images = 1`. Tracks the batch as one unit.
* **Sequential loader**: set or connect `total_images = N`. Aggregates time without resetting.

---

## ⚠️ Known Limitations

* **Interrupt/error before first image completes**: Counter shows literal `[ INTERRUPT ]` / `[ ERROR ]` (no progress to retain).
* **Multiple timers with different `total_images`**: Only the first-executed node becomes the counting master. If two timers are connected to different totals, counting may reset unexpectedly — use identical `total_images`.
* **Rapid consecutive Queue clicks**: The previous run may not have fully reset; ETA may briefly show stale values until `current` reaches 1 again (v0.2.3 force-restarts clocks when `current === 1`).
* **ETA in single-image workflows**: Stays at `99:99:99` (no history). Use COMPUTE or TOTAL.

---

## 🛡️ Deadlock Fallback (10-Minute Timeout)

If a third-party node (e.g. *Sequential Image Loader*) enters a deadlock and stops sending signals, the timer queries the backend after **10 minutes of silence**. If the backend confirms it is idle, the timer stops and displays a yellow `[ X / Y ]` counter.

> **Don't want to wait 10 minutes?** Double-click the LED digits to reset manually.

---

## 📋 Changelog

### v0.2.3
* **Triple Timing Modes**: Added `ETA` and `TOTAL` alongside `COMPUTE`.
* **Smart ETA**: 30/70 blend of global average and latest iteration cost; excludes initial model-load overhead.
* **Color-Coded Counter**: Text `[ INTERRUPT ]` / `[ ERROR ]` removed in favor of colored `[ X / Y ]` (see edge case above).
* **UI & Interaction Polish**: Panel-only cursor logic for smooth node drag/resize; enhanced LED glow.
* **Refined Display Isolation**: Each workflow canvas strictly isolates its own live timer display.
* **Force-restart on `current === 1`**: Handles rapid Queue clicks more gracefully.

### v0.2.2
* **Added Neon Glow Effect**: The 7-segment LED digits now have a subtle, theme-matched glow, making the batch monitoring visually clearer.
* **Fixed Node Resizing Conflict**: Improved UI interaction so node corners can be easily dragged to resize without cursor interference.

### v0.2.1
* **Added 10-Minute Safety Deadlock Fallback**: Prevents the timer from running infinitely when third-party nodes (e.g., Sequential Loaders) enter a ghost/deadlock state. Queries backend `executing` status before stopping.
* **Improved Status Handling**: `[ INTERRUPT ]` now properly covers both user-initiated interruptions and fallback-triggered stops.

### v0.2.0 (Major Architecture Refactor)
* **Complete Codebase Rewrite**: Refactored into a modular ES Modules architecture.
* **Batch Tracking Logic**: Fixed counting/resetting issues with Sequential Loaders. Added robust termination fallbacks for interrupted queues.
* **UI/UX Overhaul**: Redesigned node layout, fixed window resizing conflicts, and introduced dynamic color feedback for statuses (Ready/Running/Complete/Error/Interrupt).
* **State Isolation**: Timer interactions (Pause/Reset) are now fully decoupled from the progress counter. Added multi-workflow isolation.

### v0.1.1
* Added interactive hover-to-pause functionality.
* Fixed multi-batch time jumping / rebound bugs.
* Implemented workflow-scoped theme color persistence.

### v0.1.0
* Initial release focused on batch image workflow timing.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.