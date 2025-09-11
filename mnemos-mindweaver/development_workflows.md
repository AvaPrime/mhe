# DEVELOPMENT WORKFLOWS
## Chat Archive Intelligence Extraction & Agentic Integration System

### WORKFLOW OVERVIEW

This document defines the development processes, standards, and workflows for building, testing, and deploying the Chat Archive Intelligence System. These workflows ensure code quality, maintainability, and reliable delivery while supporting rapid iteration and continuous improvement.

### DEVELOPMENT ENVIRONMENT SETUP

#### Local Development Environment

**Prerequisites Installation**:
```bash
# System requirements
python --version  # 3.11+ required
docker --version  # 20.10+ required
git --version     # 2.30+ required

# Development tools
pip install poetry  # Dependency management
npm install -g pre-commit  # Git hooks

# IDE setup (recommended: VS Code with extensions)
code --install-extension ms-python.python
code --install-extension ms-python.black-formatter
code --install-extension ms-python.mypy
code --install-extension redhat.vscode-yaml
```

**Project Setup**:
```bash
# Clone repository
git clone https://github.com/your-org/intelligence-system.git
cd intelligence-system

# Set up Python environment
poetry install --with dev,test
poetry shell

# Install pre-commit hooks
pre-commit install
pre-commit install --hook-type commit-msg

# Start development services
docker-compose -f docker-compose.dev.yml up -d

# Verify setup
make verify-setup
```

**Development Configuration**:
```yaml
# config/development.yaml
environment: "development"

database:
  url: "postgresql://dev:dev@localhost:5433/intelligence_dev"
  echo_sql: true
  auto_migrate: true

vector_db:
  provider: "local_faiss"  # Use local FAISS for development
  persist_directory: "./data/dev_vectors"

redis:
  url: "redis://localhost:6380/0"

api:
  host: "0.0.0.0"
  port: 8000
  debug: true
  reload: true

logging:
  level: "DEBUG"
  format: "detailed"
  
testing:
  database_url: "postgresql://test:test@localhost:5434/intelligence_test"
  fast_tests_only: false
```

#### Development Services Stack

**Docker Compose for Development**:
```yaml
# docker-compose.dev.yml
version: '3.8'

services:
  postgres-dev:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: intelligence_dev
      POSTGRES_USER: dev
      POSTGRES_PASSWORD: dev
    ports:
      - "5433:5432"
    volumes:
      - postgres_dev_data:/var/lib/postgresql/data

  postgres-test:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: intelligence_test
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
    ports:
      - "5434:5432"
    volumes:
      - postgres_test_data:/var/lib/postgresql/data

  redis-dev:
    image: redis:7-alpine
    ports:
      - "6380:6379"
    volumes:
      - redis_dev_data:/data

  elasticsearch-dev:
    image: elasticsearch:8.8.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
    ports:
      - "9201:9200"
    volumes:
      - elasticsearch_dev_data:/usr/share/elasticsearch/data

volumes:
  postgres_dev_data:
  postgres_test_data:
  redis_dev_data:
  elasticsearch_dev_data:
```

### GIT BRANCHING STRATEGY

#### Branch Structure

**Branch Types and Naming**:
```
main
├── develop
│   ├── feature/extract-gpt-archives
│   ├── feature/semantic-search-api
│   ├── feature/agent-authentication
│   └── bugfix/context-preservation-issue
├── hotfix/critical-security-patch
└── release/v1.0.0
```

**Branching Rules**:
```yaml
branch_strategy: "GitFlow"

branch_types:
  main:
    description: "Production-ready code"
    protection: "Required PR reviews (2), no direct pushes"
    auto_deploy: "Production environment"
    
  develop:
    description: "Integration branch for features"
    protection: "Required PR reviews (1), CI must pass"
    auto_deploy: "Development environment"
    
  feature/*:
    description: "New features and enhancements"
    source_branch: "develop"
    target_branch: "develop"
    naming: "feature/short-description"
    
  bugfix/*:
    description: "Non-critical bug fixes"
    source_branch: "develop"
    target_branch: "develop"
    naming: "bugfix/issue-description"
    
  hotfix/*:
    description: "Critical production fixes"
    source_branch: "main"
    target_branch: "main and develop"
    naming: "hotfix/critical-issue"
    
  release/*:
    description: "Release preparation"
    source_branch: "develop"
    target_branch: "main"
    naming: "release/v{major}.{minor}.{patch}"
```

