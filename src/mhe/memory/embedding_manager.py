"""Embedding management commands for Memory Harvester Engine.

This module provides CLI commands and utilities for:
- Running embedding pipelines
- Managing HNSW indexes
- Monitoring embedding progress
- Batch processing operations
"""

from __future__ import annotations
import asyncio
import logging
import time
from typing import Dict, Any, Optional
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text

from .embeddings import EmbeddingPipeline, HNSWIndexManager, setup_embedding_infrastructure
from .models import Message, MemoryCard, Embedding
from .db import get_session
from ..common.config import settings

logger = logging.getLogger(__name__)

class EmbeddingManager:
    """High-level embedding management interface."""
    
    def __init__(self):
        self.pipeline = EmbeddingPipeline(
            batch_size=getattr(settings, 'embedding_batch_size', 500),
            max_concurrent=getattr(settings, 'embedding_max_concurrent', 10)
        )
        self.index_manager = HNSWIndexManager()
    
    async def get_embedding_stats(self, db: AsyncSession) -> Dict[str, Any]:
        """Get comprehensive embedding statistics."""
        try:
            # Count total messages and embedded messages
            total_messages_result = await db.execute(select(func.count(Message.id)))
            total_messages = total_messages_result.scalar() or 0
            
            embedded_messages_result = await db.execute(
                select(func.count(Embedding.id))
                .where(Embedding.target_kind == "message")
            )
            embedded_messages = embedded_messages_result.scalar() or 0
            
            # Count total memory cards and embedded cards
            total_cards_result = await db.execute(select(func.count(MemoryCard.id)))
            total_cards = total_cards_result.scalar() or 0
            
            embedded_cards_result = await db.execute(
                select(func.count(Embedding.id))
                .where(Embedding.target_kind == "memory_card")
            )
            embedded_cards = embedded_cards_result.scalar() or 0
            
            # Get embedding model distribution
            model_stats_result = await db.execute(
                select(Embedding.model, func.count(Embedding.id))
                .group_by(Embedding.model)
            )
            model_stats = dict(model_stats_result.fetchall())
            
            # Calculate completion percentages
            message_completion = (embedded_messages / total_messages * 100) if total_messages > 0 else 0
            card_completion = (embedded_cards / total_cards * 100) if total_cards > 0 else 0
            
            return {
                "messages": {
                    "total": total_messages,
                    "embedded": embedded_messages,
                    "pending": total_messages - embedded_messages,
                    "completion_percent": round(message_completion, 2)
                },
                "memory_cards": {
                    "total": total_cards,
                    "embedded": embedded_cards,
                    "pending": total_cards - embedded_cards,
                    "completion_percent": round(card_completion, 2)
                },
                "models": model_stats,
                "total_embeddings": embedded_messages + embedded_cards
            }
            
        except Exception as e:
            logger.error(f"Failed to get embedding stats: {e}")
            raise
    
    async def run_full_pipeline(self, progress_callback: Optional[callable] = None) -> Dict[str, Any]:
        """Run the complete embedding pipeline with progress tracking."""
        start_time = time.time()
        
        try:
            async with get_session() as db:
                # Get initial stats
                initial_stats = await self.get_embedding_stats(db)
                
                if progress_callback:
                    progress_callback("Starting embedding pipeline...", initial_stats)
                
                # Run the pipeline
                processing_stats = await self.pipeline.process_embedding_pipeline(db)
                
                # Get final stats
                final_stats = await self.get_embedding_stats(db)
                
                end_time = time.time()
                duration = end_time - start_time
                
                result = {
                    "success": True,
                    "duration_seconds": round(duration, 2),
                    "processed": processing_stats,
                    "initial_stats": initial_stats,
                    "final_stats": final_stats,
                    "timestamp": datetime.utcnow().isoformat()
                }
                
                if progress_callback:
                    progress_callback("Pipeline completed successfully!", result)
                
                return result
                
        except Exception as e:
            logger.error(f"Embedding pipeline failed: {e}")
            if progress_callback:
                progress_callback(f"Pipeline failed: {e}", {"error": str(e)})
            raise
    
    async def setup_infrastructure(self) -> Dict[str, Any]:
        """Set up embedding infrastructure including indexes."""
        try:
            async with get_session() as db:
                await setup_embedding_infrastructure(db)
                
                # Get index stats
                index_stats = await self.index_manager.get_index_stats(db)
                
                return {
                    "success": True,
                    "message": "Embedding infrastructure setup completed",
                    "index_stats": index_stats,
                    "timestamp": datetime.utcnow().isoformat()
                }
                
        except Exception as e:
            logger.error(f"Infrastructure setup failed: {e}")
            return {
                "success": False,
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }
    
    async def optimize_indexes(self) -> Dict[str, Any]:
        """Optimize HNSW indexes for better performance."""
        try:
            async with get_session() as db:
                await self.index_manager.optimize_hnsw_index(db)
                
                # Get updated index stats
                index_stats = await self.index_manager.get_index_stats(db)
                
                return {
                    "success": True,
                    "message": "HNSW indexes optimized successfully",
                    "index_stats": index_stats,
                    "timestamp": datetime.utcnow().isoformat()
                }
                
        except Exception as e:
            logger.error(f"Index optimization failed: {e}")
            return {
                "success": False,
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }
    
    async def process_batch(self, target_kind: str, batch_size: int = None) -> Dict[str, Any]:
        """Process a single batch of embeddings for a specific target type."""
        batch_size = batch_size or self.pipeline.batch_size
        
        try:
            async with get_session() as db:
                if target_kind == "message":
                    async for batch in self.pipeline.stream_unembedded_messages(db, batch_size):
                        results = await self.pipeline.generate_embeddings_batch(batch)
                        count = await self.pipeline.bulk_upsert_embeddings(db, results)
                        return {
                            "success": True,
                            "processed": count,
                            "target_kind": target_kind,
                            "batch_size": len(batch)
                        }
                elif target_kind == "memory_card":
                    async for batch in self.pipeline.stream_unembedded_memory_cards(db, batch_size):
                        results = await self.pipeline.generate_embeddings_batch(batch)
                        count = await self.pipeline.bulk_upsert_embeddings(db, results)
                        return {
                            "success": True,
                            "processed": count,
                            "target_kind": target_kind,
                            "batch_size": len(batch)
                        }
                
                # No batches to process
                return {
                    "success": True,
                    "processed": 0,
                    "target_kind": target_kind,
                    "message": "No items to process"
                }
                
        except Exception as e:
            logger.error(f"Batch processing failed: {e}")
            return {
                "success": False,
                "error": str(e),
                "target_kind": target_kind
            }

