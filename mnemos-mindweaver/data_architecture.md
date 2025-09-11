# DATA ARCHITECTURE
## Chat Archive Intelligence Extraction & Agentic Integration System

### ARCHITECTURE OVERVIEW

The data architecture implements a polyglot persistence strategy, utilizing specialized databases optimized for different data types and access patterns. The architecture supports high-volume chat processing, semantic search, graph relationships, and real-time analytics while maintaining data consistency and performance.

### MULTI-DATABASE STRATEGY

#### Database Selection Matrix

```
┌─────────────────────────────────────────────────────────────────┐
│                    DATA STORAGE ECOSYSTEM                       │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   PostgreSQL    │  │   Vector DB     │  │    Graph DB     │
│                 │  │   (Pinecone/    │  │    (Neo4j)      │
│  • Metadata     │  │   Weaviate)     │  │                 │
│  • Users        │  │                 │  │  • Dependencies │
│  • Sessions     │  │  • Embeddings   │  │  • Relationships│
│  • Audit logs   │  │  • Similarity   │  │  • Hierarchies  │
└─────────────────┘  └─────────────────┘  └─────────────────┘
         │                     │                     │
         └─────────────────────┼─────────────────────┘
                               │
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│     Redis       │  │   InfluxDB      │  │  Object Store   │
│                 │  │                 │  │   (MinIO/S3)    │
│  • Cache        │  │  • Metrics      │  │                 │
│  • Sessions     │  │  • Time series  │  │  • Raw archives │
│  • Queues       │  │  • Analytics    │  │  • Backups      │
│  • Rate limits  │  │  • Monitoring   │  │  • Large files  │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

#### Database Responsibilities

**PostgreSQL (Primary Relational Store)**:
- Structured metadata and configuration
- User management and authentication
- Audit logs and system events
- Transactional consistency for critical operations

**Vector Database (Semantic Search)**:
- High-dimensional embeddings storage
- Similarity search operations
- Metadata filtering capabilities
- Horizontal scaling for large vector sets

**Graph Database (Relationships)**:
- Concept dependency mapping
- Project relationship tracking
- Hierarchical data structures
- Complex traversal queries

**Redis (Caching & Queuing)**:
- Application-level caching
- Session management
- Message queues for async processing
- Rate limiting and throttling

**InfluxDB (Time Series)**:
- System performance metrics
- Usage analytics
- Processing statistics
- Trend analysis data

**Object Storage (Blob Data)**:
- Raw chat archive files
- Database backups
- Large binary assets
- Static file serving

### POSTGRESQL SCHEMA DESIGN

#### Core Entity Relationships

```sql
-- Core schema for intelligence system
CREATE SCHEMA intelligence;

-- Chat platforms and sources
CREATE TABLE intelligence.platforms (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    supported_formats JSONB NOT NULL,
    parser_class VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Chat archive processing sessions
CREATE TABLE intelligence.extraction_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform_id INTEGER NOT NULL REFERENCES intelligence.platforms(id),
    file_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    file_hash VARCHAR(64) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    metrics JSONB,
    created_by VARCHAR(255),
    
    CONSTRAINT valid_status CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled'))
);

-- Individual conversations within archives
CREATE TABLE intelligence.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES intelligence.extraction_sessions(id) ON DELETE CASCADE,
    platform_conversation_id VARCHAR(255),
    title TEXT,
    participant_count INTEGER DEFAULT 2,
    message_count INTEGER DEFAULT 0,
    started_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER GENERATED ALWAYS AS (
        CASE 
            WHEN started_at IS NOT NULL AND ended_at IS NOT NULL 
            THEN EXTRACT(EPOCH FROM (ended_at - started_at))::INTEGER
            ELSE NULL 
        END
    ) STORED,
    metadata JSONB,
    
    CONSTRAINT valid_duration CHECK (ended_at IS NULL OR ended_at >= started_at),
    INDEX idx_conversations_session ON conversations(session_id),
    INDEX idx_conversations_timerange ON conversations(started_at, ended_at)
);

-- Individual messages within conversations
CREATE TABLE intelligence.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES intelligence.conversations(id) ON DELETE CASCADE,
    sequence_number INTEGER NOT NULL,
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    token_count INTEGER,
    timestamp TIMESTAMP WITH TIME ZONE,
    metadata JSONB,
    
    UNIQUE(conversation_id, sequence_number),
    INDEX idx_messages_conversation ON messages(conversation_id),
    INDEX idx_messages_timestamp ON messages(timestamp),
    INDEX idx_messages_role ON messages(role)
);

