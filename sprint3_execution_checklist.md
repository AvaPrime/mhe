# Sprint 3: Performance + Gemini - 4-Week Execution Checklist

## 🎯 Sprint Goal
**Prove MHE scales to enterprise workloads with comprehensive AI assistant coverage**

*Demo Story: "Here's MHE handling 250K messages across ChatGPT, Claude, and Gemini—with sub-50ms search latency. This isn't just clever—it's fast, scalable memory."*

---

## 📅 Week 1: Database & Query Foundation

### Goal: Sub-100ms baseline at current scale, ready for 10x growth

#### Day 1-2: Connection Pooling & Database Optimization
- [ ] **Advanced Connection Pool Configuration**
  ```python
  # config/database.py
  DATABASE_POOL_MIN=10
  DATABASE_POOL_MAX=50
  DATABASE_POOL_TIMEOUT=30
  DATABASE_POOL_RETRY=3
  DATABASE_STATEMENT_CACHE_SIZE=1024
  ```

- [ ] **Connection Pool Monitoring**
  ```python
  # app/db/pool_monitor.py
  async def get_pool_stats():
      return {
          "size": pool.get_size(),
          "checked_in": pool.get_checked_in_size(),
          "checked_out": pool.get_checked_out_size(),
          "invalid": pool.get_invalid_size()
      }
  ```

#### Day 3-4: HNSW Index Production Tuning
- [ ] **Optimized HNSW Parameters**
  ```sql
  -- Drop existing development index
  DROP INDEX IF EXISTS idx_embeddings_vector_hnsw;
  
  -- Create production-optimized HNSW index
  CREATE INDEX CONCURRENTLY idx_embeddings_vector_prod
  ON embeddings USING hnsw (vector vector_cosine_ops) 
  WITH (m = 32, ef_construction = 128);
  
  -- Runtime optimization
  ALTER SYSTEM SET hnsw.ef_search = 100;
  SELECT pg_reload_conf();
  ```

- [ ] **Composite Indexes for Hybrid Search**
  ```sql
  -- Optimize filtered searches
  CREATE INDEX CONCURRENTLY idx_messages_assistant_created 
  ON messages (assistant, created_at DESC) INCLUDE (content, fts);
  
  -- Optimize thread browsing
  CREATE INDEX CONCURRENTLY idx_messages_thread_index 
  ON messages (thread_id, index) INCLUDE (content, role);
  ```

#### Day 5: Query Plan Analysis & Optimization
- [ ] **Search Query Analysis**
  ```sql
  -- Analyze current query plans
  EXPLAIN (ANALYZE, BUFFERS) 
  SELECT m.id, m.content, (1 - (e.vector <=> $1)) AS score
  FROM embeddings e 
  JOIN messages m ON m.id = e.message_id
  ORDER BY e.vector <=> $1 LIMIT 20;
  ```

- [ ] **Query Performance Baseline**
  ```python
  # scripts/benchmark_queries.py
  async def benchmark_search_performance():
      # Test various query patterns
      # Document baseline: median, p95, p99 latencies
      # Target: <50ms p95 for vector search
  ```

### ✅ Week 1 Success Criteria
- [ ] Database can handle 500+ concurrent connections
- [ ] Vector search <50ms p95 at current corpus size
- [ ] Hybrid search <100ms p95 with proper query plans

---

## 📅 Week 2: Gemini Parser & Horizontal Scaling Proof

### Goal: Prove Capture Layer scales horizontally across all major AI assistants

#### Day 1-2: Gemini Parser Implementation
- [ ] **Gemini Export Format Analysis**
  ```python
  # Research Gemini's actual export structure
  # Document format variations (JSON, markdown, etc.)
  # Map Gemini roles to unified schema
  ```

