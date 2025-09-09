"""Embedding pipeline for Memory Harvester Engine.

This module provides:
- Batch embedding generation with memory-efficient streaming
- HNSW index management for pgvector
- Bulk upsert operations for embeddings
- Caching layer for embedding optimization
"""

from __future__ import annotations
from typing import List, Optional, Dict, Any, Tuple, AsyncGenerator
from datetime import datetime
import asyncio
import hashlib
import logging
from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text, and_
from sqlalchemy.dialects.postgresql import insert

from .models import Message, Embedding, MemoryCard, Artifact
from .db import get_session
from ..llm.clients import get_embedding_client
from ..common.config import settings

logger = logging.getLogger(__name__)

@dataclass
class EmbeddingJob:
    """Represents a single embedding task."""
    target_kind: str  # message|memory_card|artifact
    target_id: str
    content: str
    model: str
    dim: int

@dataclass
class EmbeddingResult:
    """Result of embedding generation."""
    target_kind: str
    target_id: str
    vector: List[float]
    model: str
    dim: int

class EmbeddingPipeline:
    """Memory-efficient embedding pipeline with batch processing."""
    
    def __init__(self, batch_size: int = 500, max_concurrent: int = 10):
        self.batch_size = batch_size
        self.max_concurrent = max_concurrent
        self.embedding_client = get_embedding_client()
        self.model = settings.embed_model or "text-embedding-ada-002"
        self.dim = settings.embed_dim or 1536
    
    async def stream_unembedded_messages(self, db: AsyncSession, batch_size: int = None) -> AsyncGenerator[List[EmbeddingJob], None]:
        """Stream messages that need embeddings in batches."""
        batch_size = batch_size or self.batch_size
        offset = 0
        
        while True:
            # Find messages without embeddings
            query = (
                select(Message)
                .outerjoin(Embedding, and_(
                    Embedding.target_kind == "message",
                    Embedding.target_id == Message.id,
                    Embedding.model == self.model
                ))
                .where(Embedding.id.is_(None))
                .limit(batch_size)
                .offset(offset)
            )
            
            result = await db.execute(query)
            messages = result.scalars().all()
            
            if not messages:
                break
                
            jobs = [
                EmbeddingJob(
                    target_kind="message",
                    target_id=msg.id,
                    content=msg.content,
                    model=self.model,
                    dim=self.dim
                )
                for msg in messages
            ]
            
            yield jobs
            offset += batch_size
    
    async def stream_unembedded_memory_cards(self, db: AsyncSession, batch_size: int = None) -> AsyncGenerator[List[EmbeddingJob], None]:
        """Stream memory cards that need embeddings in batches."""
        batch_size = batch_size or self.batch_size
        offset = 0
        
        while True:
            # Find memory cards without embeddings
            query = (
                select(MemoryCard)
                .outerjoin(Embedding, and_(
                    Embedding.target_kind == "memory_card",
                    Embedding.target_id == MemoryCard.id,
                    Embedding.model == self.model
                ))
                .where(Embedding.id.is_(None))
                .limit(batch_size)
                .offset(offset)
            )
            
            result = await db.execute(query)
            cards = result.scalars().all()
            
            if not cards:
                break
                
            jobs = [
                EmbeddingJob(
                    target_kind="memory_card",
                    target_id=card.id,
                    content=f"{card.title}\n{card.summary}",
                    model=self.model,
                    dim=self.dim
                )
                for card in cards
            ]
            
            yield jobs
            offset += batch_size
    
    async def generate_embeddings_batch(self, jobs: List[EmbeddingJob]) -> List[EmbeddingResult]:
        """Generate embeddings for a batch of jobs."""
        if not jobs:
            return []
        
        try:
            # Extract content for batch embedding
            texts = [job.content for job in jobs]
            
            # Generate embeddings (assuming client supports batch)
            if hasattr(self.embedding_client, 'embed_batch'):
                vectors = await self.embedding_client.embed_batch(texts)
            else:
                # Fallback to individual embedding calls
                vectors = []
                for text in texts:
                    vector = self.embedding_client.embed(text)
                    vectors.append(vector)
            
            # Create results
            results = [
                EmbeddingResult(
                    target_kind=job.target_kind,
                    target_id=job.target_id,
                    vector=vector,
                    model=job.model,
                    dim=job.dim
                )
                for job, vector in zip(jobs, vectors)
            ]
            
            return results
            
        except Exception as e:
            logger.error(f"Failed to generate embeddings for batch: {e}")
            raise
    
    async def bulk_upsert_embeddings(self, db: AsyncSession, results: List[EmbeddingResult]) -> int:
        """Bulk upsert embeddings using optimized PostgreSQL operations."""
        if not results:
            return 0
        
        try:
            # Prepare data for bulk insert
            embedding_data = [
                {
                    "target_kind": result.target_kind,
                    "target_id": result.target_id,
                    "model": result.model,
                    "dim": result.dim,
                    "vector": result.vector,
                    "created_at": datetime.utcnow()
                }
                for result in results
            ]
            
            # Use PostgreSQL UPSERT (ON CONFLICT DO UPDATE)
            stmt = insert(Embedding).values(embedding_data)
            stmt = stmt.on_conflict_do_update(
                index_elements=["target_kind", "target_id", "model"],
                set_={
                    "vector": stmt.excluded.vector,
                    "created_at": stmt.excluded.created_at
                }
            )
            
            await db.execute(stmt)
            await db.commit()
            
            logger.info(f"Successfully upserted {len(results)} embeddings")
            return len(results)
            
        except Exception as e:
            await db.rollback()
            logger.error(f"Failed to bulk upsert embeddings: {e}")
            raise
    
    async def process_embedding_pipeline(self, db: AsyncSession) -> Dict[str, int]:
        """Process the complete embedding pipeline for all content types."""
        stats = {"messages": 0, "memory_cards": 0, "artifacts": 0}
        
        try:
            # Process messages
            async for message_batch in self.stream_unembedded_messages(db):
                results = await self.generate_embeddings_batch(message_batch)
                count = await self.bulk_upsert_embeddings(db, results)
                stats["messages"] += count
                
                # Clear batch from memory
                del message_batch, results
            
            # Process memory cards
            async for card_batch in self.stream_unembedded_memory_cards(db):
                results = await self.generate_embeddings_batch(card_batch)
                count = await self.bulk_upsert_embeddings(db, results)
                stats["memory_cards"] += count
                
                # Clear batch from memory
                del card_batch, results
            
            logger.info(f"Embedding pipeline completed: {stats}")
            return stats
            
        except Exception as e:
            logger.error(f"Embedding pipeline failed: {e}")
            raise