-- Extracted intelligence items
CREATE TABLE intelligence.intelligence_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES intelligence.conversations(id),
    source_message_ids UUID[] NOT NULL,
    type intelligence_type NOT NULL,
    title VARCHAR(500) NOT NULL,
    summary TEXT NOT NULL,
    content TEXT NOT NULL,
    confidence_score DECIMAL(3,2) NOT NULL CHECK (confidence_score BETWEEN 0 AND 1),
    completeness_score DECIMAL(3,2) CHECK (completeness_score BETWEEN 0 AND 1),
    priority_score DECIMAL(3,2) CHECK (priority_score BETWEEN 0 AND 1),
    tags TEXT[],
    metadata JSONB,
    extracted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    vector_id VARCHAR(255),
    
    INDEX idx_intelligence_type ON intelligence_items(type),
    INDEX idx_intelligence_confidence ON intelligence_items(confidence_score),
    INDEX idx_intelligence_conversation ON intelligence_items(conversation_id),
    INDEX idx_intelligence_extracted_at ON intelligence_items(extracted_at)
);

-- Custom enum for intelligence types
CREATE TYPE intelligence_type AS ENUM (
    'incomplete_idea',
    'feature_request', 
    'problem_statement',
    'solution_approach',
    'technical_decision',
    'learning_moment'
);

-- Intelligence dependencies and relationships
CREATE TABLE intelligence.intelligence_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_intelligence_id UUID NOT NULL REFERENCES intelligence.intelligence_items(id) ON DELETE CASCADE,
    target_intelligence_id UUID NOT NULL REFERENCES intelligence.intelligence_items(id) ON DELETE CASCADE,
    relationship_type VARCHAR(50) NOT NULL,
    strength DECIMAL(3,2) NOT NULL CHECK (strength BETWEEN 0 AND 1),
    confidence DECIMAL(3,2) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB,
    
    UNIQUE(source_intelligence_id, target_intelligence_id, relationship_type),
    CHECK (source_intelligence_id != target_intelligence_id),
    INDEX idx_relationships_source ON intelligence_relationships(source_intelligence_id),
    INDEX idx_relationships_target ON intelligence_relationships(target_intelligence_id),
    INDEX idx_relationships_type ON intelligence_relationships(relationship_type)
);

-- Agent management
CREATE TABLE intelligence.agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_identifier VARCHAR(255) NOT NULL UNIQUE,
    display_name VARCHAR(255) NOT NULL,
    role agent_role NOT NULL DEFAULT 'standard',
    permissions JSONB NOT NULL,
    rate_limit_per_minute INTEGER NOT NULL DEFAULT 100,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_active TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    metadata JSONB
);

-- Custom enum for agent roles
CREATE TYPE agent_role AS ENUM (
    'read_only',
    'standard', 
    'premium',
    'curator',
    'administrator'
);

-- Agent activity and usage tracking
CREATE TABLE intelligence.agent_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES intelligence.agents(id),
    activity_type VARCHAR(50) NOT NULL,
    resource_accessed TEXT,
    request_details JSONB,
    response_status INTEGER,
    processing_time_ms INTEGER,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    INDEX idx_activities_agent ON agent_activities(agent_id),
    INDEX idx_activities_timestamp ON agent_activities(timestamp),
    INDEX idx_activities_type ON agent_activities(activity_type)
);

-- Quality feedback from agents
CREATE TABLE intelligence.intelligence_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    intelligence_id UUID NOT NULL REFERENCES intelligence.intelligence_items(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES intelligence.agents(id),
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    feedback_type VARCHAR(50) NOT NULL,
    comments TEXT,
    implementation_successful BOOLEAN,
    time_saved_hours DECIMAL(5,2),
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(intelligence_id, agent_id, feedback_type),
    INDEX idx_feedback_intelligence ON intelligence_feedback(intelligence_id),
    INDEX idx_feedback_rating ON intelligence_feedback(rating)
);
```

#### Advanced Indexing Strategy

**Performance Optimization Indexes**:
```sql
-- Composite indexes for common query patterns
CREATE INDEX CONCURRENTLY idx_intelligence_search_composite 
ON intelligence.intelligence_items (type, confidence_score DESC, extracted_at DESC);