- [ ] **Gemini Parser Core**
  ```python
  # app/parsers/gemini_parser.py
  class GeminiParser(BaseParser):
      def __init__(self):
          super().__init__()
          # Gemini-specific patterns
          self._code_exec_re = re.compile(r"```python\n# Code execution result\n(.*?)```", re.DOTALL)
          self._chart_re = re.compile(r"\[Generated chart: (.*?)\]")
      
      def parse(self, raw_export: Dict[str, Any]) -> ThreadIngest:
          # Handle Gemini conversation structure
          # Support for code execution results
          # Extract chart/image references as artifacts
  ```

#### Day 3: Gemini-Specific Artifact Detection
- [ ] **Code Execution Results**
  ```python
  def _extract_code_execution_artifacts(self, content: str, message_id: str):
      # Gemini often shows code + execution output
      # Create separate artifacts for input code vs output
      artifacts = []
      
      for match in self._code_exec_re.finditer(content):
          execution_output = match.group(1).strip()
          artifacts.append(ArtifactIngest(
              artifact_type="execution_result",
              language="text",
              content=execution_output,
              # ... metadata
          ))
      return artifacts
  ```

- [ ] **Chart & Media References**
  ```python
  def _extract_media_artifacts(self, content: str, message_id: str):
      # Gemini generates charts, images, etc.
      # Track references even if we can't store the actual media yet
      for match in self._chart_re.finditer(content):
          chart_description = match.group(1)
          # Create artifact with metadata about generated media
  ```

#### Day 4-5: Parser Integration & Testing
- [ ] **CLI Integration**
  ```bash
  # Add Gemini support to CLI
  python -m app.cli.ingest gemini exports/gemini.json --dry-run
  python -m app.cli.ingest gemini exports/gemini.json
  ```

- [ ] **Three-Way Parser Validation**
  ```python
  # tests/test_all_parsers_integration.py
  def test_cross_assistant_normalization():
      # Same logical conversation across all three parsers
      # Verify unified schema consistency
      # Test artifact detection patterns
  ```

### ✅ Week 2 Success Criteria
- [ ] Gemini parser ingests real exports without errors
- [ ] All three parsers (ChatGPT, Claude, Gemini) produce consistent schema
- [ ] Artifact detection works for Gemini's unique patterns (code execution, charts)

---

## 📅 Week 3: Caching Layer & Performance Optimization

### Goal: Sub-50ms search at 100K+ messages with intelligent caching

#### Day 1-2: Redis Caching Infrastructure
- [ ] **Redis Setup & Configuration**
  ```yaml
  # docker-compose.yml addition
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --maxmemory 1gb --maxmemory-policy lru
  ```

- [ ] **Embedding Cache Implementation**
  ```python
  # app/cache/embedding_cache.py
  from redis import asyncio as aioredis
  import pickle
  import hashlib
  
  class EmbeddingCache:
      def __init__(self):
          self.redis = aioredis.Redis.from_url("redis://localhost:6379")
      
      async def get_embedding(self, text: str) -> Optional[List[float]]:
          key = f"emb:{hashlib.md5(text.encode()).hexdigest()}"
          cached = await self.redis.get(key)
          return pickle.loads(cached) if cached else None
      
      async def set_embedding(self, text: str, vector: List[float], ttl=3600):
          key = f"emb:{hashlib.md5(text.encode()).hexdigest()}"
          await self.redis.setex(key, ttl, pickle.dumps(vector))
  ```

#### Day 3: Query Result Caching
- [ ] **Search Result Cache**
  ```python
  # app/cache/search_cache.py
  class SearchCache:
      async def get_search_results(self, query_hash: str) -> Optional[List[Dict]]:
          # Cache search results for popular queries
          # TTL: 5 minutes for dynamic content
      
      async def cache_search_results(self, query_hash: str, results: List[Dict]):
          # Store with metadata: timestamp, result_count, alpha, k
  ```

- [ ] **Cache-Aware Search Pipeline**
  ```python
  # app/repositories/cached_search_repo.py
  async def hybrid_search_cached(
      db: AsyncSession, 
      q_text: str, 
      q_vec: List[float], 
      k: int = 20, 
      alpha: float = 0.5
  ):
      # Check cache first
      cache_key = f"{hash(q_text)}:{k}:{alpha}"
      cached = await search_cache.get_search_results(cache_key)
      if cached:
          return cached
      
      # Fall back to database search
      results = await search_hybrid(db, q_text, q_vec, k, alpha)
      await search_cache.cache_search_results(cache_key, results)
      return results
  ```

#### Day 4-5: Memory-Efficient Batch Processing
- [ ] **Streaming Embedding Generation**
  ```python
  # app/services/streaming_embedder.py
  async def stream_embed_corpus(batch_size: int = 1000):
      """Process large corpora without memory explosion."""
      async for message_batch in stream_unembedded_messages(batch_size):
          texts = [m.content for m in message_batch]
          vectors = await embedder.embed_batch(texts)
          
          # Stream to database without holding everything in memory
          await bulk_upsert_embeddings(message_batch, vectors)
          
          # Clear batch from memory
          del texts, vectors, message_batch
  ```

- [ ] **Optimized Bulk Operations**
  ```python
  # app/db/bulk_operations.py
  async def bulk_upsert_embeddings_optimized(
      db: AsyncSession,
      embeddings_data: List[Tuple[str, List[float], str]],
      batch_size: int = 500
  ):
      # Use COPY instead of INSERT for massive performance gain
      # Batch commits to reduce transaction overhead
  ```

### ✅ Week 3 Success Criteria
- [ ] Redis caching reduces embedding API calls by 80%+
- [ ] Search result caching improves repeat query performance by 90%+
- [ ] Memory usage remains stable during large corpus processing
- [ ] Search latency <50ms p95 at 50K+ messages

---

## 📅 Week 4: Monitoring, Load Testing & Performance Validation

### Goal: Demonstrate enterprise-scale reliability with comprehensive metrics

#### Day 1-2: Prometheus Metrics & Monitoring
- [ ] **Core Performance Metrics**
  ```python
  # app/monitoring/metrics.py
  from prometheus_client import Histogram, Counter, Gauge
  
  # Search performance
  search_duration = Histogram('search_duration_seconds', 
                             'Search request duration', ['endpoint', 'assistant'])
  
  # Embedding performance  
  embedding_requests = Counter('embedding_requests_total',
                              'Total embedding requests', ['provider', 'model'])
  
  # Cache performance
  cache_hit_rate = Gauge('cache_hit_rate', 'Cache hit rate', ['cache_type'])
  
  # Database performance
  db_connections_active = Gauge('db_connections_active', 'Active DB connections')
  ```

- [ ] **Metrics Middleware**
  ```python
  # app/api/middleware/metrics.py
  @app.middleware("http")
  async def metrics_middleware(request: Request, call_next):
      start_time = time.time()
      response = await call_next(request)
      duration = time.time() - start_time
      
      search_duration.labels(
          endpoint=request.url.path,
          assistant=request.query_params.get('assistant', 'all')
      ).observe(duration)
      
      return response
  ```

#### Day 3: Load Testing Suite
- [ ] **Concurrent Search Benchmark**
  ```python
  # tests/load_test_search.py
  import asyncio
  import aiohttp
  from time import perf_counter
  
  async def load_test_search(
      concurrent_users: int = 50,
      requests_per_user: int = 20,
      base_url: str = "http://localhost:8000"
  ):
      """Simulate concurrent users searching simultaneously."""
      
      async def user_session(session, user_id):
          search_queries = get_realistic_queries()  # From real usage patterns
          latencies = []
          
          for query in search_queries:
              start = perf_counter()
              async with session.get(f"{base_url}/search/rag?q={query}") as resp:
                  await resp.json()
              latencies.append(perf_counter() - start)
          
          return latencies
      
      # Run concurrent user sessions
      async with aiohttp.ClientSession() as session:
          tasks = [user_session(session, i) for i in range(concurrent_users)]
          all_latencies = await asyncio.gather(*tasks)
      
      # Analyze results
      flat_latencies = [lat for user_lats in all_latencies for lat in user_lats]
      return {
          "total_requests": len(flat_latencies),
          "median_ms": np.median(flat_latencies) * 1000,
          "p95_ms": np.percentile(flat_latencies, 95) * 1000,
          "p99_ms": np.percentile(flat_latencies, 99) * 1000,
          "concurrent_users": concurrent_users
      }
  ```

- [ ] **Memory & Resource Monitoring**
  ```python
  # tests/resource_monitor.py  
  async def monitor_resources_under_load():
      """Track memory, CPU, DB connections during load test."""
      
      metrics = []
      while load_test_running():
          metrics.append({
              "timestamp": time.time(),
              "memory_mb": get_memory_usage_mb(),
              "cpu_percent": get_cpu_percent(),
              "db_connections": get_db_pool_size(),
              "cache_hit_rate": get_cache_hit_rate()
          })
          await asyncio.sleep(1)
      
      return metrics
  ```

#### Day 4: Performance Dashboard
- [ ] **Real-Time Performance API**
  ```python
  @router.get("/metrics/performance/live")
  async def live_performance_metrics():
      return {
          "search_latency": {
              "p50_ms": get_search_latency_p50(),
              "p95_ms": get_search_latency_p95(), 
              "p99_ms": get_search_latency_p99()
          },
          "cache_performance": {
              "embedding_hit_rate": get_embedding_cache_hit_rate(),
              "search_hit_rate": get_search_cache_hit_rate()
          },
          "database": {
              "active_connections": get_db_active_connections(),
              "query_time_avg": get_avg_query_time()
          },
          "corpus_stats": {
              "total_messages": await count_total_messages(),
              "total_embeddings": await count_total_embeddings(),
              "assistants": ["chatgpt", "claude", "gemini"]
          }
      }
  ```

- [ ] **Performance Report Generator**
  ```python
  # scripts/generate_performance_report.py
  async def generate_performance_report():
      """Create comprehensive performance report for demos."""
      
      report = {
          "test_date": datetime.utcnow().isoformat(),
          "corpus_size": await get_corpus_stats(),
          "load_test_results": await run_standard_load_tests(),
          "cache_effectiveness": await analyze_cache_performance(),
          "resource_efficiency": await analyze_resource_usage()
      }
      
      # Generate markdown report
      with open("performance_report.md", "w") as f:
          f.write(format_performance_report(report))
  ```

#### Day 5: Final Integration & Demo Prep
- [ ] **End-to-End Validation**
  ```bash
  # Complete pipeline test
  python scripts/ingest_large_corpus.py  # 100K+ messages across 3 assistants
  python scripts/run_load_tests.py       # 50 concurrent users
  python scripts/generate_performance_report.py
  ```

- [ ] **Demo Data Preparation**
  ```python
  # Create impressive demo dataset
  # Mix of real conversations across all 3 assistants
  # Ensure good variety of artifact types
  # Pre-warm caches for smooth demo flow
  ```

### ✅ Week 4 Success Criteria
- [ ] **<50ms p95 search latency** at 100K+ message corpus
- [ ] **50+ concurrent users** without performance degradation
- [ ] **85%+ cache hit rate** for embeddings and popular queries  
- [ ] **Stable memory usage** (<4GB) under sustained load
- [ ] **Comprehensive metrics** proving enterprise readiness

---

## 🎬 Sprint 3 Demo Script

### Pre-Demo Setup (5 minutes before)
```bash
# Start all services
docker-compose up -d postgres redis
python -m app.api.main &

