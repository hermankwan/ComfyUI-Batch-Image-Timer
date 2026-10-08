"""
ComfyUI-Batch-Image-Timer
A real-time 7-segment LED timer node for ComfyUI batch generation tracking.
"""

__version__ = "0.1.0"

from .batch_image_timer import BatchImageTimer

NODE_CLASS_MAPPINGS = {
    "BatchImageTimer": BatchImageTimer
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "BatchImageTimer": "⏱️ Batch Image Timer"
}

WEB_DIRECTORY = "./web"

__all__ = [
    "NODE_CLASS_MAPPINGS",
    "NODE_DISPLAY_NAME_MAPPINGS",
    "WEB_DIRECTORY",
    "__version__",
]