CREATE INDEX CONCURRENTLY idx_messages_conversation_sequence 
ON intelligence.messages (conversation_id, sequence_number);

CREATE INDEX CONCURRENTLY idx_activities_agent_timestamp 
ON intelligence.agent_activities (agent_id, timestamp DESC);

-- Partial indexes for active data
CREATE INDEX CONCURRENTLY idx_active_agents 
ON intelligence.agents (agent_identifier) WHERE is_active = true;

CREATE INDEX CONCURRENTLY idx_successful_extractions 
ON intelligence.extraction_sessions (started_at DESC) WHERE status = 'completed';

-- Text search indexes
CREATE INDEX CONCURRENTLY idx_intelligence_content_search 
ON intelligence.intelligence_items USING gin(to_tsvector('english', content));

CREATE INDEX CONCURRENTLY idx_intelligence_title_search 
ON intelligence.intelligence_items USING gin(to_tsvector('english', title));

-- JSONB indexes for metadata queries
CREATE INDEX CONCURRENTLY idx_intelligence_metadata_gin 
ON intelligence.intelligence_items USING gin(metadata);

CREATE INDEX CONCURRENTLY idx_conversation_metadata_gin 
ON intelligence.conversations USING gin(metadata);
```

#### Data Partitioning Strategy

**Time-based Partitioning**:
```sql
-- Partition agent activities by month for performance
CREATE TABLE intelligence.agent_activities_template (
    LIKE intelligence.agent_activities INCLUDING ALL
) PARTITION BY RANGE (timestamp);

-- Create monthly partitions
CREATE TABLE intelligence.agent_activities_2024_03 
PARTITION OF intelligence.agent_activities_template
FOR VALUES FROM ('2024-03-01') TO ('2024-04-01');

-- Automated partition creation function
CREATE OR REPLACE FUNCTION intelligence.create_monthly_partition(
    table_name TEXT,
    start_date DATE
)
RETURNS TEXT AS $
DECLARE
    partition_name TEXT;
    end_date DATE;
BEGIN
    partition_name := table_name || '_' || to_char(start_date, 'YYYY_MM');
    end_date := start_date + INTERVAL '1 month';
    
    EXECUTE format('CREATE TABLE IF NOT EXISTS intelligence.%I 
                   PARTITION OF intelligence.%I
                   FOR VALUES FROM (%L) TO (%L)',
                   partition_name, table_name || '_template', start_date, end_date);
    
    RETURN partition_name;
END;
$ LANGUAGE plpgsql;
```

### VECTOR DATABASE DESIGN

#### Vector Storage Schema

**Pinecone Configuration**:
```python
# Vector database configuration
VECTOR_DB_CONFIG = {
    'dimension': 384,  # sentence-transformers/all-MiniLM-L6-v2
    'metric': 'cosine',
    'pods': 1,
    'replicas': 1,
    'pod_type': 'p1.x1'
}

# Namespace strategy for data isolation
NAMESPACES = {
    'gpt_conversations': 'gpt',
    'gemini_conversations': 'gemini', 
    'claude_conversations': 'claude',
    'derived_intelligence': 'derived',
    'agent_feedback': 'feedback'
}

