
import ray

@ray.remote
def summarize(text: str) -> str:
    # TODO: call LLM via your model router; this is a stub
    return text[:200] + ("..." if len(text) > 200 else "")

@ray.remote
def extract_codestones(text: str) -> list[str]:
    # TODO: LLM-powered extraction; stubbed
    return [line.strip() for line in text.splitlines() if line.strip()][:5]
