# Memory Harvester Engine - Minimal Viable Memory (MVM) Roadmap

## 🎯 MVM Definition
A working memory system that can:
- Ingest ChatGPT + Claude conversations
- Generate semantic embeddings 
- Provide hybrid search (lexical + vector)
- Serve RAG-ready endpoints
- Operate via CLI + FastAPI (no web UI required)

---

## 🏗️ Layer 1: Capture (Parser Implementation)

### ✅ Completed
- [x] ChatGPT parser with chronological ordering
- [x] Unified message schema normalization
- [x] Artifact detection (code blocks, documents)

### 🔧 Priority Tasks
- [ ] **Claude Parser Implementation** (HIGH)
  - [ ] Parse Claude conversation exports (markdown format)
  - [ ] Handle Claude's artifact system (thinking blocks, code artifacts)
  - [ ] Map Claude message roles to unified schema
  - [ ] Test with real Claude export files

- [ ] **Parser Interface Standardization** (MEDIUM)
  - [ ] Create `BaseParser` abstract class
  - [ ] Implement parser factory pattern
  - [ ] Add parser auto-detection by file format
  - [ ] Error handling for malformed exports

### 📋 Testing Checklist
- [ ] Unit tests for both parsers
- [ ] Comparative tests (same conversation across assistants)
- [ ] Edge case handling (empty threads, malformed JSON)

---

## 🧠 Layer 2: Extraction (LLM Integration)

### 🔧 Critical Path Tasks
- [ ] **Real Embedding Client** (CRITICAL - BLOCKS EVERYTHING)
  - [ ] Replace `MockLLMClient` with real implementation
  - [ ] Provider interface: `EmbeddingProvider` abstract class
  - [ ] OpenAI implementation: `text-embedding-3-small` support
  - [ ] Batch processing for efficiency (up to 100 texts/request)
  - [ ] Rate limiting and error handling
  - [ ] Configuration via environment variables

- [ ] **Memory Card Generation** (HIGH)
  - [ ] Real LLM calls for summarization
  - [ ] Thematic tagging using GPT-4/Claude
  - [ ] Prompt engineering for consistent output
  - [ ] Fallback handling when LLM unavailable

- [ ] **Embedding Storage Pipeline** (HIGH)
  - [ ] Generate embeddings for all message content
  - [ ] Store in `embedding` table with proper indexing
  - [ ] Batch upsert operations for performance
  - [ ] Handle embedding dimension mismatches

### 📊 Provider Implementation Priority
1. **OpenAI** (easiest, most reliable)
2. **HuggingFace local** (OSS, air-gapped capability) 
3. **Anthropic** (when available)
4. **Cohere/Others** (future extensibility)

---

## 💾 Layer 3: Memory (Database Optimization)

### ✅ Solid Foundation
- [x] PostgreSQL schema with pgvector
- [x] Proper foreign key relationships
- [x] Migration system with Alembic

### 🔧 Performance Tasks
- [ ] **Vector Index Optimization** (MEDIUM)
  - [ ] Tune HNSW index parameters for pgvector
  - [ ] Add composite indexes for hybrid search
  - [ ] Connection pooling configuration
  - [ ] Query performance profiling

- [ ] **Bulk Operations** (MEDIUM)
  - [ ] Optimize batch insertions
  - [ ] Implement bulk embedding updates
  - [ ] Add progress tracking for large imports

---

## 🔍 Layer 4: Access (Search & API)

### 🔧 Search Implementation (CRITICAL PATH)
- [ ] **Vector Similarity Search** (CRITICAL)
  - [ ] Implement cosine similarity queries with pgvector
  - [ ] k-nearest neighbors with filtering
  - [ ] Relevance threshold tuning
  - [ ] Performance benchmarking

- [ ] **Full-Text Search** (HIGH)
  - [ ] Complete tsvector implementation
  - [ ] Combine with vector search for hybrid results
  - [ ] Ranking algorithm (combine lexical + semantic scores)
  - [ ] Search result deduplication

