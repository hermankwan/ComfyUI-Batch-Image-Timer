# ⏱️ ComfyUI Batch Image Timer

A custom node for ComfyUI that provides a **real-time 7-segment LED display timer** to accurately track execution duration and progress during image batching, dataset processing, and image-to-image loop workflows.

---

## ✨ Features

* 📺 **7-Segment LED UI**: Retro digital clock design rendered directly on the canvas node[cite: 2].
* 🎨 **Interactive Palette & Persistent Themes**: Click-to-change display color scheme (White, Blue, Green, Yellow, Pink). Your color preference is automatically saved to the node's properties and persists across sessions.
* ⏱️ **Accurate Batch Timing**: Seamlessly measures time spent across multiple batch iterations without resetting prematurely[cite: 2].
* 📊 **Live Progress Counter**: Displays real-time progress `[ Current / Total ]` and execution status (`[ READY ]`, `[ CANCEL ]`, `[ ERROR ]`)[cite: 2].
* ⏸️ **Interactive Pause & Resume**: Hover over the counter area to display `[ PAUSE ]` or `[ RESUME ]`, allowing you to freeze or continue the timer at any time without affecting the workflow execution or image counts.
* 🔄 **Smart Reset & Sync**: Click the 7-segment LED digits to manually reset the timer on the fly. 
* 🔗 **Auto Batch Count Sync**: Connect `total_images` directly to batch loaders (e.g., *Sequential Image Loader*, *ComfyUI-BatchFolderTools*, *ComfyUI Simple Batch*) to automatically update image counts without manual input[cite: 2].

<p align="center">
  <img src="assets/bitimer.gif" alt="Batch Image Timer Screen Capture"><br>
  <sub>*Click the color swatches on the node to switch LED display themes*</sub>
</p>

---

## 📦 Installation

> **Note:** This node uses native Python libraries and web standard components only. No external dependencies or `requirements.txt` installation are required[cite: 2].

### Method 1: Git Clone (Manual)

1. Open your terminal or command prompt[cite: 2].
2. Navigate to your ComfyUI `custom_nodes` folder[cite: 2]:
    ```bash
    cd ComfyUI/custom_nodes
    ```
3. Clone this repository[cite: 2]:
    ```bash
    git clone https://github.com/hermankwan/ComfyUI-Batch-Image-Timer
    ```
4. Restart ComfyUI[cite: 2].

---

## 🚀 How to Use

1. Double-click on the ComfyUI canvas or search for **`Batch Image Timer`**.
2. Place the node in your batch generation workflow.
3. Set the `total_images` parameter to match the total count of images in your batch or loop execution.
4. Click **Queue Prompt**. The node will keep timing seamlessly across all iterations[cite: 2].

### 🖱️ Interactive Controls

* **Pause / Resume Timer**: When the workflow is running, hover your mouse over the bottom counter area (where `x / y` is displayed). It will dynamically show `[ PAUSE ]`. Click it to pause the timer while keeping image processing and counting unaffected. Hover again to see `[ RESUME ]`, and click to pick up right where you left off.
* **Reset Timer**: Click directly on the 7-segment LED time digits to reset the timer back to `00:00:00` at any point during operation.
* **Theme Switching & Saving**: Click any of the small color swatches below the LED display to instantly change the active color theme. Your chosen color is automatically saved with the workflow and node properties.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details[cite: 2].