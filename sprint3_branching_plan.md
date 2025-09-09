# Sprint 3: Cathedral Expansion - Three Path Strategy

## 🎯 Strategic Context

With **Minimal Viable Memory** proven (Sprint 2 complete), you now choose which cathedral window to install next. Each path serves different audiences and unlocks different opportunities:

- **Performance Path**: Scales to enterprise workloads, proves production readiness
- **Features Path**: Broadens capture sources, builds user delight
- **Enterprise Path**: Unlocks B2B sales, adds governance/compliance

---

## 🚀 Performance Path: "Production Scale Readiness"

### Target Audience
- **Technical evaluators** who need proof of scalability
- **Platform teams** considering MHE as infrastructure
- **Performance-sensitive use cases** (real-time RAG, high query volume)

### Core Value Proposition
*"Sub-50ms search at 100K+ messages, enterprise-grade reliability"*

### 🔧 Implementation Milestones

#### Week 1-2: Database & Query Optimization
- [ ] **Connection Pooling**
  ```python
  # Advanced asyncpg pool configuration
  DATABASE_POOL_MIN=5
  DATABASE_POOL_MAX=20
  DATABASE_POOL_TIMEOUT=30
  ```

- [ ] **HNSW Index Tuning**
  ```sql
  -- Production HNSW parameters
  CREATE INDEX CONCURRENTLY idx_embeddings_prod 
  ON embeddings USING hnsw (vector vector_cosine_ops) 
  WITH (m = 32, ef_construction = 128);
  
  -- Query-time optimization
  SET hnsw.ef_search = 100;  -- Tune for recall vs speed
  ```

- [ ] **Query Plan Optimization**
  ```sql
  -- Composite indexes for hybrid search
  CREATE INDEX idx_messages_assistant_fts ON messages (assistant) INCLUDE (fts);
  CREATE INDEX idx_messages_created_at_desc ON messages (created_at DESC);
  ```

#### Week 3: Caching & Memory Optimization  
- [ ] **Redis Embedding Cache**
  ```python
  # Cache frequently accessed embeddings
  @cached(ttl=3600, key_builder=embedding_key_builder)
  async def get_cached_embedding(text: str) -> List[float]:
      return await embedder.embed([text])[0]
  ```

- [ ] **Query Result Caching**
  ```python
  # Cache search results for common queries
  @cached(ttl=300, key_builder=search_key_builder) 
  async def cached_hybrid_search(query, alpha, k):
      # ... search logic
  ```

- [ ] **Memory-Efficient Batch Processing**
  ```python
  # Stream processing for large corpora
  async def stream_embed_messages(batch_size=500):
      async for batch in message_stream(batch_size):
          vectors = await embedder.embed_batch(batch)
          await bulk_upsert_embeddings(vectors)
  ```

#### Week 4: Performance Monitoring & Benchmarking
- [ ] **Prometheus Metrics**
  ```python
  # Key performance indicators
  search_latency = Histogram('search_latency_seconds')
  embedding_throughput = Counter('embeddings_generated_total')
  cache_hit_rate = Gauge('cache_hit_rate')
  ```

- [ ] **Load Testing Suite**
  ```python
  # Concurrent search benchmark
  async def benchmark_concurrent_search(concurrency=50, queries=1000):
      # Test search under load
      # Target: <50ms p95 latency at 50 concurrent users
  ```

- [ ] **Performance Dashboard**
  ```python
  @router.get("/metrics/performance")
  async def performance_dashboard():
      return {
          "search_p95_ms": get_p95_latency(),
          "cache_hit_rate": get_cache_hit_rate(), 
          "active_connections": get_db_pool_stats(),
          "memory_usage_mb": get_memory_usage()
      }
  ```

### 📊 Success Metrics
- [ ] **Sub-50ms p95 search latency** at 100K+ messages
- [ ] **500+ concurrent users** without degradation
- [ ] **95%+ uptime** under sustained load
- [ ] **<2GB memory footprint** for 500K message corpus

### 🎬 Performance Demo
*"Here's MHE handling 50 concurrent searches across 250K messages - p95 latency stays under 45ms. Redis cache gives us 85% hit rates on common queries. This isn't a prototype; it's production infrastructure."*

---

## 🎨 Features Path: "User Experience Excellence"

### Target Audience
- **Power users** who want comprehensive knowledge capture
- **Research teams** needing rich data sources
- **Personal knowledge workers** seeking delightful UX

### Core Value Proposition  
*"Capture everything, search beautifully - across all AI tools and formats"*