# Verify corpus size and performance
curl "localhost:8000/metrics/performance/live" | jq .corpus_stats

# Pre-warm caches
curl "localhost:8000/search/rag?q=python+programming&k=10&alpha=0.65"
curl "localhost:8000/search/rag?q=data+analysis&k=10&alpha=0.5"
```

### Live Demo Flow (8 minutes)

**1. Opening Hook** (60 seconds)
*"Last sprint, we proved MHE works across ChatGPT and Claude. Today, we're proving it scales to enterprise workloads with comprehensive AI assistant coverage."*

```bash
# Show corpus stats
curl "localhost:8000/metrics/performance/live" | jq .corpus_stats
```
*"Here's our test corpus: 250K messages across ChatGPT, Claude, and Gemini - real conversations spanning 6 months of actual AI usage."*

**2. Cross-Assistant Coverage** (90 seconds)
```bash
# Show Gemini integration working
curl "localhost:8000/search/rag?q=machine+learning+model&k=15&alpha=0.7" | jq '.contexts[] | {assistant, score}'
```
*"Search for 'machine learning model' - notice results from all three assistants, semantically ranked together. Gemini's code execution results, Claude's reasoning blocks, ChatGPT's tutorials - unified memory."*

**3. Performance Under Load** (120 seconds)
```bash
# Show performance metrics
curl "localhost:8000/metrics/performance/live" | jq .search_latency
```
*"Current p95 latency: 47 milliseconds. Let me show what happens under load..."*

```bash
# Start load test in background
python tests/load_test_search.py --users=50 --duration=30 &