#### Commit Message Standards

**Conventional Commits Format**:
```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**Commit Types**:
```yaml
commit_types:
  feat: "New feature implementation"
  fix: "Bug fix"
  docs: "Documentation changes"
  style: "Code style changes (formatting, etc.)"
  refactor: "Code refactoring without feature changes"
  test: "Test additions or modifications"
  chore: "Build system or auxiliary tool changes"
  perf: "Performance improvements"
  security: "Security improvements"

examples:
  - "feat(extraction): add GPT chat archive parser"
  - "fix(api): resolve authentication token expiration issue"
  - "docs(readme): update installation instructions"
  - "test(semantic): add unit tests for similarity search"
```

**Commit Message Validation**:
```bash
# .gitmessage template
# <type>[optional scope]: <description>
# 
# Explain what this commit does and why
# 
# Breaking changes: none
# Closes: #123
```

### CODE REVIEW PROCESS

#### Pull Request Workflow

**PR Creation Checklist**:
```markdown
## Pull Request Checklist

### Code Quality
- [ ] Code follows project style guidelines (Black, isort, mypy)
- [ ] All tests pass locally
- [ ] Code coverage maintained or improved
- [ ] No new linting errors introduced
- [ ] Documentation updated for new features

### Testing
- [ ] Unit tests added for new functionality
- [ ] Integration tests updated if needed
- [ ] Manual testing completed
- [ ] Performance impact assessed

### Security & Privacy
- [ ] No secrets or credentials in code
- [ ] Input validation implemented where needed
- [ ] Authorization checks in place
- [ ] Privacy implications considered

### Documentation
- [ ] API documentation updated
- [ ] README updated if needed
- [ ] Changelog entry added
- [ ] Migration guide provided if breaking changes
```

**Review Requirements**:
```yaml
review_policy:
  required_reviewers: 1
  dismiss_stale_reviews: true
  require_code_owner_reviews: true
  
  review_criteria:
    code_quality: "Style, readability, maintainability"
    functionality: "Correctness, edge cases, error handling"
    performance: "Efficiency, scalability considerations"
    security: "Vulnerability assessment, data protection"
    testing: "Coverage, test quality, edge cases"
    
  approval_requirements:
    feature_branches: "1 approval from team member"
    hotfix_branches: "2 approvals including senior developer"
    release_branches: "2 approvals including tech lead"
```

#### Code Review Guidelines

**Reviewer Responsibilities**:
```python
class CodeReviewGuidelines:
    """
    Guidelines for conducting effective code reviews
    """
    
    def review_priorities(self):
        return [
            "Correctness and functionality",
            "Code clarity and maintainability", 
            "Performance and scalability",
            "Security and privacy",
            "Test coverage and quality",
            "Documentation completeness",
            "Architectural consistency"
        ]
    
    def review_tone(self):
        return {
            "constructive": "Focus on improvement, not criticism",
            "specific": "Provide concrete suggestions",
            "educational": "Explain reasoning behind feedback",
            "collaborative": "Work together toward better code"
        }
```

**Review Response Standards**:
```yaml
response_timeframes:
  draft_pr: "No review required"
  ready_for_review: "24 hours for initial review"
  changes_requested: "48 hours for author response"
  re_review: "12 hours for reviewer response"
  hotfix_pr: "2 hours maximum for all reviews"

feedback_categories:
  must_fix: "Blocking issues that prevent approval"
  should_fix: "Important improvements, author discretion"
  consider: "Suggestions for future consideration"
  praise: "Acknowledge good practices and solutions"
```

### TESTING PROTOCOLS

#### Testing Strategy

**Test Pyramid Structure**:
```
                    E2E Tests (5%)
                 ┌─────────────────┐
               Integration Tests (20%)
            ┌─────────────────────────┐
          Unit Tests (75%)
    ┌─────────────────────────────────────┐
