from __future__ import annotations
from datetime import datetime
from typing import Optional, List
from sqlalchemy.orm import declarative_base, relationship, Mapped, mapped_column
from sqlalchemy import (
    String, Text, Integer, ForeignKey, JSON, TIMESTAMP, Enum,
    text, CheckConstraint, ARRAY
)
from sqlalchemy.dialects.postgresql import UUID, CITEXT
from pgvector.sqlalchemy import Vector

Base = declarative_base()

# --- Lookup: assistant
class Assistant(Base):
    __tablename__ = "assistant"
    __table_args__ = {"schema": "mhe"}

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, server_default=text("gen_random_uuid()"))
    name: Mapped[str] = mapped_column(CITEXT, nullable=False)
    version: Mapped[Optional[str]] = mapped_column(String, nullable=True)


class Thread(Base):
    __tablename__ = "thread"
    __table_args__ = {"schema": "mhe"}

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, server_default=text("gen_random_uuid()"))
    external_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    assistant_id: Mapped[Optional[str]] = mapped_column(UUID(as_uuid=False), ForeignKey("mhe.assistant.id", ondelete="SET NULL"))
    title: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)
    ended_at: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP(timezone=True))
    raw_meta: Mapped[dict] = mapped_column(JSON, server_default=text("'{}'::jsonb"))

    messages: Mapped[List["Message"]] = relationship(back_populates="thread", cascade="all, delete-orphan")


class Message(Base):
    __tablename__ = "message"
    __table_args__ = (
        CheckConstraint("role in ('user','assistant','system')", name="ck_role"),
        {"schema": "mhe"}
    )

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, server_default=text("gen_random_uuid()"))
    thread_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("mhe.thread.id", ondelete="CASCADE"), nullable=False)
    role: Mapped[str] = mapped_column(String, nullable=False)
    author: Mapped[Optional[str]] = mapped_column(Text)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    content_md: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)
    tokens: Mapped[Optional[int]] = mapped_column(Integer)
    raw_meta: Mapped[dict] = mapped_column(JSON, server_default=text("'{}'::jsonb"))

    thread: Mapped["Thread"] = relationship(back_populates="messages")
    artifacts: Mapped[List["Artifact"]] = relationship(back_populates="message", cascade="all, delete-orphan")


class Artifact(Base):
    __tablename__ = "artifact"
    __table_args__ = {"schema": "mhe"}

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, server_default=text("gen_random_uuid()"))
    message_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("mhe.message.id", ondelete="CASCADE"), nullable=False)
    kind: Mapped[str] = mapped_column(String, nullable=False)  # code|doc|list|diagram|other
    language: Mapped[Optional[str]] = mapped_column(String)
    mime_type: Mapped[Optional[str]] = mapped_column(String)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    sha256: Mapped[str] = mapped_column(String, nullable=False, index=True)
    line_start: Mapped[Optional[int]] = mapped_column(Integer)
    line_end: Mapped[Optional[int]] = mapped_column(Integer)
    extracted_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=text("now()"))

    message: Mapped["Message"] = relationship(back_populates="artifacts")


class MemoryCard(Base):
    __tablename__ = "memory_card"
    __table_args__ = {"schema": "mhe"}

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, server_default=text("gen_random_uuid()"))
    thread_id: Mapped[Optional[str]] = mapped_column(UUID(as_uuid=False), ForeignKey("mhe.thread.id", ondelete="SET NULL"))
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    rationale: Mapped[Optional[str]] = mapped_column(Text)
    created_from: Mapped[dict] = mapped_column(JSON, nullable=False)
    tags: Mapped[Optional[list[str]]] = mapped_column(ARRAY(String), default=list)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=text("now()"))


from sqlalchemy import Enum as PgEnum
from sqlalchemy import TypeDecorator
from sqlalchemy import select

class EmbedTarget(TypeDecorator):
    impl = String
    cache_ok = True
    def process_bind_param(self, value, dialect):
        if value not in {"message","artifact","memory_card"}:
            raise ValueError("invalid embed target")
        return value

class Embedding(Base):
    __tablename__ = "embedding"
    __table_args__ = {"schema": "mhe"}

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, server_default=text("gen_random_uuid()"))
    target_kind: Mapped[str] = mapped_column(String, nullable=False)  # message|artifact|memory_card
    target_id: Mapped[str] = mapped_column(UUID(as_uuid=False), nullable=False)
    model: Mapped[str] = mapped_column(String, nullable=False)
    dim: Mapped[int] = mapped_column(Integer, nullable=False)
    vector: Mapped["Vector"] = mapped_column(Vector())
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=text("now()"))


class Tag(Base):
    __tablename__ = "tag"
    __table_args__ = {"schema": "mhe"}

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, server_default=text("gen_random_uuid()"))
    name: Mapped[str] = mapped_column(CITEXT, unique=True, nullable=False)


class MessageTag(Base):
    __tablename__ = "message_tag"
    __table_args__ = {"schema": "mhe"}

    message_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("mhe.message.id", ondelete="CASCADE"), primary_key=True)
    tag_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("mhe.tag.id", ondelete="CASCADE"), primary_key=True)


class Consolidation(Base):
    __tablename__ = "consolidation"
    __table_args__ = {"schema": "mhe"}

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, server_default=text("gen_random_uuid()"))
    window_start: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)
    window_end: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)
    report_md: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=text("now()"))
