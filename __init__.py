"""
ComfyUI-Batch-Image-Timer
A specialized 7-segment LED timer for tracking the total execution time of batch image processing workflows.

Version: 0.2.3
Copyright (c) 2026 Herman Kwan
Licensed under the MIT License. See LICENSE file for details.
"""

__version__ = "0.2.3"

from .batch_image_timer import BatchImageTimer

NODE_CLASS_MAPPINGS = {"BatchImageTimer": BatchImageTimer}
NODE_DISPLAY_NAME_MAPPINGS = {"BatchImageTimer": "⏱️ Batch Image Timer"}

WEB_DIRECTORY = "./web"

__all__ = [
    "NODE_CLASS_MAPPINGS",
    "NODE_DISPLAY_NAME_MAPPINGS",
    "WEB_DIRECTORY",
    "__version__",
]
