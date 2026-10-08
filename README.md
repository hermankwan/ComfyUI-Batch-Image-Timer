# ⏱️ ComfyUI Batch Image Timer

A custom node for ComfyUI that provides a **real-time 7-segment LED display timer** to accurately track execution duration and progress during image batching, dataset processing, and image-to-image loop workflows.

一个专为 ComfyUI 设计的批处理计时器自定义节点，配备 **7 段数码管实时显示面板**，可精准统计多图批处理、数据集处理及图生图循环工作流中的耗时与进度。

---

## ✨ Features / 核心功能

* 📺 **7-Segment LED UI**: Retro digital clock design rendered directly on the canvas node.
* 🎨 **Interactive Palette**: Click-to-change display color scheme (White, Blue, Green, Yellow, Pink).
* ⏱️ **Accurate Batch Timing**: Seamlessly measures time spent across multiple batch iterations without resetting prematurely.
* 📊 **Live Progress Counter**: Displays real-time progress `[ Current / Total ]` and execution status (`[ STARTING... ]`, `[ CANCEL ]`, `[ ERROR ]`).
* 🔄 **Smart Auto-Reset**: Resets automatically when starting a brand-new queue, but retains state across batch steps.

---

## 📦 Installation / 安装说明

### Method 1: Git Clone (Manual)
1. Open your terminal / command prompt.
2. Navigate to your ComfyUI `custom_nodes` folder:

   cd ComfyUI/custom_nodes/
   git clone https://github.com/你的GitHub用户名/ComfyUI-Batch-Image-Timer