```

**Test Categories**:
```yaml
testing_layers:
  unit_tests:
    scope: "Individual functions and classes"
    framework: "pytest"
    coverage_target: "90%"
    execution_time: "<10 seconds total"
    
  integration_tests:
    scope: "Component interactions"
    framework: "pytest with testcontainers"
    coverage_target: "80% of integration paths"
    execution_time: "<2 minutes total"
    
  end_to_end_tests:
    scope: "Complete user workflows"
    framework: "pytest with API clients"
    coverage_target: "Critical user journeys"
    execution_time: "<10 minutes total"
    
  performance_tests:
    scope: "Load and stress testing"
    framework: "locust + pytest-benchmark"
    metrics: "Response time, throughput, resource usage"
    execution_time: "On-demand"
```

#### Test Implementation Standards

**Unit Test Structure**:
```python
# tests/unit/test_intelligence_extraction.py
import pytest
from unittest.mock import Mock, patch
from intelligence_system.extraction import IntelligenceExtractor

class TestIntelligenceExtractor:
    """
    Unit tests for intelligence extraction functionality
    """
    
    @pytest.fixture
    def extractor(self):
        """Provide configured extractor instance"""
        return IntelligenceExtractor(
            model_name="test-model",
            confidence_threshold=0.7
        )
    
    @pytest.fixture
    def sample_conversation(self):
        """Provide sample conversation data"""
        return {
            "messages": [
                {"role": "user", "content": "How do I implement authentication?"},
                {"role": "assistant", "content": "You can use JWT tokens..."}
            ],
            "metadata": {"platform": "gpt", "timestamp": "2024-03-20T10:00:00Z"}
        }
    
    def test_extract_incomplete_ideas_success(self, extractor, sample_conversation):
        """Test successful extraction of incomplete ideas"""
        # Arrange
        expected_concepts = ["jwt_authentication", "token_validation"]
        
        # Act
        result = extractor.extract_concepts(sample_conversation, "incomplete_idea")
        
        # Assert
        assert result.success is True
        assert len(result.concepts) >= 1
        assert result.confidence_score >= 0.7
        assert all(concept.type == "incomplete_idea" for concept in result.concepts)
    
    @pytest.mark.parametrize("confidence_threshold,expected_count", [
        (0.5, 3),
        (0.7, 2), 
        (0.9, 1)
    ])
    def test_confidence_threshold_filtering(self, extractor, sample_conversation, confidence_threshold, expected_count):
        """Test that confidence thresholds properly filter results"""
        extractor.confidence_threshold = confidence_threshold
        result = extractor.extract_concepts(sample_conversation, "incomplete_idea")
        assert len(result.concepts) == expected_count
```

**Integration Test Pattern**:
```python
# tests/integration/test_api_workflow.py
import pytest
from fastapi.testclient import TestClient
from testcontainers import DockerCompose
from intelligence_system.main import create_app

@pytest.fixture(scope="session")
def test_services():
    """Start test services using Docker Compose"""
    with DockerCompose(".", compose_file_name="docker-compose.test.yml") as compose:
        compose.wait_for("http://localhost:5434/health")  # Wait for test DB
        yield compose

@pytest.fixture
def api_client(test_services):
    """Provide API client with test configuration"""
    app = create_app(config="testing")
    return TestClient(app)

@pytest.fixture
def authenticated_agent(api_client):
    """Provide authenticated agent token"""
    response = api_client.post("/auth/token", json={
        "agent_id": "test_agent",
        "api_key": "test_key"
    })
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

class TestIntelligenceWorkflow:
    """Test complete intelligence extraction and retrieval workflow"""
    
    def test_complete_extraction_workflow(self, api_client, authenticated_agent):
        """Test end-to-end intelligence extraction process"""
        # Upload chat archive
        with open("tests/fixtures/sample_chat.json", "rb") as f:
            response = api_client.post(
                "/archives/upload",
                files={"file": f},
                headers=authenticated_agent
            )
        assert response.status_code == 202
        extraction_id = response.json()["extraction_id"]
        
        # Wait for processing completion
        self.wait_for_extraction_completion(api_client, extraction_id, authenticated_agent)
        
        # Search for extracted intelligence
        response = api_client.get(
            "/intelligence/search?query=authentication implementation",
            headers=authenticated_agent
        )
        assert response.status_code == 200
        results = response.json()["results"]
        assert len(results) > 0
        assert results[0]["relevance_score"] > 0.5
