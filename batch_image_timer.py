"""
ComfyUI-Batch-Image-Timer
A specialized 7-segment LED timer for tracking the total execution time of batch image processing workflows.

Version: 0.2.3
Copyright (c) 2026 Herman Kwan
Licensed under the MIT License. See LICENSE file for details.
"""

import time
from aiohttp import web
from server import PromptServer


class TimerState:
    def __init__(self):
        self.completed_count = 0
        self.total_images = 1
        self.is_active = False
        self.last_completion_time = 0.0
        self.master_node_id = None


STATE = TimerState()


@PromptServer.instance.routes.post("/batch_timer/reset")
async def reset_timer(request):
    STATE.completed_count = 0
    STATE.is_active = False
    STATE.last_completion_time = 0.0
    STATE.master_node_id = None
    return web.json_response({"status": "ok"})


class BatchImageTimer:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "total_images": ("INT", {"default": 1, "min": 1, "max": 999999}),
            },
            "hidden": {
                "unique_id": "UNIQUE_ID",
            },
        }

    RETURN_TYPES = ()
    FUNCTION = "process"
    CATEGORY = "utils/timer"
    OUTPUT_NODE = True

    @classmethod
    def IS_CHANGED(cls, **kwargs):
        return float("nan")

    def process(self, total_images, unique_id=None):
        now = time.time()

        # Reset state if a new batch starts or if total_images changed
        if (
            not STATE.is_active
            or STATE.completed_count >= STATE.total_images
            or STATE.total_images != total_images
        ):
            STATE.is_active = True
            STATE.completed_count = 0
            STATE.total_images = total_images
            STATE.last_completion_time = 0.0
            STATE.master_node_id = unique_id

        # Ignore execution if this is not the master node to prevent double counting
        if str(unique_id) != str(STATE.master_node_id):
            return ()

        this_iteration_cost = 0.0
        if STATE.completed_count > 0 and STATE.last_completion_time > 0:
            this_iteration_cost = now - STATE.last_completion_time

        STATE.last_completion_time = now
        STATE.completed_count += 1

        PromptServer.instance.send_sync(
            "batch_timer_update",
            {
                "current": STATE.completed_count,
                "total": STATE.total_images,
                "node_id": unique_id,
                "iter_cost_sec": this_iteration_cost,
            },
        )
        return ()