# Metadata schema for vector entries
VECTOR_METADATA_SCHEMA = {
    'intelligence_id': str,          # UUID from PostgreSQL
    'conversation_id': str,          # Source conversation UUID
    'type': str,                     # Intelligence type
    'confidence_score': float,       # Extraction confidence
    'timestamp': int,                # Unix timestamp
    'platform': str,                 # Source platform
    'tags': list,                    # Associated tags
    'agent_ratings': dict           # Aggregated agent feedback
}
```

**Weaviate Schema Alternative**:
```python
# Weaviate class definition
WEAVIATE_SCHEMA = {
    "class": "IntelligenceChunk",
    "description": "Semantic chunks of conversational intelligence",
    "properties": [
        {
            "name": "content",
            "dataType": ["text"],
            "description": "The intelligence content",
            "moduleConfig": {
                "text2vec-transformers": {
                    "skip": False,
                    "vectorizePropertyName": False
                }
            }
        },
        {
            "name": "intelligenceId", 
            "dataType": ["string"],
            "description": "PostgreSQL intelligence UUID",
            "moduleConfig": {"text2vec-transformers": {"skip": True}}
        },
        {
            "name": "intelligenceType",
            "dataType": ["string"],
            "description": "Type of intelligence",
            "moduleConfig": {"text2vec-transformers": {"skip": True}}
        },
        {
            "name": "confidenceScore",
            "dataType": ["number"],
            "description": "Extraction confidence",
            "moduleConfig": {"text2vec-transformers": {"skip": True}}
        },
        {
            "name": "platform",
            "dataType": ["string"], 
            "description": "Source platform",
            "moduleConfig": {"text2vec-transformers": {"skip": True}}
        },
        {
            "name": "extractedAt",
            "dataType": ["date"],
            "description": "When intelligence was extracted",
            "moduleConfig": {"text2vec-transformers": {"skip": True}}
        }
    ],
    "vectorizer": "text2vec-transformers",
    "moduleConfig": {
        "text2vec-transformers": {
            "model": "sentence-transformers/all-MiniLM-L6-v2"
        }
    }
}
```

#### Vector Operations and Management

**Embedding Management**:
```python
class VectorManager:
    """
    Manages vector database operations for intelligence embeddings
    """
    
    def __init__(self, vector_db_config):
        self.client = self.initialize_client(vector_db_config)
        self.embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
    
    async def upsert_intelligence_embedding(
        self, 
        intelligence_item: IntelligenceItem
    ) -> str:
        """
        Create or update vector embedding for intelligence item
        """
        # Generate embedding
        embedding = self.embedding_model.encode(
            intelligence_item.get_embedding_text()
        ).tolist()
        
        # Prepare metadata
        metadata = {
            'intelligence_id': str(intelligence_item.id),
            'conversation_id': str(intelligence_item.conversation_id),
            'type': intelligence_item.type,
            'confidence_score': float(intelligence_item.confidence_score),
            'timestamp': int(intelligence_item.extracted_at.timestamp()),
            'platform': intelligence_item.platform,
            'tags': intelligence_item.tags
        }
        
        # Upsert to vector database
        vector_id = f"intel_{intelligence_item.id}"
        await self.client.upsert(
            vectors=[(vector_id, embedding, metadata)],
            namespace=f"platform_{intelligence_item.platform}"
        )
        
        return vector_id
    
    async def similarity_search(
        self, 
        query: str, 
        filters: dict = None,
        top_k: int = 10
    ) -> List[SearchResult]:
        """
        Perform semantic similarity search
        """
        # Generate query embedding
        query_embedding = self.embedding_model.encode(query).tolist()
        
        # Build filter expression
        filter_expr = self.build_filter_expression(filters) if filters else None
        
        # Execute search
        results = await self.client.query(
            vector=query_embedding,
            filter=filter_expr,
            top_k=top_k,
            include_metadata=True,
            include_values=False
        )
        
        return [
            SearchResult(
                intelligence_id=match.metadata['intelligence_id'],
                score=match.score,
                metadata=match.metadata
            )
            for match in results.matches
        ]
```

### GRAPH DATABASE DESIGN

#### Neo4j Schema and Relationships

**Node Types and Properties**:
```cypher
// Intelligence concepts as nodes
CREATE CONSTRAINT intelligence_id_unique 
FOR (i:Intelligence) REQUIRE i.id IS UNIQUE;

CREATE CONSTRAINT conversation_id_unique 
FOR (c:Conversation) REQUIRE c.id IS UNIQUE;

// Intelligence node structure
CREATE (i:Intelligence {
    id: $intelligence_id,
    type: $type,
    title: $title,
    confidence_score: $confidence,
    platform: $platform,
    extracted_at: datetime($timestamp),
    tags: $tags
});

// Conversation node structure  
CREATE (c:Conversation {
    id: $conversation_id,
    platform: $platform,
    started_at: datetime($start_time),
    message_count: $message_count,
    participant_count: $participant_count
});

// Project context nodes
CREATE (p:Project {
    id: $project_id,
    name: $project_name,
    created_at: datetime($created_at),
    status: $status
});
```

**Relationship Types**:
```cypher
// Dependency relationships
CREATE (source:Intelligence)-[:DEPENDS_ON {
    strength: $strength,
    confidence: $confidence,
    relationship_type: 'prerequisite',
    created_at: datetime()
}]->(target:Intelligence);

// Conversation relationships
CREATE (intelligence:Intelligence)-[:EXTRACTED_FROM {
    message_ids: $message_ids,
    extraction_confidence: $confidence
}]->(conversation:Conversation);

