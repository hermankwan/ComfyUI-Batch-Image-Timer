# ⏱️ ComfyUI Batch Image Timer

A custom node for ComfyUI that provides a **real-time 7-segment LED display timer** to accurately track execution duration and progress during image batching, dataset processing, and image-to-image loop workflows.

---

## ✨ Features

* 📺 **7-Segment LED UI**: Retro digital clock design rendered directly on the canvas node.
* 🎨 **Interactive Palette**: Click-to-change display color scheme (White, Blue, Green, Yellow, Pink).
* ⏱️ **Accurate Batch Timing**: Seamlessly measures time spent across multiple batch iterations without resetting prematurely.
* 📊 **Live Progress Counter**: Displays real-time progress `[ Current / Total ]` and execution status (`[ STARTING... ]`, `[ CANCEL ]`, `[ ERROR ]`).
* 🔄 **Smart Auto-Reset**: Resets automatically when starting a brand-new queue, but retains state across batch steps.

---

## 📦 Installation

### Method 1: Git Clone (Manual)

1. Open your terminal or command prompt.
2. Navigate to your ComfyUI `custom_nodes` folder:
   ```bash
   cd ComfyUI/custom_nodes
Clone this repository:

Bash
git clone [https://github.com/hermankwan/ComfyUI-Batch-Image-Timer.git](https://github.com/hermankwan/ComfyUI-Batch-Image-Timer.git)
Restart ComfyUI.

🚀 How to Use
Double-click on the ComfyUI canvas or search for Batch Image Timer.

Place the node in your batch generation workflow.

Set the total_images parameter to match the total count of images in your batch or loop execution.

Click Queue Prompt. The node will keep timing seamlessly across all iterations.

📄 License
This project is licensed under the MIT License - see the LICENSE file for details.