class HNSWIndexManager:
    """Manages HNSW indexes for pgvector embeddings."""
    
    @staticmethod
    async def create_hnsw_index(db: AsyncSession, index_name: str = "idx_embeddings_vector_hnsw") -> None:
        """Create HNSW index for vector similarity search."""
        try:
            # Create HNSW index with optimized parameters
            create_index_sql = f"""
            CREATE INDEX IF NOT EXISTS {index_name}
            ON mhe.embedding 
            USING hnsw (vector vector_cosine_ops)
            WITH (m = 16, ef_construction = 64);
            """
            
            await db.execute(text(create_index_sql))
            await db.commit()
            
            logger.info(f"HNSW index '{index_name}' created successfully")
            
        except Exception as e:
            await db.rollback()
            logger.error(f"Failed to create HNSW index: {e}")
            raise
    
    @staticmethod
    async def optimize_hnsw_index(db: AsyncSession, index_name: str = "idx_embeddings_vector_hnsw") -> None:
        """Optimize HNSW index parameters for better performance."""
        try:
            # Update index parameters for better recall/performance balance
            optimize_sql = f"""
            ALTER INDEX {index_name} SET (ef_search = 40);
            """
            
            await db.execute(text(optimize_sql))
            await db.commit()
            
            logger.info(f"HNSW index '{index_name}' optimized successfully")
            
        except Exception as e:
            await db.rollback()
            logger.error(f"Failed to optimize HNSW index: {e}")
            raise
    
    @staticmethod
    async def get_index_stats(db: AsyncSession, index_name: str = "idx_embeddings_vector_hnsw") -> Dict[str, Any]:
        """Get statistics about the HNSW index."""
        try:
            stats_sql = f"""
            SELECT 
                schemaname,
                tablename,
                indexname,
                num_rows,
                table_size,
                index_size,
                unique,
                clustered
            FROM pg_indexes_size 
            WHERE indexname = '{index_name}';
            """
            
            result = await db.execute(text(stats_sql))
            row = result.fetchone()
            
            if row:
                return dict(row._mapping)
            else:
                return {"error": "Index not found"}
                
        except Exception as e:
            logger.error(f"Failed to get index stats: {e}")
            return {"error": str(e)}

# Convenience functions
async def embed_content_batch(content_list: List[str], target_kind: str = "message") -> List[List[float]]:
    """Convenience function to embed a batch of content."""
    pipeline = EmbeddingPipeline()
    
    jobs = [
        EmbeddingJob(
            target_kind=target_kind,
            target_id=f"temp_{i}",
            content=content,
            model=pipeline.model,
            dim=pipeline.dim
        )
        for i, content in enumerate(content_list)
    ]
    
    results = await pipeline.generate_embeddings_batch(jobs)
    return [result.vector for result in results]

async def setup_embedding_infrastructure(db: AsyncSession) -> None:
    """Set up embedding infrastructure including HNSW indexes."""
    index_manager = HNSWIndexManager()
    await index_manager.create_hnsw_index(db)
    await index_manager.optimize_hnsw_index(db)
    logger.info("Embedding infrastructure setup completed")

async def run_embedding_pipeline() -> Dict[str, int]:
    """Run the complete embedding pipeline."""
    async with get_session() as db:
        pipeline = EmbeddingPipeline()
        return await pipeline.process_embedding_pipeline(db)