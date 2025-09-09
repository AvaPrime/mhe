"""Search API endpoints for Memory Harvester Engine.

This module provides search functionality including:
- Text-based search across messages and memory cards
- Vector similarity search using embeddings
- Hybrid search combining text and semantic similarity
- Cross-assistant search capabilities
"""

from __future__ import annotations
from typing import List, Optional, Dict, Any, Union
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_, func, text

from ...memory.db import get_session
from ...memory.models import Message, Thread, Assistant, MemoryCard, Embedding, Artifact
from ...memory.embedding_manager import EmbeddingManager
from ...llm.clients import get_generative_client
from ..error_handling import (
    handle_api_errors, InputValidator, ValidationError, NotFoundError,
    ExternalServiceError, DatabaseError, validate_pagination
)

router = APIRouter(prefix="/search", tags=["search"])


class SearchQuery(BaseModel):
    """Search query parameters."""
    query: str = Field(..., description="Search query text")
    limit: int = Field(default=20, ge=1, le=100, description="Maximum number of results")
    offset: int = Field(default=0, ge=0, description="Offset for pagination")
    assistant_filter: Optional[List[str]] = Field(default=None, description="Filter by assistant names")
    date_from: Optional[datetime] = Field(default=None, description="Filter messages from this date")
    date_to: Optional[datetime] = Field(default=None, description="Filter messages to this date")
    include_artifacts: bool = Field(default=True, description="Include artifacts in results")
    include_memory_cards: bool = Field(default=True, description="Include memory cards in results")


class VectorSearchQuery(BaseModel):
    """Vector similarity search parameters."""
    query: str = Field(..., description="Query text for embedding")
    similarity_threshold: float = Field(default=0.7, ge=0.0, le=1.0, description="Minimum similarity score")
    limit: int = Field(default=20, ge=1, le=100, description="Maximum number of results")
    assistant_filter: Optional[List[str]] = Field(default=None, description="Filter by assistant names")


class HybridSearchQuery(BaseModel):
    """Hybrid search combining text and vector similarity."""
    query: str = Field(..., description="Search query text")
    text_weight: float = Field(default=0.3, ge=0.0, le=1.0, description="Weight for text search")
    vector_weight: float = Field(default=0.7, ge=0.0, le=1.0, description="Weight for vector search")
    limit: int = Field(default=20, ge=1, le=100, description="Maximum number of results")
    assistant_filter: Optional[List[str]] = Field(default=None, description="Filter by assistant names")


class RAGQuery(BaseModel):
    """RAG query parameters for retrieval-augmented generation."""
    query: str = Field(..., description="User question or query")
    max_context_tokens: int = Field(default=4000, ge=500, le=8000, description="Maximum tokens for context")
    max_results: int = Field(default=10, ge=1, le=50, description="Maximum search results to consider")
    assistant_filter: Optional[List[str]] = Field(default=None, description="Filter by assistant names")
    include_conversation_context: bool = Field(default=True, description="Include surrounding conversation context")
    temperature: float = Field(default=0.7, ge=0.0, le=2.0, description="LLM generation temperature")


class RAGContext(BaseModel):
    """Individual context item for RAG."""
    source_id: str
    source_type: str  # 'message', 'memory_card', 'artifact'
    content: str
    assistant_name: str
    thread_title: str
    timestamp: datetime
    relevance_score: float


class RAGResponse(BaseModel):
    """RAG response with generated answer and sources."""
    answer: str
    query: str
    contexts: List[RAGContext]
    total_context_tokens: int
    generation_time_ms: float
    sources_count: int


class SearchResult(BaseModel):
    """Individual search result."""
    id: str
    type: str  # 'message', 'memory_card', 'artifact'
    content: str
    title: Optional[str] = None
    score: float
    timestamp: datetime
    assistant_name: str
    thread_title: str
    metadata: Dict[str, Any] = {}


class SearchResponse(BaseModel):
    """Search response with results and metadata."""
    results: List[SearchResult]
    total_count: int
    query: str
    search_type: str
    execution_time_ms: float