### 🔧 Implementation Milestones

#### Week 1: Gemini Parser + Multi-Modal Support
- [ ] **Gemini Conversation Parser**
  ```python
  # app/parsers/gemini_parser.py
  class GeminiParser(BaseParser):
      def parse(self, raw_export) -> ThreadIngest:
          # Handle Gemini's conversation format
          # Support for Gemini's code execution results
          # Extract generated images/charts as artifacts
  ```

- [ ] **Audio Transcript Integration**  
  ```python
  # Support for Whisper transcripts as conversation sources
  class AudioTranscriptParser(BaseParser):
      def parse_whisper_transcript(self, transcript_json):
          # Convert audio -> text -> searchable messages
  ```

- [ ] **PDF Document Ingestion**
  ```python
  # Extract text from PDFs as artifacts
  async def ingest_pdf_document(pdf_path: str, thread_id: str):
      # OCR + text extraction -> artifact storage
  ```

#### Week 2: Timeline & Visualization UI
- [ ] **Web UI Foundation**
  ```typescript
  // React + FastAPI integration  
  // Timeline view of conversations
  // Interactive search with live filtering
  // Artifact preview and download
  ```

- [ ] **Conversation Timeline**
  ```typescript
  // Chronological view across all assistants
  // Filter by: date range, assistant, artifact type
  // Visual indicators for thinking blocks, code, etc.
  ```

- [ ] **Concept Graph Visualization**
  ```typescript
  // D3.js network graph of related conversations
  // Node size = message count, edge weight = similarity
  // Interactive exploration of knowledge connections
  ```

#### Week 3-4: Advanced Search & Discovery
- [ ] **Semantic Similar Conversations**
  ```python
  @router.get("/discover/similar/{thread_id}")
  async def find_similar_conversations(thread_id: str):
      # Find conversations with similar themes/topics
      # Cross-assistant concept linking
  ```

- [ ] **Temporal Pattern Detection**
  ```python
  @router.get("/discover/patterns")  
  async def discover_temporal_patterns():
      # "You often ask about Python on Mondays"
      # "Claude conversations tend to be longer than ChatGPT"
  ```

- [ ] **Smart Tagging & Categories**
  ```python
  # LLM-generated tags based on conversation content
  async def auto_tag_conversations():
      # "programming", "data-science", "creative-writing"
      # Hierarchical tag suggestions
  ```

### 📊 Success Metrics
- [ ] **3+ AI assistant sources** supported (ChatGPT, Claude, Gemini)
- [ ] **Multi-modal artifacts** (text, code, audio transcripts, PDFs)
- [ ] **<200ms page load times** for timeline UI
- [ ] **Intuitive discovery** - users find forgotten insights easily

### 🎬 Features Demo
*"Here's my complete AI interaction history - ChatGPT coding sessions, Claude research conversations, Gemini brainstorming. The timeline shows patterns: I code more in the morning, research in the afternoon. Click any artifact to see the full context across assistants."*

---

## 🏢 Enterprise Path: "Business Readiness"

### Target Audience
- **Enterprise buyers** evaluating AI knowledge management
- **IT security teams** requiring governance controls  
- **Compliance officers** needing audit trails

### Core Value Proposition
*"Secure, compliant, multi-tenant AI knowledge platform for enterprise teams"*

### 🔧 Implementation Milestones

#### Week 1: Authentication & Authorization
- [ ] **OAuth2 + JWT Authentication**
  ```python
  # Support for Google, Microsoft, SAML SSO
  @router.post("/auth/login")
  async def enterprise_login(provider: str):
      # OAuth flow with enterprise providers
  ```

- [ ] **Role-Based Access Control (RBAC)**
  ```python
  # Roles: admin, manager, analyst, viewer
  # Permissions: read, write, export, manage_users
  class Permission(Enum):
      READ_CONVERSATIONS = "read:conversations"
      EXPORT_DATA = "export:data" 
      MANAGE_USERS = "manage:users"
  ```

- [ ] **Multi-Tenant Data Isolation**
  ```sql
  -- Tenant-scoped tables
  ALTER TABLE messages ADD COLUMN tenant_id UUID;
  ALTER TABLE embeddings ADD COLUMN tenant_id UUID;
  
  -- Row-level security
  CREATE POLICY tenant_isolation ON messages 
  FOR ALL TO app_user 
  USING (tenant_id = current_setting('app.tenant_id')::UUID);
  ```