// Project associations
CREATE (intelligence:Intelligence)-[:RELATES_TO {
    relevance_score: $relevance,
    context: $context
}]->(project:Project);

// Concept evolution
CREATE (earlier:Intelligence)-[:EVOLVES_TO {
    evolution_type: 'refinement',
    time_gap_hours: $hours,
    similarity_score: $similarity
}]->(later:Intelligence);

// Agent interaction relationships
CREATE (agent:Agent)-[:RATED {
    rating: $rating,
    feedback_type: $type,
    timestamp: datetime(),
    implementation_success: $success
}]->(intelligence:Intelligence);
```

**Complex Query Examples**:
```cypher
// Find dependency chains for a concept
MATCH path = (start:Intelligence {id: $intelligence_id})-[:DEPENDS_ON*1..5]-(end:Intelligence)
WHERE start.id <> end.id
RETURN path, 
       length(path) as dependency_depth,
       [node in nodes(path) | node.title] as concept_chain
ORDER BY dependency_depth;

// Identify concept evolution patterns
MATCH (earlier:Intelligence)-[evolves:EVOLVES_TO*1..3]->(later:Intelligence)
WHERE earlier.platform = 'gpt' AND later.platform = 'gemini'
RETURN earlier.title, later.title, 
       [rel in evolves | rel.evolution_type] as evolution_path,
       reduce(total = 0, rel in evolves | total + rel.similarity_score) / length(evolves) as avg_similarity;

// Find highly connected intelligence hubs
MATCH (intelligence:Intelligence)
OPTIONAL MATCH (intelligence)-[r]-(connected)
WITH intelligence, count(r) as connection_count
WHERE connection_count > 5
RETURN intelligence.title, intelligence.type, connection_count
ORDER BY connection_count DESC
LIMIT 20;
```

### CACHING STRATEGY

#### Redis Cache Architecture

**Cache Layers and TTL Strategy**:
```python
CACHE_CONFIG = {
    'layers': {
        'l1_hot_cache': {
            'ttl': 300,  # 5 minutes
            'max_entries': 1000,
            'use_cases': ['frequent_searches', 'active_sessions']
        },
        'l2_warm_cache': {
            'ttl': 3600,  # 1 hour
            'max_entries': 10000,
            'use_cases': ['intelligence_metadata', 'agent_permissions']
        },
        'l3_cold_cache': {
            'ttl': 86400,  # 24 hours
            'max_entries': 100000,
            'use_cases': ['static_content', 'aggregated_metrics']
        }
    },
    'eviction_policy': 'allkeys-lru',
    'memory_limit': '2gb'
}

class CacheManager:
    """
    Manages multi-layered caching strategy
    """
    
    def __init__(self, redis_client):
        self.redis = redis_client
        
    async def get_intelligence_summary(self, intelligence_id: str) -> Optional[dict]:
        """
        Get intelligence summary with cache hierarchy
        """
        cache_key = f"intel:summary:{intelligence_id}"
        
        # Try L1 cache first (hot data)
        cached = await self.redis.get(f"l1:{cache_key}")
        if cached:
            return json.loads(cached)
        
        # Try L2 cache (warm data)
        cached = await self.redis.get(f"l2:{cache_key}")
        if cached:
            # Promote to L1 cache
            await self.redis.setex(
                f"l1:{cache_key}",
                CACHE_CONFIG['layers']['l1_hot_cache']['ttl'],
                cached
            )
            return json.loads(cached)
        
        # Cache miss - would fetch from database
        return None
    
    async def cache_search_results(
        self, 
        query_hash: str, 
        results: List[dict],
        cache_level: str = 'l2'
    ):
        """
        Cache search results with appropriate TTL
        """
        cache_key = f"{cache_level}:search:{query_hash}"
        ttl = CACHE_CONFIG['layers'][f'{cache_level}_cache']['ttl']
        
        await self.redis.setex(
            cache_key,
            ttl,
            json.dumps(results, default=str)
        )
```

### DATA LIFECYCLE MANAGEMENT

#### Automated Data Archiving

**Retention Policies**:
```yaml
data_retention:
  raw_chat_archives:
    retention_period: "2 years"
    archive_after: "6 months"
    archive_location: "cold_storage"
    
  intelligence_items:
    retention_period: "5 years"
    archive_after: "2 years"
    soft_delete: true
    
  agent_activities:
    retention_period: "1 year"
    archive_after: "3 months"
    aggregation_rules:
      - daily_summaries: "1 year"
      - weekly_summaries: "2 years"
      
  system_metrics:
    retention_period: "2 years"
    archive_after: "6 months"
    downsampling:
      - "1 hour resolution after 1 month"
      - "1 day resolution after 6 months"
