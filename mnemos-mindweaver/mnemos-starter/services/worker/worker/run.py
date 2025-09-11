
import asyncio
from temporalio.client import Client
from temporalio.worker import Worker
from .settings import settings
from .workflows import ReflectAndIndexWorkflow, store_interaction

async def main():
    client = await Client.connect(settings.temporal_host, namespace=settings.temporal_namespace)
    worker = Worker(client, task_queue="mnemos-task-queue", workflows=[ReflectAndIndexWorkflow], activities=[store_interaction])
    print("Worker started… listening on 'mnemos-task-queue'")
    await worker.run()

if __name__ == "__main__":
    asyncio.run(main())
