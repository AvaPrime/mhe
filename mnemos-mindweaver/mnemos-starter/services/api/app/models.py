
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum, JSON, Float
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship, Mapped, mapped_column
from pgvector.sqlalchemy import Vector
from datetime import datetime
import enum

from .db import Base

class Kind(str, enum.Enum):
    codestone = "codestone"
    codecell = "codecell"
    codeblock = "codeblock"
    fragment = "fragment"

class Strength(str, enum.Enum):
    short = "short"
    medium = "medium"
    long = "long"
    permanent = "permanent"

class Interaction(Base):
    __tablename__ = "interactions"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    actor_type: Mapped[str] = mapped_column(String(32))
    source: Mapped[str] = mapped_column(String(64))
    ts: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    content_json: Mapped[dict] = mapped_column(JSONB)
    sha256: Mapped[str] = mapped_column(String(64), unique=True)
    pii_flag: Mapped[bool] = mapped_column(default=False)
    topic_hint: Mapped[str | None] = mapped_column(String(128), nullable=True)

class MemoryItem(Base):
    __tablename__ = "memory_items"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    kind: Mapped[Kind] = mapped_column(Enum(Kind), index=True)
    title: Mapped[str] = mapped_column(String(256))
    body_md: Mapped[str] = mapped_column(Text)
    meta_json: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_ts: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    strength: Mapped[Strength] = mapped_column(Enum(Strength), default=Strength.medium, index=True)

class Embedding(Base):
    __tablename__ = "embeddings"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("memory_items.id", ondelete="CASCADE"), index=True)
    model: Mapped[str] = mapped_column(String(64))
    dim: Mapped[int] = mapped_column(Integer)
    vec = mapped_column(Vector(1536))  # adjust as needed
    created_ts: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class Reflection(Base):
    __tablename__ = "reflections"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    source_item_id: Mapped[int] = mapped_column(ForeignKey("memory_items.id", ondelete="CASCADE"), index=True)
    summary_md: Mapped[str] = mapped_column(Text)
    insights_md: Mapped[str] = mapped_column(Text)
    tone_json: Mapped[dict] = mapped_column(JSONB, default=dict)
    quality_score: Mapped[float] = mapped_column(Float, default=0.0)
    created_ts: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class Edge(Base):
    __tablename__ = "edges"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    src_id: Mapped[int] = mapped_column(ForeignKey("memory_items.id", ondelete="CASCADE"), index=True)
    dst_id: Mapped[int] = mapped_column(ForeignKey("memory_items.id", ondelete="CASCADE"), index=True)
    rel: Mapped[str] = mapped_column(String(32), index=True)

class Artifact(Base):
    __tablename__ = "artifacts"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("memory_items.id", ondelete="CASCADE"), index=True)
    uri: Mapped[str] = mapped_column(String(512))
    media_type: Mapped[str] = mapped_column(String(64))
    bytes: Mapped[int] = mapped_column(Integer)
    sha256: Mapped[str] = mapped_column(String(64))