```

**Archiving Implementation**:
```python
class DataLifecycleManager:
    """
    Manages automated data archiving and cleanup
    """
    
    def __init__(self, db_connections):
        self.postgres = db_connections['postgres']
        self.object_store = db_connections['object_store']
        self.influxdb = db_connections['influxdb']
    
    async def archive_old_activities(self, cutoff_date: datetime):
        """
        Archive old agent activities to cold storage
        """
        # Export data to object storage
        export_path = f"archives/agent_activities/{cutoff_date.strftime('%Y_%m')}.parquet"
        
        query = """
        SELECT * FROM intelligence.agent_activities 
        WHERE timestamp < %s
        ORDER BY timestamp
        """
        
        # Stream data to Parquet format
        async with self.postgres.connection() as conn:
            cursor = await conn.cursor()
            await cursor.execute(query, (cutoff_date,))
            
            df = pd.DataFrame(await cursor.fetchall())
            parquet_buffer = io.BytesIO()
            df.to_parquet(parquet_buffer, engine='pyarrow', compression='snappy')
            
            # Upload to object storage
            await self.object_store.put_object(
                bucket='intelligence-archives',
                key=export_path,
                data=parquet_buffer.getvalue()
            )
        
        # Delete archived records
        delete_query = """
        DELETE FROM intelligence.agent_activities 
        WHERE timestamp < %s
        """
        
        async with self.postgres.connection() as conn:
            cursor = await conn.cursor()
            result = await cursor.execute(delete_query, (cutoff_date,))
            await conn.commit()
            
        return result.rowcount
```

### BACKUP AND RECOVERY

#### Backup Strategy

**Multi-layered Backup Approach**:
```yaml
backup_strategy:
  database_backups:
    frequency: "daily"
    retention: "30 days"
    method: "pg_dump with compression"
    storage: "object_storage"
    
  incremental_backups:
    frequency: "hourly"
    retention: "7 days" 
    method: "WAL archiving"
    storage: "object_storage"
    
  vector_database:
    frequency: "daily"
    retention: "14 days"
    method: "full_export"
    storage: "object_storage"
    
  graph_database:
    frequency: "daily"
    retention: "30 days"
    method: "neo4j_dump"
    storage: "object_storage"
```

**Backup Implementation**:
```bash
#!/bin/bash
# scripts/backup-databases.sh

set -euo pipefail

BACKUP_DATE=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="/tmp/backups"
S3_BUCKET="intelligence-backups"

# PostgreSQL backup
echo "Starting PostgreSQL backup..."
pg_dump \
    --host="$POSTGRES_HOST" \
    --username="$POSTGRES_USER" \
    --dbname="$POSTGRES_DB" \
    --format=custom \
    --compress=9 \
    --file="$BACKUP_DIR/postgres_${BACKUP_DATE}.dump"

# Upload to object storage
aws s3 cp "$BACKUP_DIR/postgres_${BACKUP_DATE}.dump" \
    "s3://$S3_BUCKET/postgres/${BACKUP_DATE}/"

# Vector database backup (Pinecone export)
python scripts/backup_vectors.py \
    --output "$BACKUP_DIR/vectors_${BACKUP_DATE}.json"

aws s3 cp "$BACKUP_DIR/vectors_${BACKUP_DATE}.json" \
    "s3://$S3_BUCKET/vectors/${BACKUP_DATE}/"

# Graph database backup
neo4j-admin dump \
    --database=neo4j \
    --to="$BACKUP_DIR/neo4j_${BACKUP_DATE}.dump"

aws s3 cp "$BACKUP_DIR/neo4j_${BACKUP_DATE}.dump" \
    "s3://$S3_BUCKET/neo4j/${BACKUP_DATE}/"