# CLI-style functions for direct usage
async def run_embedding_pipeline(verbose: bool = True) -> Dict[str, Any]:
    """Run the complete embedding pipeline."""
    manager = EmbeddingManager()
    
    def progress_callback(message: str, data: Dict[str, Any]):
        if verbose:
            print(f"[{datetime.now().strftime('%H:%M:%S')}] {message}")
            if "processed" in data:
                print(f"  Processed: {data['processed']}")
    
    return await manager.run_full_pipeline(progress_callback if verbose else None)

async def setup_embedding_infrastructure_cli() -> Dict[str, Any]:
    """Set up embedding infrastructure via CLI."""
    manager = EmbeddingManager()
    return await manager.setup_infrastructure()

async def get_embedding_status() -> Dict[str, Any]:
    """Get current embedding status."""
    manager = EmbeddingManager()
    async with get_session() as db:
        return await manager.get_embedding_stats(db)

async def optimize_embedding_indexes() -> Dict[str, Any]:
    """Optimize embedding indexes."""
    manager = EmbeddingManager()
    return await manager.optimize_indexes()

# Main CLI entry point
if __name__ == "__main__":
    import sys
    
    async def main():
        if len(sys.argv) < 2:
            print("Usage: python -m mhe.memory.embedding_manager <command>")
            print("Commands: run, setup, status, optimize")
            return
        
        command = sys.argv[1].lower()
        
        if command == "run":
            result = await run_embedding_pipeline()
            print(f"Pipeline result: {result}")
        elif command == "setup":
            result = await setup_embedding_infrastructure_cli()
            print(f"Setup result: {result}")
        elif command == "status":
            result = await get_embedding_status()
            print(f"Status: {result}")
        elif command == "optimize":
            result = await optimize_embedding_indexes()
            print(f"Optimization result: {result}")
        else:
            print(f"Unknown command: {command}")
    
    asyncio.run(main())