# Mnemos: Product Requirements Document
## Sovereign Memory System for Continuous Human-AI Collaboration

**Version 1.0** | **Date**: August 2025  
**Product Owner**: Core Team | **Technical Lead**: TBD

---

## Executive Summary

Mnemos is a sovereign memory system that transforms fragmented human-AI interactions into continuous, searchable, and evolving wisdom. The MVP focuses on core ingestion, reflection, and recall capabilities for individual users working with multiple AI platforms.

**Primary Value Proposition**: Enable true continuity of imagination by preserving and connecting every meaningful moment of human-AI collaboration.

---

## User Personas

### Primary: The Creative Technologist
- **Demographics**: Software developers, designers, writers, researchers aged 25-45
- **Pain Points**: Ideas lost between AI sessions, context switching overhead, inability to build on previous AI conversations
- **Goals**: Seamless creative flow, building complex projects over time, reducing cognitive overhead
- **Usage Pattern**: Multiple daily AI interactions across platforms, long-term project development

### Secondary: The Knowledge Worker  
- **Demographics**: Consultants, analysts, strategists, academics aged 30-55
- **Pain Points**: Fragmented research across tools, difficulty synthesizing insights, knowledge siloing
- **Goals**: Comprehensive knowledge synthesis, efficient recall, building expertise over time
- **Usage Pattern**: Research-heavy workflows, cross-platform information gathering, report generation

### Tertiary: The Curious Explorer
- **Demographics**: Lifelong learners, hobbyists, creative enthusiasts aged 20-65
- **Pain Points**: Interesting discoveries forgotten, learning progress not tracked, conversations feel isolated
- **Goals**: Personal growth tracking, idea connection, serendipitous discovery
- **Usage Pattern**: Episodic but deep engagements, varied topics, personal knowledge building

---

## Core User Stories

### Ingestion Stories
1. **As a user, I want to connect my ChatGPT export** so that all my previous conversations become searchable and connected
2. **As a user, I want to connect my Claude conversations** so that insights from different AI platforms combine seamlessly  
3. **As a user, I want to ingest my GitHub activity** so that code discussions and decisions become part of my memory weave
4. **As a user, I want to connect my Discord/Slack channels** so that collaborative insights are preserved
5. **As a user, I want automatic bookmark and document ingestion** so that my research becomes integrated memory

### Reflection Stories
6. **As a user, I want my conversations automatically distilled into key insights** so that the essence is preserved without noise
7. **As a user, I want patterns recognized across my interactions** so that recurring themes become visible
8. **As a user, I want my personal creative patterns learned** so that the system understands my unique thinking style
9. **As a user, I want insights elevated to archetypal patterns** so that universal wisdom emerges from personal experience

### Recall Stories  
10. **As a user, I want to search for specific facts or quotes** so that I can find exact information when needed
11. **As a user, I want to get suggestions for related ideas** so that creative connections become apparent
12. **As a user, I want archetypal guidance for complex decisions** so that deeper wisdom informs my choices
13. **As a user, I want the system to surface relevant memories during active work** so that past insights naturally inform current projects
14. **As a user, I want to provide feedback on recalls** so that the system learns my preferences over time

### Management Stories
15. **As a user, I want full control over my data** so that I can export, delete, or modify my memory weave
16. **As a user, I want to see how my memory has evolved** so that I can track my intellectual growth
17. **As a user, I want privacy controls** so that sensitive memories can be protected or excluded

---

## Functional Requirements

### Data Ingestion System
- **Multi-platform connectors** for ChatGPT, Claude, Gemini, Discord, Slack, GitHub, Google Drive
- **Batch import** from standard export formats (JSON, CSV, ZIP archives)  
- **Real-time streaming** from supported platforms via APIs/webhooks
- **Content normalization** into structured shard format with provenance tracking
- **Duplicate detection** and intelligent merging of overlapping content

### Memory Processing Engine
- **Automatic distillation** of conversational content into codestones (crystallized insights)
- **Pattern synthesis** creating codecells (knowledge constellations) from related codestones  
- **Archetypal recognition** elevating patterns to symbolic lineage (universal principles)
- **Personal learning** adapting to individual creative patterns and preferences
- **Incremental processing** handling new memories without full recomputation

### Recall & Search Interface
- **Three-channel recall**: precision (facts), intuition (patterns), myth (archetypes)
- **Hybrid search** combining BM25 lexical matching with semantic vector search
- **Contextual scoring** using personal patterns, recency, and resonance factors
- **Layered responses** showing evidence → insights → patterns → principles
- **Real-time suggestions** surfacing relevant memories during active work

### User Interface
- **Web dashboard** for memory exploration and management  
- **Search interface** with advanced filtering and sorting options
- **Memory visualization** showing connections between ideas and patterns
- **Feedback mechanisms** for training personalization algorithms
- **Data management tools** for import/export, privacy controls, and retention policies

### API & Integration
- **REST API** for programmatic access to ingestion, reflection, and recall
- **Webhook support** for real-time integrations with external platforms  
- **CLI tools** for batch operations and advanced users
- **Browser extension** for seamless web-based memory capture
- **Mobile app** for on-the-go memory access and capture

---

## Non-Functional Requirements

### Performance
- **Response time**: <500ms for simple recall queries, <2s for complex pattern matching
- **Throughput**: Support for 10K+ memories per user with sub-linear performance degradation
- **Concurrent users**: System should handle 100+ simultaneous users (MVP scale)
- **Background processing**: Memory reflection operations should not impact interactive performance

