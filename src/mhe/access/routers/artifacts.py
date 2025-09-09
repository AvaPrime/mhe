
from __future__ import annotations
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from mhe.memory.db import get_session
from mhe.memory.models import Artifact
from mhe.access.schemas import ArtifactOut

router = APIRouter()

@router.get("/{artifact_id}", response_model=ArtifactOut)
async def get_artifact(artifact_id: str, session: AsyncSession = Depends(get_session)) -> ArtifactOut:
    stmt = select(Artifact).where(Artifact.id == artifact_id)
    res = await session.execute(stmt)
    obj = res.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Artifact not found")
    return ArtifactOut.model_validate(obj)