# Monitor performance in real-time
curl "localhost:8000/metrics/performance/live" | jq .search_latency
```
*"50 concurrent users hitting the API - p95 stays under 50ms. This isn't just clever, it's production infrastructure."*

**4. Cache Intelligence** (90 seconds)
```bash
# Show cache performance
curl "localhost:8000/metrics/performance/live" | jq .cache_performance
```
*"Cache hit rates: 87% for embeddings, 92% for popular searches. Redis caching means common queries are sub-10ms, and we're not constantly hitting OpenAI's API."*

**5. Enterprise Scale Evidence** (60 seconds)
```bash
# Show resource efficiency
curl "localhost:8000/metrics/performance/live" | jq .database
```
*"4GB total memory usage for 250K messages with embeddings. Database pool handling 45 active connections efficiently. This scales to millions of messages on standard hardware."*

**6. Closing Proof** (30 seconds)
*"Three AI assistants, quarter-million messages, sub-50ms search, production caching - this isn't a prototype anymore. It's scalable infrastructure for enterprise AI memory."*

### Demo Talking Points

**Technical Credibility**
- "Sub-50ms p95 at 250K messages - most RAG systems are 10x slower"
- "HNSW indexing with production-tuned parameters (m=32, ef=128)"
- "Redis caching reduces API costs by 85% while improving speed"

**Architectural Proof**
- "Three parsers prove horizontal scaling - adding Gemini took 2 days"
- "Unified schema means cross-assistant search just works"
- "Performance monitoring shows this handles real-world load"

**Business Value**
- "One search across all your AI conversations, regardless of tool"
- "Performance that supports hundreds of concurrent users"
- "Infrastructure that scales with your organization's AI adoption"

---

## 🎯 Success Metrics Summary

### Performance Targets (Must Hit)
- [ ] **<50ms p95 search latency** at 100K+ messages
- [ ] **50+ concurrent users** without degradation
- [ ] **<4GB memory usage** for full corpus with embeddings
- [ ] **85%+ cache hit rates** for both embeddings and searches

### Coverage Targets (Must Hit)
- [ ] **3 AI assistants supported** (ChatGPT, Claude, Gemini)
- [ ] **Artifact detection working** for all assistant types
- [ ] **Unified search results** spanning all conversation sources

### Infrastructure Targets (Must Hit)
- [ ] **Production monitoring** with Prometheus metrics
- [ ] **Load testing suite** demonstrating scale capabilities
- [ ] **Resource efficiency** proving enterprise viability

### Demo Readiness (Must Hit)
- [ ] **8-minute demo** flows smoothly without technical issues
- [ ] **Performance numbers** are impressive and visible
- [ ] **Cross-assistant results** are obvious in API responses
- [ ] **Scale story** is compelling for enterprise buyers

---

*With Sprint 3 complete, MHE transforms from "interesting prototype" to "production-ready enterprise infrastructure." The cathedral now has performance, coverage, and credibility - ready for the enterprise market.*