```

#### Continuous Testing

**Test Automation Pipeline**:
```yaml
# .github/workflows/test.yml
name: Test Suite

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        python-version: [3.11, 3.12]
    
    steps:
    - uses: actions/checkout@v4
    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: ${{ matrix.python-version }}
    
    - name: Install dependencies
      run: |
        pip install poetry
        poetry install --with dev,test
    
    - name: Run linting
      run: |
        poetry run black --check .
        poetry run isort --check-only .
        poetry run mypy intelligence_system/
    
    - name: Run unit tests
      run: |
        poetry run pytest tests/unit/ \
          --cov=intelligence_system \
          --cov-report=xml \
          --cov-fail-under=90
    
    - name: Upload coverage
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage.xml

  integration-tests:
    runs-on: ubuntu-latest
    needs: unit-tests
    
    steps:
    - uses: actions/checkout@v4
    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: 3.11
    
    - name: Start test services
      run: |
        docker-compose -f docker-compose.test.yml up -d
        ./scripts/wait-for-services.sh
    
    - name: Run integration tests
      run: |
        poetry run pytest tests/integration/ \
          --maxfail=5 \
          --timeout=300
    
    - name: Stop test services
      run: docker-compose -f docker-compose.test.yml down
```

### DEPLOYMENT PIPELINES

#### Deployment Strategy

**Environment Progression**:
```
Development → Staging → Production
     ↓           ↓         ↓
   Feature    Release   Hotfix
   Testing    Testing   Deployment
```

**Deployment Configuration**:
```yaml
deployment_environments:
  development:
    trigger: "Push to develop branch"
    auto_deploy: true
    rollback: "Automatic on failure"
    monitoring: "Basic health checks"
    
  staging:
    trigger: "Release branch creation"
    auto_deploy: false  # Manual approval required
    rollback: "Manual with 5-minute timeout"
    monitoring: "Full monitoring stack"
    testing: "Automated acceptance tests"
    
  production:
    trigger: "Merge to main branch"
    auto_deploy: false  # Manual approval required
    rollback: "Blue-green with instant fallback"
    monitoring: "Full monitoring + alerting"
    testing: "Smoke tests + health checks"
```

#### Deployment Pipeline Implementation

**GitHub Actions Deployment**:
```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:
    inputs:
      environment:
        description: 'Deployment environment'
        required: true
        default: 'staging'
        type: choice
        options: [staging, production]

jobs:
  build:
    runs-on: ubuntu-latest
    outputs:
      image-tag: ${{ steps.meta.outputs.tags }}
      
    steps:
    - uses: actions/checkout@v4
    
    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@v3
    
    - name: Login to Container Registry
      uses: docker/login-action@v3
      with:
        registry: ghcr.io
        username: ${{ github.actor }}
        password: ${{ secrets.GITHUB_TOKEN }}
    
    - name: Extract metadata
      id: meta
      uses: docker/metadata-action@v5
      with:
        images: ghcr.io/${{ github.repository }}
        tags: |
          type=ref,event=branch
          type=ref,event=pr
          type=sha,prefix={{branch}}-
    
    - name: Build and push Docker image
      uses: docker/build-push-action@v5
      with:
        context: .
        platforms: linux/amd64,linux/arm64
        push: true
        tags: ${{ steps.meta.outputs.tags }}
        labels: ${{ steps.meta.outputs.labels }}
        cache-from: type=gha
        cache-to: type=gha,mode=max

  deploy-staging:
    needs: build
    if: github.ref == 'refs/heads/develop'
    runs-on: ubuntu-latest
    environment: staging
    
    steps:
    - name: Deploy to staging
      run: |
        # Kubernetes deployment
        kubectl set image deployment/intelligence-system \
          intelligence-system=${{ needs.build.outputs.image-tag }}
        kubectl rollout status deployment/intelligence-system --timeout=300s
        
    - name: Run acceptance tests
      run: |
        poetry run pytest tests/acceptance/ \
          --base-url=https://staging.intelligence-system.com
          
  deploy-production:
    needs: build
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: production
    
    steps:
    - name: Blue-Green deployment
      run: |
        # Deploy to green environment
        ./scripts/blue-green-deploy.sh \
          --image ${{ needs.build.outputs.image-tag }} \
          --environment production \
          --strategy blue-green
        
    - name: Smoke tests
      run: |
        ./scripts/smoke-tests.sh \
          --base-url https://green.intelligence-system.com
          
    - name: Switch traffic
      run: |
        ./scripts/switch-traffic.sh \
          --from blue --to green \
          --health-check-timeout 300
