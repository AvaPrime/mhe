# Codessa-Seed Architecture

## System Overview

```
[Conversation Archives] → [Ingestion Pipeline] → [Memory Layer] → [Query Interface]
                             ↓
                        [Agent Framework]
```

## Core Components

### Ingestion Pipeline
- **Parser**: Multi-format conversation archive processing
- **Normalizer**: Unified event structure creation  
- **Intent Miner**: WHY-extraction using LLM analysis
- **Clusterer**: Semantic grouping and deduplication

### Memory Layer
- **Storage Adapter**: JSONL + Firestore persistence
- **Knowledge Graph**: Linked memory objects with provenance
- **Index Manager**: Thread and cluster indexing

### Agent Framework
- **Scribe Agent**: Documentation and annotation
- **Architect Agent**: System design and planning
- **Builder Agent**: Implementation and construction
- **Validator Agent**: Quality assurance and verification

## Data Flow

1. Archive ingestion and parsing
2. Event normalization and filtering
3. Intent mining (heuristic + LLM)
4. Semantic clustering and storage
5. Index generation and export
6. Context-aware retrieval

## Technology Stack

- **Runtime**: Python 3.9+
- **Storage**: JSONL (local) + Firestore (cloud)
- **LLM**: Gemini/Vertex AI for intent analysis
- **Clustering**: Sentence transformers + K-means
- **APIs**: FastAPI for memory services
