import time
from aiohttp import web
from server import PromptServer

class TimerManager:
    start_time = None
    is_running = False
    completed_count = 0
    total_images = 0
    last_elapsed = 0.0

@PromptServer.instance.routes.post("/batch_timer/reset")
async def reset_timer(request):
    try:
        data = await request.json()
    except Exception:
        data = {}
        
    force = data.get("force", False)

    if TimerManager.is_running and not force:
        return web.json_response({"status": "ignored"})

    TimerManager.start_time = time.time()
    TimerManager.is_running = True
    TimerManager.completed_count = 0
    TimerManager.last_elapsed = 0.0

    return web.json_response({
        "status": "ok",
        "server_time": TimerManager.start_time
    })


class BatchImageTimer:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "total_images": ("INT", {"default": 1, "min": 1, "max": 999999}),
            },
            "hidden": {
                "unique_id": "UNIQUE_ID",
            }
        }

    RETURN_TYPES = ()
    RETURN_NAMES = ()
    FUNCTION = "process"
    CATEGORY = "utils/timer"
    OUTPUT_NODE = True

    @classmethod
    def IS_CHANGED(cls, **kwargs):
        return float("nan")

    def process(self, total_images, unique_id=None):
        now = time.time()
        
        if TimerManager.start_time is None or not TimerManager.is_running:
            TimerManager.start_time = now
            TimerManager.is_running = True
            TimerManager.completed_count = 0

        TimerManager.completed_count += 1
        TimerManager.total_images = total_images
        elapsed_sec = max(0.0, now - TimerManager.start_time)
        TimerManager.last_elapsed = elapsed_sec

        is_final = False
        if total_images > 0 and TimerManager.completed_count >= total_images:
            is_final = True

        PromptServer.instance.send_sync("batch_timer_update", {
            "node_id": unique_id,
            "current": TimerManager.completed_count,
            "total": total_images,
            "elapsed_sec": elapsed_sec,
            "is_running": True,
            "is_final": is_final,
            "server_time": now
        })

        if is_final:
            TimerManager.is_running = False

        return ()