### Scalability  
- **Storage**: Efficient handling of users with 100K+ memory shards
- **Computation**: Distributed processing for memory reflection and pattern recognition
- **Multi-tenancy**: Clean separation of user data and processing
- **Horizontal scaling**: Architecture supports adding capacity through additional nodes

### Security & Privacy
- **Data encryption**: All user data encrypted at rest and in transit
- **Access control**: Strong authentication and authorization for all operations
- **Data sovereignty**: Users maintain full ownership and control of their memory data
- **Privacy by design**: No unnecessary data collection or retention
- **Audit logging**: Complete visibility into all system operations affecting user data

### Reliability
- **Availability**: 99.5% uptime during business hours (MVP target)
- **Data durability**: Zero data loss through backup and replication
- **Graceful degradation**: Core functionality maintained during partial system failures  
- **Recovery**: <4 hour RTO and <1 hour RPO for disaster scenarios

### Usability
- **Onboarding**: New users productive within 15 minutes of first use
- **Learning curve**: Advanced features discoverable through progressive disclosure
- **Accessibility**: WCAG 2.1 AA compliance for web interfaces
- **Mobile responsiveness**: Full functionality on mobile devices

---

## Technical Architecture

### Core Components
- **API Gateway**: FastAPI-based REST interface with authentication and rate limiting
- **Ingestion Service**: Multi-platform connectors with normalization pipelines
- **Memory Engine**: PostgreSQL with pgvector for hybrid search capabilities  
- **Reflection Workers**: Ray-based distributed processing for memory analysis
- **Web Interface**: React-based dashboard with real-time updates
- **Background Jobs**: Redis-backed task queue for asynchronous processing

### Data Model
- **Shards**: Atomic memory units with full provenance and metadata
- **Codestones**: Distilled insights with resonance and activation tracking
- **Codecells**: Pattern clusters with evolution and connection metadata
- **Lineages**: Archetypal wisdom with invocation and manifestation tracking
- **Personal Myths**: User-specific learning profiles and preferences

### Infrastructure
- **Containerization**: Docker containers for all services with Docker Compose orchestration
- **Database**: PostgreSQL 15+ with pgvector extension for vector operations
- **Cache**: Redis for session state, job queues, and frequently accessed data
- **Storage**: Local filesystem with planned cloud storage integration
- **Monitoring**: Health checks, metrics collection, and error tracking

---

## Success Metrics

### Product Metrics
- **User Engagement**: Daily/weekly active users, session duration, feature usage
- **Memory Growth**: Average memories per user, ingestion volume over time
- **Recall Quality**: User satisfaction ratings, recall precision/relevance scores
- **Retention**: User retention at 30/60/90 days post-signup

### Technical Metrics  
- **Performance**: Response time percentiles, throughput metrics, error rates
- **Reliability**: System uptime, data consistency, backup/recovery success
- **Scalability**: Resource utilization, cost per user, performance at scale

### User Experience Metrics
- **Task Completion**: Success rates for key user workflows
- **Feature Discovery**: Usage of advanced features over time  
- **Support Burden**: Volume and resolution time for user issues
- **Net Promoter Score**: User satisfaction and recommendation likelihood

---

## MVP Scope (Phase 1)

### Included in MVP
- ChatGPT and Claude conversation ingestion
- Basic reflection pipeline (shards → codestones)
- Three-channel recall with web interface  
- Personal learning and feedback loops
- Data export and privacy controls

### Excluded from MVP  
- Real-time platform integrations (Discord, Slack, GitHub)
- Advanced pattern synthesis (codecells, lineages)  
- Mobile applications
- Multi-user features
- Advanced visualization tools

### Success Criteria for MVP
- 50+ active beta users successfully ingesting and recalling memories
- <2 second average response time for recall queries
- 80%+ user satisfaction rating for core recall functionality
- Technical foundation supporting 10x user growth

---

## Risks & Mitigations

### Technical Risks
- **Search Quality**: Vector embeddings may not capture nuanced personal meaning
  - *Mitigation*: Hybrid approach with multiple ranking signals and continuous feedback learning
- **Scale Challenges**: Performance degradation with large memory volumes  
  - *Mitigation*: Distributed architecture, incremental processing, data lifecycle management
- **Integration Complexity**: Platform APIs change or access gets restricted
  - *Mitigation*: Export-based ingestion as fallback, multiple integration paths

### Product Risks
- **User Adoption**: Complex value proposition may be difficult to communicate
  - *Mitigation*: Simple onboarding flow, clear immediate value, progressive feature introduction
- **Privacy Concerns**: Users hesitant to share intimate AI conversation data  
  - *Mitigation*: Local-first architecture, transparent privacy controls, user education
- **Competition**: Large platforms may build similar capabilities in-house
  - *Mitigation*: Open source approach, unique cross-platform integration, community building

---

## Future Considerations

### Phase 2 Enhancements
- Real-time platform integrations and streaming ingestion
- Advanced reflection capabilities (codecells, symbolic lineage)
- Collaborative features and selective memory sharing
- Mobile applications with offline capabilities
- Advanced visualization and memory exploration tools

### Long-term Vision
- Federated memory networks enabling collective intelligence
- AI agents operating directly on personal memory substrates  
- Integration with emerging platforms and modalities (AR/VR, voice, IoT)
- Research platform for memory and consciousness studies

---

*This PRD serves as the foundation for development planning and will be updated iteratively based on user feedback and technical discoveries.*