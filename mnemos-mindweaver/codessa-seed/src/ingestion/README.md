# Ingestion Pipeline

## Overview

The ingestion pipeline transforms raw conversation archives into structured memory objects with semantic understanding.

## Components

- `parser.py`: Multi-format archive processing
- `clustering.py`: Semantic grouping and deduplication  
- `storage_adapter.py`: Persistent storage abstraction

## Processing Flow

1. **Parse**: Extract conversations from various export formats
2. **Normalize**: Convert to unified event structure
3. **Filter**: Focus on assistant-authored content with context
4. **Mine**: Extract intent and purpose using LLM analysis
5. **Cluster**: Group semantically related memories
6. **Store**: Persist to memory layer with full traceability

## Usage

```bash
# Basic ingestion
python parser.py --input conversation_export.json --output ../memory/

# With clustering
python parser.py --input export.json --cluster --similarity-threshold 0.8

# Custom storage backend
python parser.py --input export.json --storage firestore --project my-project
```
