# Codessa-Seed Memory Layer

## Overview

The memory layer provides persistent, queryable storage for conversation insights with full traceability and semantic organization.

## Components

- `schema.json`: Canonical data schemas for memory objects, threads, and clusters
- `knowledge_graph.py`: Knowledge graph manager with relationship tracking
- Storage adapters for local (JSONL) and cloud (Firestore) persistence

## Memory Object Structure

Each memory object captures:
- **Content**: Original message text and metadata
- **Intent**: Extracted purpose, principles, and opportunities  
- **Context**: Thread relationships and conversation flow
- **Provenance**: Complete source traceability
- **Semantics**: Cluster membership and similarity links

## Query Capabilities

- Content-based search with semantic similarity
- Intent pattern matching and filtering
- Temporal queries across conversation history
- Cluster-based topic exploration
- Traceability path traversal

## Storage Backends

### Local JSONL
- Fast development and testing
- Simple file-based persistence
- Full-text search with indexing

### Firestore
- Cloud-native scalability
- Real-time synchronization
- Advanced querying and analytics

## Usage

```python
from memory import KnowledgeGraph

kg = KnowledgeGraph(storage_type="jsonl")
memories = kg.query_memories(intent="system design", timeframe="last_30_days")
```