# Cleanup local files
rm -rf "$BACKUP_DIR"/*

echo "Backup completed: $BACKUP_DATE"
```

#### Disaster Recovery Procedures

**Recovery Time Objectives (RTO) and Recovery Point Objectives (RPO)**:
```yaml
disaster_recovery:
  rto_targets:
    database_recovery: "4 hours"
    vector_database: "2 hours"
    full_system: "8 hours"
    
  rpo_targets:
    transactional_data: "1 hour"  # WAL archiving
    vector_data: "24 hours"       # Daily backups
    graph_data: "24 hours"        # Daily backups
    
  recovery_procedures:
    - assess_damage
    - restore_core_databases
    - rebuild_vector_indexes
    - restore_graph_relationships
    - verify_data_integrity
    - resume_normal_operations
```

**Recovery Script**:
```bash
#!/bin/bash
# scripts/disaster-recovery.sh

RECOVERY_DATE=${1:-"latest"}
RECOVERY_MODE=${2:-"full"}  # full, partial, test

echo "Starting disaster recovery: mode=$RECOVERY_MODE, date=$RECOVERY_DATE"

# Restore PostgreSQL
if [[ "$RECOVERY_MODE" == "full" || "$RECOVERY_MODE" == "partial" ]]; then
    echo "Restoring PostgreSQL database..."
    
    # Download backup
    aws s3 cp "s3://$S3_BUCKET/postgres/$RECOVERY_DATE/" ./recovery/ --recursive
    
    # Restore database
    pg_restore \
        --host="$POSTGRES_HOST" \
        --username="$POSTGRES_USER" \
        --dbname="$POSTGRES_DB" \
        --clean \
        --if-exists \
        ./recovery/postgres_*.dump
fi

# Restore vector database
if [[ "$RECOVERY_MODE" == "full" ]]; then
    echo "Restoring vector database..."
    
    aws s3 cp "s3://$S3_BUCKET/vectors/$RECOVERY_DATE/" ./recovery/ --recursive
    python scripts/restore_vectors.py --input ./recovery/vectors_*.json
fi

# Restore graph database
if [[ "$RECOVERY_MODE" == "full" ]]; then
    echo "Restoring graph database..."
    
    aws s3 cp "s3://$S3_BUCKET/neo4j/$RECOVERY_DATE/" ./recovery/ --recursive
    neo4j-admin restore --from=./recovery/neo4j_*.dump --database=neo4j --force
fi

# Verify recovery
echo "Verifying recovery..."
python scripts/verify_recovery.py --mode=$RECOVERY_MODE

echo "Disaster recovery completed successfully"
```

### PERFORMANCE OPTIMIZATION

#### Database Performance Tuning

**PostgreSQL Optimization**:
```sql
-- Connection pooling settings
ALTER SYSTEM SET max_connections = 200;
ALTER SYSTEM SET shared_buffers = '8GB';
ALTER SYSTEM SET effective_cache_size = '24GB';
ALTER SYSTEM SET work_mem = '32MB';
ALTER SYSTEM SET maintenance_work_mem = '1GB';

-- Query optimization
ALTER SYSTEM SET random_page_cost = 1.1;  -- SSD optimization
ALTER SYSTEM SET effective_io_concurrency = 200;
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '64MB';

-- Monitoring and statistics
ALTER SYSTEM SET track_activities = on;
ALTER SYSTEM SET track_counts = on;
ALTER SYSTEM SET track_io_timing = on;
ALTER SYSTEM SET track_functions = 'all';
ALTER SYSTEM SET log_min_duration_statement = 1000;  -- Log slow queries

SELECT pg_reload_conf();
```

**Query Performance Monitoring**:
```sql
-- Create monitoring views for performance analysis
CREATE VIEW intelligence.slow_queries AS
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    max_time,
    stddev_time,
    rows
FROM pg_stat_statements 
WHERE mean_time > 100  -- Queries taking more than 100ms on average
ORDER BY total_time DESC;

-- Index usage analysis
CREATE VIEW intelligence.index_usage AS
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_tup_read,
    idx_tup_fetch,
    idx_scan,
    CASE 
        WHEN idx_scan = 0 THEN 'UNUSED'
        WHEN idx_tup_read < idx_tup_fetch * 0.01 THEN 'LOW_EFFICIENCY'
        ELSE 'GOOD'
    END as index_status
FROM pg_stat_user_indexes
WHERE schemaname = 'intelligence'
ORDER BY idx_scan DESC;
```

This comprehensive data architecture provides the foundation for efficiently storing, retrieving, and managing the complex data relationships in your chat archive intelligence system. The polyglot persistence approach ensures optimal performance for different data access patterns while maintaining consistency and reliability.