
from temporalio import workflow, activity
from dataclasses import dataclass

@workflow.defn
class ReflectAndIndexWorkflow:
    @workflow.run
    async def run(self, payload: dict) -> dict:
        # TODO: fan out Ray tasks, write to DB, compute embeddings, etc.
        return {"ok": True, "received": payload}

@activity.defn
async def store_interaction(payload: dict) -> str:
    # TODO: persist to DB
    return "interaction_id_stub"