```

### ROLLBACK PROCEDURES

#### Automated Rollback Triggers

**Rollback Conditions**:
```yaml
rollback_triggers:
  health_check_failure:
    threshold: "3 consecutive failures"
    timeout: "5 minutes"
    action: "Automatic rollback"
    
  error_rate_spike:
    threshold: "Error rate > 5% for 2 minutes"
    action: "Automatic rollback"
    notification: "Alert team immediately"
    
  performance_degradation:
    threshold: "Response time > 2x baseline for 5 minutes"
    action: "Alert team, manual rollback decision"
    
  manual_trigger:
    authority: "Tech lead or on-call engineer"
    confirmation: "Required with reason"
    audit_log: "All manual rollbacks logged"
```

**Rollback Implementation**:
```bash
#!/bin/bash
# scripts/emergency-rollback.sh

set -euo pipefail

ENVIRONMENT=${1:-production}
REASON=${2:-"Emergency rollback"}

echo "Initiating emergency rollback for $ENVIRONMENT"
echo "Reason: $REASON"

# Get previous stable version
PREVIOUS_VERSION=$(kubectl get deployment intelligence-system -o jsonpath='{.metadata.annotations.deployment\.kubernetes\.io/revision}')
PREVIOUS_VERSION=$((PREVIOUS_VERSION - 1))

# Rollback deployment
kubectl rollout undo deployment/intelligence-system --to-revision=$PREVIOUS_VERSION

# Wait for rollback completion
kubectl rollout status deployment/intelligence-system --timeout=180s

# Verify health
./scripts/health-check.sh --environment $ENVIRONMENT

# Log rollback
echo "$(date): Emergency rollback completed for $ENVIRONMENT. Reason: $REASON" >> /var/log/deployments.log

# Notify team
./scripts/notify-team.sh \
  --event "rollback" \
  --environment $ENVIRONMENT \
  --reason "$REASON" \
  --status "completed"

echo "Rollback completed successfully"
```

### QUALITY GATES

#### Code Quality Gates

**Pre-commit Hooks**:
```yaml
# .pre-commit-config.yaml
repos:
- repo: https://github.com/pre-commit/pre-commit-hooks
  rev: v4.4.0
  hooks:
  - id: trailing-whitespace
  - id: end-of-file-fixer
  - id: check-yaml
  - id: check-added-large-files
  - id: check-merge-conflict

- repo: https://github.com/psf/black
  rev: 23.3.0
  hooks:
  - id: black
    language_version: python3.11

- repo: https://github.com/pycqa/isort
  rev: 5.12.0
  hooks:
  - id: isort

- repo: https://github.com/pre-commit/mirrors-mypy
  rev: v1.3.0
  hooks:
  - id: mypy
    additional_dependencies: [types-all]

- repo: https://github.com/pycqa/flake8
  rev: 6.0.0
  hooks:
  - id: flake8
    args: [--max-line-length=88, --extend-ignore=E203]
```

**Quality Metrics Thresholds**:
```yaml
quality_gates:
  code_coverage:
    minimum: 90%
    target: 95%
    failure_threshold: 85%
    
  code_complexity:
    cyclomatic_complexity: 10
    cognitive_complexity: 15
    max_function_length: 50
    
  security_scan:
    vulnerability_level: "HIGH"
    dependency_scan: "Required"
    secret_detection: "Required"
    
  performance_benchmarks:
    response_time_p95: "200ms"
    memory_usage: "1GB maximum"
    cpu_usage: "70% maximum"
```

This development workflow documentation provides a comprehensive framework for maintaining high code quality, reliable deployments, and effective team collaboration throughout the development lifecycle of your intelligence system.