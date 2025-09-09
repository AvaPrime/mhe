from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from mhe.memory.models import Artifact
from mhe.memory.db import get_session
from mhe.access.schemas import ArtifactOut

router = APIRouter()

@router.get("/{artifact_id}", response_model=ArtifactOut)
async def get_artifact(artifact_id: str, session: AsyncSession = Depends(get_session)):
    res = await session.execute(select(Artifact).where(Artifact.id == artifact_id))
    artifact = res.scalar_one_or_none()
    if not artifact:
        raise HTTPException(status_code=404, detail="Artifact not found")
    return artifact