- [ ] **RAG Endpoint Implementation** (HIGH)
  - [ ] `/search/rag` endpoint with context retrieval
  - [ ] Configurable context window sizes
  - [ ] Source attribution in responses
  - [ ] Integration testing with LLM providers

### 🔧 API Completeness
- [ ] **Enhanced Endpoints** (MEDIUM)
  - [ ] Conversation thread browsing with pagination
  - [ ] Artifact retrieval with metadata
  - [ ] Advanced filtering (date ranges, assistants, tags)
  - [ ] Export functionality (JSON, markdown)

---

## 🌙 Layer 5: Consolidation (Future Foundation)

### 🔧 Basic Implementation
- [ ] **Simple Deduplication** (LOW)
  - [ ] Cross-thread concept detection
  - [ ] Similar conversation clustering
  - [ ] Duplicate artifact identification

*Note: Advanced consolidation (knowledge graphs, temporal evolution) pushed to post-MVM*

---

## 🚀 Sprint Breakdown

### Sprint 1: "The Embedding Unlock" (2-3 weeks)
**Goal**: Get embeddings working end-to-end
- Replace MockLLMClient with OpenAI integration
- Implement embedding generation and storage
- Basic vector similarity search
- Test with existing ChatGPT data

**Success Criteria**: Can embed a conversation and retrieve similar messages

### Sprint 2: "Claude Integration" (1-2 weeks)  
**Goal**: Multi-assistant support
- Implement Claude parser
- Test cross-assistant conversations
- Unified search across both sources

**Success Criteria**: Can ingest and search both ChatGPT and Claude exports

### Sprint 3: "Hybrid Search Power" (2 weeks)
**Goal**: Production-quality search
- Full-text search implementation
- Hybrid ranking algorithm
- RAG endpoint completion
- Performance optimization

**Success Criteria**: Sub-100ms search responses with relevant results

### Sprint 4: "Polish & Packaging" (1 week)
**Goal**: MVM completion
- Comprehensive testing
- Documentation updates
- Docker compose refinements
- Demo preparation

**Success Criteria**: Can demo the full MVM workflow to stakeholders

---

## 🎯 Success Metrics

### Technical KPIs
- [ ] Search latency < 100ms for 10K+ messages
- [ ] Embedding generation < 5 messages/second
- [ ] 95%+ parsing success rate across formats
- [ ] Memory usage < 500MB for 100K messages

### Functional Validation
- [ ] Can find relevant context across 6-month conversation history
- [ ] Cross-assistant concept linking works
- [ ] RAG responses include proper source attribution
- [ ] CLI workflows are smooth and intuitive

---

## 🔮 Post-MVM Roadmap Teasers

**Next Major Milestones:**
- **Web UI**: Timeline browsing, concept graphs, visual search
- **Advanced Consolidation**: Knowledge evolution tracking, concept graphs
- **Enterprise Features**: Multi-tenancy, authentication, audit logs
- **Extended Capture**: Audio transcripts, PDF ingestion, email integration

---

## 🛠️ Implementation Notes

### Environment Setup
```bash
# Core dependencies to add/update
pip install openai sentence-transformers asyncpg[speedups]

# Environment variables needed
OPENAI_API_KEY=sk-...
EMBEDDING_PROVIDER=openai  # or huggingface
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIMENSIONS=1536
```

### Key Decision Points
1. **Provider Strategy**: Start with OpenAI, design for pluggability
2. **Performance vs. Features**: Optimize core search before advanced features  
3. **Testing Strategy**: Focus on integration tests for cross-component workflows
4. **Error Handling**: Graceful degradation when LLM services unavailable

---

*This roadmap transforms MHE from "elegant scaffold" to "working memory system" in 4 focused sprints. Each sprint delivers demonstrable value while building toward the full MVM vision.*