@router.post("/text", response_model=SearchResponse)
@handle_api_errors
async def text_search(
    search_query: SearchQuery,
    session: Session = Depends(get_session)
) -> SearchResponse:
    """Perform text-based search across messages and memory cards.
    
    Args:
        search_query: Search parameters including query text and filters
        session: Database session
    
    Returns:
        SearchResponse with matching results
    """
    start_time = datetime.now()
    
    # Validate search query
    validated_query = InputValidator.validate_search_query(search_query.query)
    
    # Validate pagination
    offset, limit = validate_pagination(search_query.offset, search_query.limit)
    
    # Validate assistant filter
    assistant_filter = None
    if search_query.assistant_filter:
        assistant_filter = InputValidator.validate_list(
            search_query.assistant_filter,
            "assistant_filter",
            max_length=20,
            item_validator=lambda x: InputValidator.validate_string(
                x, "assistant_name", min_length=1, max_length=100
            )
        )
    
    try:
        # Build base query for messages
        message_query = session.query(Message).join(Thread).join(Assistant)
        
        # Add text search filter
        search_terms = validated_query.lower().split()
        text_conditions = []
        for term in search_terms:
            text_conditions.append(
                or_(
                    func.lower(Message.content).contains(term),
                    func.lower(Thread.title).contains(term)
                )
            )
        
        if text_conditions:
            message_query = message_query.filter(and_(*text_conditions))
        
        # Apply filters
        if assistant_filter:
            message_query = message_query.filter(Assistant.name.in_(assistant_filter))
        
        if search_query.date_from:
            message_query = message_query.filter(Message.timestamp >= search_query.date_from)
        
        if search_query.date_to:
            message_query = message_query.filter(Message.timestamp <= search_query.date_to)
        
        # Load related data
        message_query = message_query.options(
            joinedload(Message.thread).joinedload(Thread.assistant),
            joinedload(Message.artifacts) if search_query.include_artifacts else None
        ).filter(message_query.whereclause is not None)
        
        # Get total count
        total_messages = message_query.count()
        
        # Apply pagination
        messages = message_query.offset(offset).limit(limit).all()
        
        # Convert to search results
        results = []
        for message in messages:
            # Calculate simple relevance score based on term frequency
            content_lower = message.content.lower()
            score = sum(content_lower.count(term) for term in search_terms) / len(search_terms)
            score = min(score / 10.0, 1.0)  # Normalize to 0-1
            
            results.append(SearchResult(
                id=message.id,
                type="message",
                content=message.content[:500] + "..." if len(message.content) > 500 else message.content,
                score=score,
                timestamp=message.timestamp,
                assistant_name=message.thread.assistant.name,
                thread_title=message.thread.title,
                metadata={
                    "thread_id": message.thread_id,
                    "role": message.role,
                    "artifact_count": len(message.artifacts) if message.artifacts else 0
                }
            ))
            
            # Add artifacts if requested
            if search_query.include_artifacts and message.artifacts:
                for artifact in message.artifacts:
                    if any(term in artifact.content.lower() for term in search_terms):
                        artifact_score = sum(artifact.content.lower().count(term) for term in search_terms) / len(search_terms)
                        artifact_score = min(artifact_score / 10.0, 1.0)
                        
                        results.append(SearchResult(
                            id=artifact.id,
                            type="artifact",
                            content=artifact.content[:500] + "..." if len(artifact.content) > 500 else artifact.content,
                            title=artifact.title,
                            score=artifact_score,
                            timestamp=message.timestamp,
                            assistant_name=message.thread.assistant.name,
                            thread_title=message.thread.title,
                            metadata={
                                "message_id": message.id,
                                "artifact_type": artifact.type,
                                "language": artifact.language
                            }
                        ))
        
        # Search memory cards if requested
        if search_query.include_memory_cards:
            memory_card_query = session.query(MemoryCard).join(Message).join(Thread).join(Assistant)
            
            # Add text search for memory cards
            memory_text_conditions = []
            for term in search_terms:
                memory_text_conditions.append(
                    or_(
                        func.lower(MemoryCard.content_summary).contains(term),
                        func.lower(MemoryCard.key_concepts.cast(text)).contains(term)
                    )
                )
            
            if memory_text_conditions:
                memory_card_query = memory_card_query.filter(and_(*memory_text_conditions))
            
            # Apply same filters
            if assistant_filter:
                memory_card_query = memory_card_query.filter(Assistant.name.in_(assistant_filter))
            
            memory_cards = memory_card_query.options(
                joinedload(MemoryCard.message).joinedload(Message.thread).joinedload(Thread.assistant)
            ).limit(limit // 2).all()  # Reserve half the results for memory cards
            
            for card in memory_cards:
                card_score = sum(card.content_summary.lower().count(term) for term in search_terms) / len(search_terms)
                card_score = min(card_score / 10.0, 1.0)
                
                results.append(SearchResult(
                    id=card.id,
                    type="memory_card",
                    content=card.content_summary,
                    score=card_score * card.importance_score,  # Weight by importance
                    timestamp=card.message.timestamp,
                    assistant_name=card.message.thread.assistant.name,
                    thread_title=card.message.thread.title,
                    metadata={
                        "message_id": card.message_id,
                        "importance_score": card.importance_score,
                        "key_concepts": card.key_concepts[:5]  # Top 5 concepts
                    }
                ))
        
        # Sort by score descending
        results.sort(key=lambda x: x.score, reverse=True)
        
        # Apply final limit
        results = results[:limit]
        
        execution_time = (datetime.now() - start_time).total_seconds() * 1000
        
        return SearchResponse(
            results=results,
            total_count=len(results),
            query=validated_query,
            search_type="text",
            execution_time_ms=execution_time
        )
        
    except Exception as e:
        raise DatabaseError(
            f"Text search operation failed: {str(e)}",
            operation="text_search"
        )


@router.post("/vector", response_model=SearchResponse)
@handle_api_errors
async def vector_search(
    search_query: VectorSearchQuery,
    session: Session = Depends(get_session)
) -> SearchResponse:
    """Perform vector similarity search using embeddings.
    
    Args:
        search_query: Vector search parameters
        session: Database session
    
    Returns:
        SearchResponse with semantically similar results
    """
    start_time = datetime.now()
    
    # Validate search query
    validated_query = InputValidator.validate_search_query(search_query.query)
    
    # Validate similarity threshold
    similarity_threshold = InputValidator.validate_float(
        search_query.similarity_threshold,
        "similarity_threshold",
        min_value=0.0,
        max_value=1.0
    )
    
    # Validate assistant filter
    assistant_filter = None
    if search_query.assistant_filter:
        assistant_filter = InputValidator.validate_list(
            search_query.assistant_filter,
            "assistant_filter",
            max_length=20,
            item_validator=lambda x: InputValidator.validate_string(
                x, "assistant_name", min_length=1, max_length=100
            )
        )
    
    try:
        # TODO: Implement actual vector similarity search
        # This is a placeholder implementation
        # In a real implementation, you would:
        # 1. Generate embedding for the query text
        # 2. Perform similarity search against stored embeddings
        # 3. Return results ranked by similarity score
        
        # For now, fall back to text search
        text_query = SearchQuery(
            query=validated_query,
            limit=search_query.limit,
            assistant_filter=assistant_filter
        )
        
        response = await text_search(text_query, session)
        response.search_type = "vector_fallback"
        
        # Filter by similarity threshold (mock implementation)
        response.results = [r for r in response.results if r.score >= similarity_threshold]
        response.total_count = len(response.results)
        
        return response
        
    except Exception as e:
        raise ExternalServiceError(
            "embedding_service",
            f"Vector search operation failed: {str(e)}"
        )


@router.post("/hybrid", response_model=SearchResponse)
@handle_api_errors
async def hybrid_search(
    search_query: HybridSearchQuery,
    session: Session = Depends(get_session)
) -> SearchResponse:
    """Perform hybrid search combining text and vector similarity.
    
    Args:
        search_query: Hybrid search parameters
        session: Database session
    
    Returns:
        SearchResponse with combined text and semantic results
    """
    start_time = datetime.now()
    
    # Validate search query
    validated_query = InputValidator.validate_search_query(search_query.query)
    
    # Validate weights
    text_weight = InputValidator.validate_float(
        search_query.text_weight,
        "text_weight",
        min_value=0.0,
        max_value=1.0
    )
    
    vector_weight = InputValidator.validate_float(
        search_query.vector_weight,
        "vector_weight",
        min_value=0.0,
        max_value=1.0
    )
    
    # Validate that weights sum to reasonable value
    if abs(text_weight + vector_weight - 1.0) > 0.01:
        raise ValidationError(
            "text_weight and vector_weight should sum to 1.0",
            field="weights",
            value=f"text: {text_weight}, vector: {vector_weight}"
        )
    
    # Validate assistant filter
    assistant_filter = None
    if search_query.assistant_filter:
        assistant_filter = InputValidator.validate_list(
            search_query.assistant_filter,
            "assistant_filter",
            max_length=20,
            item_validator=lambda x: InputValidator.validate_string(
                x, "assistant_name", min_length=1, max_length=100
            )
        )
    
    try:
        # Perform text search
        text_query = SearchQuery(
            query=validated_query,
            limit=search_query.limit * 2,  # Get more results for combining
            assistant_filter=assistant_filter
        )
        text_response = await text_search(text_query, session)
        
        # Perform vector search
        vector_query = VectorSearchQuery(
            query=validated_query,
            limit=search_query.limit * 2,
            assistant_filter=assistant_filter,
            similarity_threshold=0.5  # Lower threshold for hybrid
        )
        vector_response = await vector_search(vector_query, session)
        
        # Combine and reweight results
        combined_results = {}
        
        # Add text results with text weight
        for result in text_response.results:
            result.score *= text_weight
            combined_results[result.id] = result
        
        # Add vector results with vector weight, combining scores if duplicate
        for result in vector_response.results:
            result.score *= vector_weight
            if result.id in combined_results:
                # Combine scores
                combined_results[result.id].score += result.score
            else:
                combined_results[result.id] = result
        
        # Sort by combined score and apply limit
        final_results = sorted(combined_results.values(), key=lambda x: x.score, reverse=True)
        final_results = final_results[:search_query.limit]
        
        execution_time = (datetime.now() - start_time).total_seconds() * 1000
        
        return SearchResponse(
            results=final_results,
            total_count=len(final_results),
            query=validated_query,
            search_type="hybrid",
            execution_time_ms=execution_time
        )
        
    except Exception as e:
        raise ExternalServiceError(
            "search_engine",
            f"Hybrid search operation failed: {str(e)}"
        )


@router.get("/suggestions")
@handle_api_errors
async def get_search_suggestions(
    q: str = Query(..., description="Partial query for suggestions"),
    limit: int = Query(default=10, ge=1, le=20, description="Maximum suggestions"),
    session: Session = Depends(get_session)
) -> Dict[str, List[str]]:
    """Get search suggestions based on partial query.
    
    Args:
        q: Partial query string
        limit: Maximum number of suggestions
        session: Database session
    
    Returns:
        Dictionary with suggestion categories
    """
    # Validate query parameter
    validated_query = InputValidator.validate_string(
        q,
        "query",
        min_length=1,
        max_length=100,
        allow_empty=False
    )
    
    # Validate limit
    validated_limit = InputValidator.validate_integer(
        limit,
        "limit",
        min_value=1,
        max_value=50
    )
    
    try:
        suggestions = {
            "threads": [],
            "concepts": [],
            "assistants": []
        }
        
        # Get thread title suggestions
        thread_suggestions = session.query(Thread.title).filter(
            func.lower(Thread.title).contains(validated_query.lower())
        ).limit(validated_limit // 3).all()
        suggestions["threads"] = [t[0] for t in thread_suggestions]
        
        # Get assistant name suggestions
        assistant_suggestions = session.query(Assistant.name).filter(
            func.lower(Assistant.name).contains(validated_query.lower())
        ).limit(validated_limit // 3).all()
        suggestions["assistants"] = [a[0] for a in assistant_suggestions]
        
        # Get concept suggestions from memory cards
        # This is a simplified implementation
        concept_suggestions = session.query(MemoryCard.key_concepts).limit(100).all()
        all_concepts = []
        for concepts_list in concept_suggestions:
            if concepts_list[0]:  # Check if not None
                all_concepts.extend(concepts_list[0])
        
        # Filter concepts that match query
        matching_concepts = [c for c in set(all_concepts) if validated_query.lower() in c.lower()]
        suggestions["concepts"] = matching_concepts[:validated_limit // 3]
        
        return suggestions
        
    except Exception as e:
        raise DatabaseError(
            f"Failed to generate search suggestions: {str(e)}",
            operation="search_suggestions"
        )


@router.get("/stats")
@handle_api_errors
async def get_search_stats(
    session: Session = Depends(get_session)
) -> Dict[str, Any]:
    """Get search-related statistics.
    
    Args:
        session: Database session
    
    Returns:
        Dictionary with search statistics
    """
    try:
        stats = {
            "total_messages": session.query(Message).count(),
            "total_threads": session.query(Thread).count(),
            "total_assistants": session.query(Assistant).count(),
            "total_memory_cards": session.query(MemoryCard).count(),
            "total_artifacts": session.query(Artifact).count(),
            "total_embeddings": session.query(Embedding).count() if session.query(Embedding).first() else 0,
            "assistants": [
                {
                    "name": assistant.name,
                    "provider": assistant.provider,
                    "message_count": session.query(Message).join(Thread).filter(Thread.assistant_id == assistant.id).count()
                }
                for assistant in session.query(Assistant).all()
            ]
        }
        
        return stats
        
    except Exception as e:
        raise DatabaseError(
            f"Failed to retrieve search statistics: {str(e)}",
            operation="search_stats"
        )


@router.post("/rag", response_model=RAGResponse)
@handle_api_errors
async def rag_query(
    rag_query: RAGQuery,
    session: Session = Depends(get_session)
) -> RAGResponse:
    """Perform retrieval-augmented generation query.
    
    This endpoint combines semantic search with LLM generation to provide
    contextual answers based on the user's conversation history.
    
    Args:
        rag_query: RAG query parameters
        session: Database session
    
    Returns:
        RAGResponse with generated answer and source contexts
    """
    start_time = datetime.now()
    
    # Validate RAG query parameters
    validated_query = InputValidator.validate_search_query(rag_query.query)
    
    validated_max_context_tokens = InputValidator.validate_integer(
        rag_query.max_context_tokens,
        "max_context_tokens",
        min_value=500,
        max_value=8000
    )
    
    validated_max_results = InputValidator.validate_integer(
        rag_query.max_results,
        "max_results",
        min_value=1,
        max_value=50
    )
    
    validated_temperature = InputValidator.validate_float(
        rag_query.temperature,
        "temperature",
        min_value=0.0,
        max_value=2.0
    )
    
    # Validate assistant filter
    assistant_filter = None
    if rag_query.assistant_filter:
        assistant_filter = InputValidator.validate_list(
            rag_query.assistant_filter,
            "assistant_filter",
            max_length=20,
            item_validator=lambda x: InputValidator.validate_string(
                x, "assistant_name", min_length=1, max_length=100
            )
        )
    
    try:
        # Step 1: Perform hybrid search to get relevant contexts
        search_query = HybridSearchQuery(
            query=validated_query,
            limit=validated_max_results,
            assistant_filter=assistant_filter
        )
        
        # Use existing hybrid search logic (simplified version)
        message_query = session.query(Message).join(Thread).join(Assistant)
        
        # Add text search filter
        search_terms = validated_query.lower().split()
        text_conditions = []
        for term in search_terms:
            text_conditions.append(
                or_(
                    func.lower(Message.content).contains(term),
                    func.lower(Thread.title).contains(term)
                )
            )
        
        if text_conditions:
            message_query = message_query.filter(and_(*text_conditions))
        
        # Apply assistant filter
        if assistant_filter:
            message_query = message_query.filter(Assistant.name.in_(assistant_filter))
        
        # Load related data and get results
        message_query = message_query.options(
            joinedload(Message.thread).joinedload(Thread.assistant)
        )
        
        messages = message_query.limit(validated_max_results).all()
        
        # Step 2: Build contexts with conversation threading
        contexts = []
        total_tokens = 0
        
        for message in messages:
            # Calculate relevance score (simplified)
            content_lower = message.content.lower()
            score = sum(content_lower.count(term) for term in search_terms) / len(search_terms)
            score = min(score / 10.0, 1.0)  # Normalize to 0-1
            
            # Get conversation context if requested
            content = message.content
            if rag_query.include_conversation_context:
                # Get previous and next messages in the same thread
                prev_message = session.query(Message).filter(
                    Message.thread_id == message.thread_id,
                    Message.timestamp < message.timestamp
                ).order_by(Message.timestamp.desc()).first()
                
                next_message = session.query(Message).filter(
                    Message.thread_id == message.thread_id,
                    Message.timestamp > message.timestamp
                ).order_by(Message.timestamp.asc()).first()
                
                # Build threaded context
                context_parts = []
                if prev_message:
                    context_parts.append(f"[Previous] {prev_message.role}: {prev_message.content[:200]}...")
                context_parts.append(f"[Current] {message.role}: {message.content}")
                if next_message:
                    context_parts.append(f"[Next] {next_message.role}: {next_message.content[:200]}...")
                
                content = "\n".join(context_parts)
            
            # Estimate token count (rough approximation: 1 token ≈ 4 characters)
            estimated_tokens = len(content) // 4
            
            # Check if adding this context would exceed token limit
            if total_tokens + estimated_tokens > validated_max_context_tokens:
                break
            
            contexts.append(RAGContext(
                source_id=message.id,
                source_type="message",
                content=content,
                assistant_name=message.thread.assistant.name,
                thread_title=message.thread.title,
                timestamp=message.timestamp,
                relevance_score=score
            ))
            
            total_tokens += estimated_tokens
        
        # Step 3: Generate LLM response using contexts
        generative_client = get_generative_client()
        
        # Build prompt with contexts
        context_text = "\n\n".join([
            f"Source: {ctx.assistant_name} - {ctx.thread_title} ({ctx.timestamp})\n{ctx.content}"
            for ctx in contexts
        ])
        
        prompt = f"""Based on the following conversation contexts, please answer the user's question.

User Question: {rag_query.query}

Relevant Contexts:
{context_text}

Please provide a comprehensive answer based on the contexts above. If the contexts don't contain enough information to fully answer the question, please indicate what additional information might be needed."""
        
        # Generate answer
        answer = await generative_client.summarize(prompt)
        
        # Calculate execution time
        end_time = datetime.now()
        execution_time_ms = (end_time - start_time).total_seconds() * 1000
        
        return RAGResponse(
            answer=answer,
            query=validated_query,
            contexts=contexts,
            total_context_tokens=total_tokens,
            generation_time_ms=execution_time_ms,
            sources_count=len(contexts)
        )
        
    except Exception as e:
        raise ExternalServiceError(
            "llm_service",
            f"RAG query operation failed: {str(e)}"
        )


# Embedding Management Endpoints

@router.get("/embeddings/status")
@handle_api_errors
async def get_embedding_status(db: Session = Depends(get_session)):
    """Get current embedding pipeline status and statistics."""
    try:
        manager = EmbeddingManager()
        stats = await manager.get_embedding_stats(db)
        return {
            "status": "success",
            "data": stats
        }
    except Exception as e:
        raise ExternalServiceError(
            "embedding_service",
            f"Failed to get embedding status: {str(e)}"
        )


@router.post("/embeddings/run")
@handle_api_errors
async def run_embedding_pipeline(
    batch_size: Optional[int] = Query(None, description="Batch size for processing"),
    target_kind: Optional[str] = Query(None, description="Target type: message, memory_card, or all")
):
    """Run the embedding pipeline to process unembedded content."""
    # Validate batch_size if provided
    validated_batch_size = None
    if batch_size is not None:
        validated_batch_size = InputValidator.validate_integer(
            batch_size,
            "batch_size",
            min_value=1,
            max_value=1000
        )
    
    # Validate target_kind if provided
    validated_target_kind = target_kind
    if target_kind is not None and target_kind != "all":
        if target_kind not in ["message", "memory_card"]:
            raise ValidationError(
                "target_kind must be 'message', 'memory_card', or 'all'",
                field="target_kind",
                value=target_kind
            )
    
    try:
        manager = EmbeddingManager()
        
        if validated_target_kind and validated_target_kind != "all":
            # Process specific target type
            result = await manager.process_batch(validated_target_kind, validated_batch_size)
        else:
            # Run full pipeline
            result = await manager.run_full_pipeline()
        
        return {
            "status": "success",
            "data": result
        }
    except Exception as e:
        raise ExternalServiceError(
            "embedding_service",
            f"Embedding pipeline failed: {str(e)}"
        )


@router.post("/embeddings/setup")
@handle_api_errors
async def setup_embedding_infrastructure():
    """Set up embedding infrastructure including HNSW indexes."""
    try:
        manager = EmbeddingManager()
        result = await manager.setup_infrastructure()
        return {
            "status": "success",
            "data": result
        }
    except Exception as e:
        raise ExternalServiceError(
            "embedding_service",
            f"Infrastructure setup failed: {str(e)}"
        )


@router.post("/embeddings/optimize")
@handle_api_errors
async def optimize_embedding_indexes():
    """Optimize HNSW indexes for better performance."""
    try:
        manager = EmbeddingManager()
        result = await manager.optimize_indexes()
        return {
            "status": "success",
            "data": result
        }
    except Exception as e:
        raise ExternalServiceError(
            "embedding_service",
            f"Index optimization failed: {str(e)}"
        )