#### Week 2: Governance & Compliance
- [ ] **Data Retention Policies**
  ```python
  # Configurable retention per tenant
  class RetentionPolicy:
      conversations_days: int = 365
      embeddings_days: int = 730
      audit_logs_days: int = 2555  # 7 years
  ```

- [ ] **Audit Logging**
  ```python
  # Comprehensive audit trail
  class AuditLog:
      user_id: str
      action: str  # search, export, delete, etc.
      resource_id: str
      timestamp: datetime
      ip_address: str
      user_agent: str
  ```

- [ ] **Data Export & Portability**
  ```python
  @router.get("/export/tenant")
  @requires_permission("export:data")
  async def export_tenant_data(format: str = "jsonl"):
      # Complete tenant data export
      # Support: JSONL, CSV, Parquet formats
  ```

#### Week 3: Enterprise Integration
- [ ] **API Rate Limiting & Quotas**
  ```python
  # Per-tenant usage limits
  @rate_limit(requests_per_minute=1000, per="tenant")
  @quota_check(searches_per_month=100000)
  async def enterprise_search():
      # Rate-limited search with quota enforcement
  ```

- [ ] **Webhook Integration**
  ```python
  # Real-time notifications for enterprise workflows
  @router.post("/webhooks/conversation_ingested")
  async def conversation_webhook(event: ConversationEvent):
      # Notify Slack/Teams/SIEM systems
  ```

- [ ] **Health Checks & SLA Monitoring**
  ```python
  @router.get("/health/enterprise")
  async def enterprise_health():
      return {
          "status": "healthy",
          "uptime_seconds": get_uptime(),
          "search_latency_p99": get_latency_p99(),
          "error_rate_5m": get_error_rate()
      }
  ```

#### Week 4: Enterprise UI & Administration
- [ ] **Admin Dashboard**  
  ```typescript
  // Tenant management, user roles, usage analytics
  // Data retention controls, audit log viewer
  // Performance monitoring, alert configuration
  ```

- [ ] **Usage Analytics**
  ```python
  # Enterprise metrics for customer success
  async def get_tenant_analytics():
      return {
          "active_users_30d": count_active_users(),
          "searches_per_day": get_search_volume(),
          "top_queries": get_popular_queries(),
          "assistant_usage_breakdown": get_assistant_stats()
      }
  ```

### 📊 Success Metrics
- [ ] **SOC2 Type II compliance** controls implemented
- [ ] **Multi-tenant isolation** with zero data leakage
- [ ] **99.9% uptime SLA** capability demonstrated
- [ ] **Enterprise SSO** integration working smoothly

### 🎬 Enterprise Demo
*"Here's MHE configured for Acme Corp - 500 users across 3 departments. Each team sees only their conversations, retention policies enforce 2-year data lifecycle, and every search is audited. The admin dashboard shows Jane in Marketing ran 47 searches this week, mostly about product positioning."*

---

## 🎯 Path Selection Framework

### Choose Performance Path If:
- [ ] You have **technical buyers** who care about scale
- [ ] Current corpus is approaching **50K+ messages**
- [ ] You need to demonstrate **production readiness** for funding/sales
- [ ] Performance is a clear differentiator vs alternatives

### Choose Features Path If:
- [ ] You have **user-focused stakeholders** who want breadth
- [ ] Missing AI assistant support is blocking adoption
- [ ] Visual/UI elements would significantly help demos
- [ ] You're targeting **individual users** or research teams

### Choose Enterprise Path If:
- [ ] You have **B2B sales opportunities** in pipeline
- [ ] Buyers are asking about **security/compliance**
- [ ] Multi-tenant use cases are emerging
- [ ] You need **enterprise-grade** positioning for market credibility

---

## 🔄 Path Convergence Strategy

**After Sprint 3**: All paths eventually converge. The enterprise version needs performance optimization, the performant version needs enterprise controls, etc. But starting with focused excellence in one area builds credibility and momentum.

**Hybrid Approach**: If resources allow, consider **Performance + selective Features** (e.g., Gemini parser) or **Enterprise + Performance** basics. But avoid the trap of doing all three poorly.

---

## 🎭 The Demo Evolution

### Sprint 2 Demo
*"Memory works across ChatGPT and Claude"*

### Sprint 3 Performance Demo  
*"Memory works at enterprise scale"*

### Sprint 3 Features Demo
*"Memory works across everything you use"*

### Sprint 3 Enterprise Demo
*"Memory works for your entire organization"*

Each demo builds on the previous foundation while targeting a different buyer persona and use case.

---

*The cathedral now has its central window installed. Time to choose which wing deserves the next masterpiece.*