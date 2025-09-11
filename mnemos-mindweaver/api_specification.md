# API SPECIFICATION
## Chat Archive Intelligence Extraction & Agentic Integration System

### API OVERVIEW

The Intelligence API provides RESTful endpoints for agents to query, retrieve, and interact with extracted conversational intelligence. The API is designed for high performance, semantic search capabilities, and contextual intelligence delivery.

**Base URL**: `https://api.intelligence-system.local/v1`
**API Version**: 1.0
**Content Type**: `application/json`
**Authentication**: Bearer JWT tokens

### AUTHENTICATION

#### JWT Token Requirements
```http
Authorization: Bearer <jwt_token>
```

**Token Payload Structure**:
```json
{
  "agent_id": "agent_12345",
  "permissions": ["read", "query", "feedback"],
  "expires": 1640995200,
  "project_scope": ["project_alpha", "project_beta"]
}
```

#### Authentication Endpoints

##### POST /auth/token
Generate authentication token for agent access.

**Request Body**:
```json
{
  "agent_id": "string",
  "api_key": "string",
  "scope": ["read", "query", "feedback"]
}
```

**Response**:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 3600,
  "scope": ["read", "query", "feedback"]
}
```

### CORE INTELLIGENCE ENDPOINTS

#### GET /intelligence/search
Semantic search across extracted intelligence.

**Query Parameters**:
```
query (required): Search query string
limit (optional): Maximum results (default: 20, max: 100)
offset (optional): Pagination offset (default: 0)
category (optional): Filter by intelligence category
relevance_threshold (optional): Minimum relevance score (0.0-1.0)
time_range (optional): ISO 8601 date range filter
project_context (optional): Project ID for contextual filtering
```

**Example Request**:
```http
GET /intelligence/search?query=authentication implementation&limit=10&category=technical_solution&relevance_threshold=0.7
```

**Response**:
```json
{
  "results": [
    {
      "id": "intel_001",
      "type": "technical_solution",
      "title": "JWT Authentication Implementation Discussion",
      "summary": "Detailed conversation about implementing JWT-based authentication with refresh tokens",
      "relevance_score": 0.89,
      "extraction_source": {
        "platform": "gpt",
        "conversation_id": "conv_456",
        "timestamp": "2024-03-15T14:30:00Z",
        "participants": ["user", "assistant"]
      },
      "concepts": [
        {
          "type": "incomplete_idea",
          "description": "Stateless authentication with JWT",
          "completeness": 0.7,
          "dependencies": ["security_framework", "token_storage"]
        }
      ],
      "context": {
        "preceding_discussion": "Database security concerns",
        "following_discussion": "Session management strategies",
        "related_projects": ["auth_service", "user_management"]
      },
      "actionable_insights": [
        "Implement JWT with 1-hour expiration",
        "Add refresh token rotation mechanism",
        "Consider Redis for token blacklisting"
      ]
    }
  ],
  "total_results": 47,
  "query_time_ms": 123,
  "suggestions": [
    "oauth implementation",
    "session management",
    "token validation"
  ]
}
```

#### GET /intelligence/{intelligence_id}
Retrieve detailed information about specific intelligence.

**Path Parameters**:
- `intelligence_id`: Unique identifier for intelligence item

**Response**:
```json
{
  "id": "intel_001",
  "type": "technical_solution",
  "title": "JWT Authentication Implementation Discussion",
  "full_content": "Complete extracted conversation content...",
  "metadata": {
    "extraction_confidence": 0.92,
    "last_updated": "2024-03-20T10:15:00Z",
    "processing_version": "1.2.3",
    "quality_score": 0.87
  },
  "relationships": {
    "dependencies": ["intel_003", "intel_007"],
    "derived_from": ["intel_001_parent"],
    "influences": ["intel_012", "intel_015"]
  },
  "evolution_history": [
    {
      "timestamp": "2024-03-10T09:00:00Z",
      "change_type": "concept_introduction",
      "description": "Initial authentication discussion"
    },
    {
      "timestamp": "2024-03-15T14:30:00Z",
      "change_type": "solution_refinement",
      "description": "Added JWT-specific implementation details"
    }
  ],
  "usage_analytics": {
    "query_count": 15,
    "last_accessed": "2024-03-19T16:45:00Z",
    "agent_feedback_score": 4.2,
    "implementation_success_rate": 0.8
  }
}
```

#### GET /intelligence/categories
Retrieve available intelligence categories and their descriptions.

**Response**:
```json
{
  "categories": [
    {
      "id": "incomplete_idea",
      "name": "Incomplete Ideas",
      "description": "Half-formed concepts that were never fully developed",
      "count": 234,
      "subcategories": ["technical_concept", "business_logic", "user_experience"]
    },
    {
      "id": "feature_request",
      "name": "Feature Requests",
      "description": "Desired functionality mentioned in conversations",
      "count": 156,
      "subcategories": ["user_interface", "api_enhancement", "integration"]
    },
    {
      "id": "problem_statement",
      "name": "Problem Statements",
      "description": "Identified pain points and challenges",
      "count": 89,
      "subcategories": ["performance", "security", "usability"]
    },
    {
      "id": "solution_approach",
      "name": "Solution Approaches",
      "description": "Different strategies considered for challenges",
      "count": 198,
      "subcategories": ["architecture", "algorithm", "workflow"]
    },
    {
      "id": "technical_decision",
      "name": "Technical Decisions",
      "description": "Architecture choices and their rationale",
      "count": 112,
      "subcategories": ["technology_choice", "design_pattern", "infrastructure"]
    },
    {
      "id": "learning_moment",
      "name": "Learning Moments",
      "description": "Insights gained from failed approaches",
      "count": 76,
      "subcategories": ["mistake_analysis", "best_practice", "optimization"]
    }
  ]
}
```

### CONTEXTUAL INTELLIGENCE ENDPOINTS

#### POST /intelligence/context-augmentation
Enhance agent queries with relevant historical context.

**Request Body**:
```json
{
  "query": "How should I implement user authentication?",
  "agent_context": {
    "current_project": "web_application",
    "technology_stack": ["python", "fastapi", "postgresql"],
    "previous_discussions": ["security_concerns", "database_design"]
  },
  "context_depth": "detailed",
  "max_historical_items": 5
}
```

**Response**:
```json
{
  "augmented_query": "How should I implement user authentication?",
  "historical_context": [
    {
      "relevance_score": 0.94,
      "intelligence_id": "intel_001",
      "summary": "Previous JWT authentication discussion with FastAPI integration",
      "key_insights": [
        "JWT with 1-hour expiration recommended",
        "FastAPI-Users library considered but rejected",
        "PostgreSQL session storage implemented"
      ]
    }
  ],
  "related_decisions": [
    {
      "decision": "Use bcrypt for password hashing",
      "rationale": "Industry standard with good performance",
      "conversation_source": "security_discussion_march_2024"
    }
  ],
  "potential_pitfalls": [
    "Avoid storing JWT in localStorage due to XSS vulnerability",
    "Remember to implement proper logout mechanism"
  ],
  "suggested_next_steps": [
    "Review existing authentication patterns in intel_001",
    "Consider OAuth2 implementation based on intel_007",
    "Implement rate limiting as discussed in intel_023"
  ]
}
```

#### GET /intelligence/dependency-graph/{concept_id}
Retrieve dependency relationships for a specific concept.

**Query Parameters**:
```
depth (optional): Graph traversal depth (default: 2, max: 5)
direction (optional): "upstream", "downstream", or "both" (default: "both")
```

**Response**:
```json
{
  "concept_id": "auth_implementation",
  "dependency_graph": {
    "nodes": [
      {
        "id": "auth_implementation",
        "type": "technical_solution",
        "completeness": 0.7,
        "priority": 0.8
      },
      {
        "id": "security_framework",
        "type": "infrastructure_requirement",
        "completeness": 0.9,
        "priority": 0.9
      }
    ],
    "edges": [
      {
        "from": "auth_implementation",
        "to": "security_framework",
        "relationship": "depends_on",
        "strength": 0.85
      }
    ]
  },
  "critical_path": ["security_framework", "auth_implementation", "user_session_management"],
  "blockers": [
    {
      "concept_id": "security_framework",
      "blocking_reason": "Incomplete security policy definition",
      "estimated_resolution_effort": "4 hours"
    }
  ]
}
```

### FEEDBACK AND LEARNING ENDPOINTS

#### POST /intelligence/feedback
Provide feedback on intelligence quality and usefulness.

**Request Body**:
```json
{
  "intelligence_id": "intel_001",
  "feedback_type": "usefulness",
  "rating": 4,
  "comments": "Very helpful for authentication implementation",
  "implemented": true,
  "modifications_needed": [
    "Add more details about refresh token handling"
  ],
  "agent_context": {
    "agent_id": "agent_12345",
    "project_context": "web_application",
    "implementation_outcome": "successful"
  }
}
```

**Response**:
```json
{
  "feedback_id": "feedback_789",
  "status": "recorded",
  "impact": {
    "intelligence_quality_score_delta": 0.05,
    "relevance_adjustment": 0.02,
    "future_ranking_influence": "increased"
  }
}
```

#### POST /intelligence/usage-report
Report successful implementation or usage of intelligence.

**Request Body**:
```json
{
  "intelligence_ids": ["intel_001", "intel_007"],
  "implementation_status": "completed",
  "success_metrics": {
    "time_saved_hours": 3.5,
    "accuracy_improvement": 0.15,
    "implementation_success": true
  },
  "lessons_learned": [
    "JWT expiration handling needed additional consideration",
    "Database session cleanup should be automated"
  ]
}
```

### STREAMING AND REAL-TIME ENDPOINTS

#### WebSocket /intelligence/stream
Real-time intelligence updates for active agents.

**Connection Parameters**:
```
agent_id: Required agent identifier
interests: Comma-separated list of intelligence categories
project_context: Current project context for filtering
```

**Message Format**:
```json
{
  "type": "new_intelligence",
  "intelligence": {
    "id": "intel_new_001",
    "type": "solution_approach",
    "title": "New authentication pattern discovered",
    "relevance_score": 0.88,
    "urgency": "medium"
  },
  "timestamp": "2024-03-20T15:30:00Z"
}
```

### ADMINISTRATIVE ENDPOINTS

#### GET /intelligence/stats
System statistics and health metrics.

**Response**:
```json
{
  "total_intelligence_items": 1247,
  "processing_stats": {
    "messages_processed_today": 2340,
    "average_processing_time_ms": 156,
    "extraction_accuracy": 0.89
  },
  "category_distribution": {
    "incomplete_idea": 234,
    "feature_request": 156,
    "problem_statement": 89
  },
  "agent_usage": {
    "active_agents": 12,
    "queries_per_hour": 45,
    "average_response_time_ms": 234
  }
}
```

### RATE LIMITING AND QUOTAS

#### Rate Limits
- **Search Queries**: 100 requests per minute per agent
- **Detail Retrieval**: 500 requests per minute per agent  
- **Context Augmentation**: 50 requests per minute per agent
- **Feedback Submission**: 20 requests per minute per agent

#### Quota Management
- **Monthly Query Limit**: 10,000 queries per agent
- **Data Transfer**: 1GB per month per agent
- **Concurrent Connections**: 5 WebSocket connections per agent

### ERROR CODES AND HANDLING

#### Standard HTTP Status Codes
- `200`: Success
- `400`: Bad Request - Invalid query parameters
- `401`: Unauthorized - Invalid or expired token
- `403`: Forbidden - Insufficient permissions
- `404`: Not Found - Intelligence item not found
- `429`: Too Many Requests - Rate limit exceeded
- `500`: Internal Server Error - System failure

#### Custom Error Response Format
```json
{
  "error": {
    "code": "INTELLIGENCE_NOT_FOUND",
    "message": "The requested intelligence item does not exist",
    "details": "Intelligence ID 'intel_999' was not found in the system",
    "suggestion": "Verify the intelligence ID or use the search endpoint to find relevant items",
    "retry_after": null,
    "request_id": "req_12345"
  }
}
```

#### Specific Error Codes
- `INVALID_QUERY_SYNTAX`: Malformed search query
- `INTELLIGENCE_NOT_FOUND`: Requested intelligence item doesn't exist
- `INSUFFICIENT_CONTEXT`: Not enough context for meaningful results
- `PROCESSING_TIMEOUT`: Query processing exceeded time limit
- `QUOTA_EXCEEDED`: Monthly usage limit reached
- `INVALID_CATEGORY`: Unknown intelligence category specified

### API VERSIONING

#### Version Strategy
- **URL Versioning**: `/v1/`, `/v2/` in the URL path
- **Backward Compatibility**: Minimum 12 months support for previous versions
- **Deprecation Notice**: 90-day advance notice via API headers

#### Version-Specific Headers
```http
API-Version: 1.0
API-Deprecated: false
API-Sunset-Date: null
```

### PERFORMANCE SPECIFICATIONS

#### Response Time Targets
- **Search Queries**: < 200ms for 95th percentile
- **Detail Retrieval**: < 100ms for 95th percentile
- **Context Augmentation**: < 500ms for 95th percentile
- **WebSocket Messages**: < 50ms delivery time

#### Throughput Capacity
- **Concurrent Agents**: 100+ simultaneous users
- **Query Volume**: 1000+ queries per minute system-wide
- **Data Processing**: 10,000+ messages processed per hour

### SDK AND CLIENT LIBRARIES

#### Python Client Example
```python
from intelligence_client import IntelligenceAPI

client = IntelligenceAPI(
    base_url="https://api.intelligence-system.local/v1",
    api_key="your_api_key"
)

# Search for intelligence
results = client.search(
    query="authentication implementation",
    category="technical_solution",
    limit=10
)

# Get contextual augmentation
context = client.augment_context(
    query="How to implement OAuth2?",
    project_context="web_application"
)
```

#### JavaScript Client Example
```javascript
import { IntelligenceClient } from '@intelligence-system/client';

const client = new IntelligenceClient({
  baseUrl: 'https://api.intelligence-system.local/v1',
  apiKey: 'your_api_key'
});

// Stream real-time intelligence
const stream = client.stream({
  interests: ['technical_solution', 'feature_request'],
  projectContext: 'mobile_app'
});

stream.on('intelligence', (intel) => {
  console.log('New intelligence:', intel);
});
```