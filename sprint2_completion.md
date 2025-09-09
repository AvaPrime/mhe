# Sprint 2: Cross-Assistant MVM - Completion Checklist

## 🎯 Sprint Goal
**Prove MHE works across multiple AI assistants with unified search**

## 📋 Implementation Checklist

### Day 1-2: Parser Integration
- [ ] **Claude Parser Drop-in**
  - [ ] Add `app/parsers/claude_parser.py` (complete implementation)
  - [ ] Add CLI command: `python -m app.cli.ingest claude FILE [--dry-run]`
  - [ ] Test with sample fixture: `pytest tests/test_claude_parser.py`

- [ ] **Environment Setup**
  ```bash
  # Required env vars
  EMBEDDING_PROVIDER=openai
  EMBEDDING_MODEL=text-embedding-3-small  
  EMBEDDING_DIMENSIONS=1536
  SEARCH_LANG=english
  ```

### Day 3-4: Ingestion Pipeline
- [ ] **Database Ready**
  ```bash
  alembic upgrade head  # Ensure pgvector + FTS ready
  ```

- [ ] **Dual Ingestion Test**
  ```bash
  # ChatGPT export
  python -m app.cli.ingest chatgpt exports/chatgpt.json
  
  # Claude export  
  python -m app.cli.ingest claude exports/claude.json --dry-run
  python -m app.cli.ingest claude exports/claude.json
  ```

- [ ] **Post-Ingest Validation**
  ```sql
  -- Quick DB check
  SELECT assistant, COUNT(*) FROM messages GROUP BY assistant;
  -- Should show: chatgpt | N, claude | M
  ```

### Day 5-6: Cross-Assistant Search
- [ ] **Embedding Pipeline**
  - [ ] Run embedding batch job on all messages
  - [ ] Verify HNSW index created: `SELECT COUNT(*) FROM embeddings;`
  - [ ] Test vector similarity: basic cosine distance query

- [ ] **Hybrid Search Validation**
  ```bash
  python scripts/validate_cross_assistant_search.py
  # Expected output: "Assistants: ['chatgpt', 'claude']"
  ```

### Day 7: RAG Endpoint Polish
- [ ] **Token-Aware Context Packing**
  - [ ] Test `/search/rag?q=python&max_tokens=4000&alpha=0.65`
  - [ ] Verify `token_estimate` and `truncated` fields
  - [ ] Log timing: response should include `elapsed_ms`

- [ ] **Performance Baseline**
  - [ ] Sub-100ms response time at current scale
  - [ ] Test with k=20, α=[0.25, 0.65, 0.8]

## 🚀 Demo Script

### Setup (pre-demo)
```bash
# Start services
docker-compose up -d postgres
python -m app.api.main  # FastAPI server

# Quick data check
curl "localhost:8000/health" | jq .
```

### Live Demo Flow

**1. Parser Showcase** (30 seconds)
```bash
# Show Claude thinking blocks become artifacts
python -m app.cli.ingest claude demo/claude_sample.json --dry-run
```
*"Notice thinking blocks become first-class 'reasoning' artifacts - unique to Claude."*

**2. Cross-Assistant Ingestion** (45 seconds)  
```bash
# Ingest both sources
python -m app.cli.ingest claude demo/claude_sample.json
python -m app.cli.ingest chatgpt demo/chatgpt_sample.json

# Show unified storage
psql -c "SELECT assistant, COUNT(*) FROM messages GROUP BY assistant;"
```
*"Same schema, different sources - normalized into unified memory."*

**3. Hybrid Search Magic** (60 seconds)
```bash
curl "localhost:8000/search/rag?q=python%20function&alpha=0.65&k=10" | jq .
```
*"Results from ChatGPT AND Claude - one brain, two mouths. Notice the cross-assistant ranking."*

**4. RAG Context Intelligence** (30 seconds)
```bash
curl "localhost:8000/search/rag?q=data%20analysis&max_tokens=2000" | jq .contexts[].assistant
```
*"Token-budget packing keeps context relevant and LLM-ready. Under 100ms at 10k scale."*

## 🎬 Demo Talking Points

### Opening Hook
*"Memory Harvester Engine solves the 'AI conversation amnesia' problem. You talk to ChatGPT, Claude, maybe Gemini - but each conversation exists in isolation. MHE creates unified, searchable memory across all your AI interactions."*

### Technical Proof Points
- **Unified Schema**: "Different export formats, same internal representation"
- **Semantic Search**: "Find concepts, not just keywords - across all assistants"  
- **RAG-Ready**: "Context retrieval that actually works with LLM token limits"
- **Performance**: "Sub-100ms search at scale, production-ready architecture"

### Business Value
- **Personal**: "Never lose track of solutions across AI conversations"
- **Team**: "Shared organizational memory across AI tools"  
- **Enterprise**: "Audit trail and knowledge base for AI-assisted work"

## 🔧 Hardening Tasks (Optional Polish)

### Configuration Knobs
- [ ] `SEARCH_LANG=english` (FTS language config)
- [ ] `HYBRID_ALPHA_DEFAULT=0.65` (semantic-leaning default)
- [ ] `RAG_MAX_TOKENS_DEFAULT=8000` (context budget default)

### Artifact Filtering  
- [ ] Exclude reasoning artifacts from RAG by default
- [ ] Add `?include_reasoning=true` query param for research mode
- [ ] Log artifact types in search results for debugging

### Performance Monitoring
- [ ] Add timing to all `/search/*` endpoints
- [ ] Return `elapsed_ms` in response JSON
- [ ] Log `(query, alpha, hits_by_assistant)` for tuning insights

### CI Smoke Tests
```yaml
# Add to GitHub Actions
- name: Sprint 2 Validation
  run: |
    pytest tests/test_claude_parser.py -v
    python scripts/validate_cross_assistant_search.py
    curl localhost:8000/search/rag?q=test | jq .elapsed_ms
```

## ✅ Success Criteria

### Functional
- [ ] Can ingest both ChatGPT and Claude exports without errors
- [ ] Hybrid search returns results from both assistants  
- [ ] RAG endpoint provides token-aware context packing
- [ ] Thinking blocks appear as searchable reasoning artifacts

### Performance  
- [ ] Search latency < 100ms at current scale
- [ ] Embedding generation < 5 messages/second
- [ ] Memory usage reasonable for 10K+ message corpus

### Demo Quality
- [ ] 3-minute demo flows smoothly without technical hitches
- [ ] Cross-assistant results are visually obvious in API responses
- [ ] Performance metrics are visible and impressive

## 🔮 Sprint 3 Preview

With Sprint 2 complete, you have **Minimal Viable Memory**. Sprint 3 options:

**Performance Path**: HNSW tuning, connection pooling, caching layer
**Features Path**: Gemini parser, timeline UI, advanced consolidation  
**Enterprise Path**: Authentication, multi-tenancy, audit logging

*The cathedral has its first stained glass windows. Time to let in more light.*