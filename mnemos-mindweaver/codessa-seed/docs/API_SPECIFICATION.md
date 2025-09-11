# Codessa-Seed API Specification

## Memory Object Schema

```json
{
  "id": "uuid",
  "thread_id": "string", 
  "message_id": "string",
  "timestamp": "ISO-8601",
  "author": "assistant|user",
  "content": "string",
  "tokens": "integer",
  "facets": {
    "intent": "string",
    "principles": ["string"],
    "constraints": ["string"],
    "opportunities": ["string"],
    "risks": ["string"]
  },
  "cluster_id": "uuid",
  "provenance": {
    "source_file": "string",
    "thread_title": "string", 
    "hash": "sha256"
  },
  "version": "semver"
}
```

## REST Endpoints

### Memory Operations
- `POST /memory/ingest` - Process conversation archive
- `GET /memory/objects/{id}` - Retrieve memory object
- `GET /memory/search` - Query memories by content/facets
- `GET /memory/clusters` - List semantic clusters

### Thread Operations  
- `GET /threads/{id}` - Retrieve thread metadata
- `GET /threads/{id}/memories` - Get memories from thread
- `GET /threads/search` - Find threads by criteria

### Context Operations
- `POST /context/retrieve` - Get relevant memories for task
- `GET /context/patterns` - Identify recurring patterns
- `GET /context/gaps` - Find unresolved loops

## Query Parameters

### Search Filters
- `intent`: Filter by extracted intent patterns
- `timerange`: Limit to date range  
- `cluster`: Restrict to semantic cluster
- `author`: Filter by message author

### Pagination
- `limit`: Maximum results (default: 50, max: 500)
- `offset`: Results offset for paging
- `cursor`: Cursor-based pagination token

## Response Formats

All responses follow standard envelope:

```json
{
  "data": {},
  "meta": {
    "total": "integer",
    "pagination": {},
    "timing": "milliseconds"
  },
  "errors": []
}
```
