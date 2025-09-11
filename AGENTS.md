# AGENTS.md — Memory Harvester Engine (MHE)

## Purpose

This document provides autonomous coding agents with comprehensive instructions for working safely and productively in this repository. It defines approved tasks, strict constraints, required commands, coding standards, and review criteria.

**⚠️ CRITICAL**: Agents must follow ALL constraints and guardrails. Any deviation requires explicit human approval.

---

## Repository Orientation

**Project**: Memory Harvester Engine (MHE)  
**Primary Language**: Python (3.11+)  
**Architecture**: Modular library with CLI interface and pluggable ingestion system

### Directory Structure
```
mhe/                    # Core library (capture, extraction, memory, access, consolidation)
├── capture/           # Memory capture interfaces
├── extraction/        # Content extraction engines  
├── memory/           # Memory storage and retrieval
├── access/           # Query and search interfaces
└── consolidation/    # Memory merging and optimization

cli/                   # CLI entry points (mhe_cli.py)
ingestion/            # Source adapters and parsers
docs/                 # User and developer documentation
tests/                # pytest test suite
infra/                # Infrastructure as Code (Docker, Compose, Helm, Terraform)
scripts/              # Administrative and development helpers
```

### Entry Points
- **CLI**: `python -m cli.mhe_cli <command>`
- **Library**: `import from mhe.*`
- **Docker**: `docker compose -f infra/compose.yaml up -d`

---

## Environment Setup & Commands

### Initial Setup
```bash
# Verify Python version
python -V  # Must be 3.11+

# Create and activate virtual environment
python -m venv .venv && source .venv/bin/activate

# Install dependencies
pip install -U pip wheel
pip install -e ".[dev]"   # Uses setup.cfg/pyproject.toml optional extras
```

### Quality Gates (MUST PASS)
```bash
# Run ALL checks before any commit
ruff check .                    # Linting
ruff format --check .          # Code formatting
pyright                        # Type checking
pytest -q --maxfail=1 --disable-warnings  # Tests
```

### Auto-Fix Commands (Safe to Run)
```bash
ruff format .          # Apply formatting
ruff check . --fix     # Fix auto-fixable lint issues
```

### Development Services
```bash
# Start required services (Postgres/pgvector, etc.)
docker compose -f infra/compose.yaml up -d

# Check service status
docker compose -f infra/compose.yaml ps

# View logs
docker compose -f infra/compose.yaml logs -f
```

---

## Security & Secrets Management

### ❌ NEVER DO
- Commit secrets, API keys, passwords, or tokens to the repository
- Hardcode credentials in any file
- Include real credentials in tests
- Commit `.env` files or similar

### ✅ ALWAYS DO
- Read settings from environment variables (`DB_URL`, `OPENAI_API_KEY`)
- Use `.env` file for local development only (gitignored)
- Use mocks/fakes for external services in tests
- Skip tests requiring credentials with `@pytest.mark.skipif` and document why

### Environment Variables Pattern
```python
import os
from typing import Optional

def get_config_value(key: str, default: Optional[str] = None) -> str:
    """Get configuration value from environment."""
    value = os.environ.get(key, default)
    if value is None:
        raise ValueError(f"Required environment variable {key} not set")
    return value
```

---

## Approved Task Categories

Agents MUST only work on tasks in these categories, starting with the lowest risk:

### 🟢 LOW RISK (Recommended)

#### 1. Dependency Hygiene
- **Scope**: Upgrade patch/minor versions only (no major version bumps)
- **Process**:
  1. Check `pyproject.toml` and `requirements*.txt` for outdated packages
  2. Bump only patch/minor versions (e.g., `1.2.3` → `1.2.4` or `1.3.0`)
  3. Run full test suite
  4. Update `CHANGELOG.md` with bullet points
  5. Open PR with version change summary

#### 2. Code Quality Improvements
- Add missing type hints to existing functions
- Improve existing docstrings (Google style)
- Add missing unit tests for pure functions
- Fix lint warnings and type errors
- Improve test coverage for edge cases

#### 3. Documentation Enhancement
- Expand `README.md` quickstart (keep under 120 lines)
- Add docstrings to undocumented public functions/classes
- Update usage examples in `docs/`
- Fix broken links or outdated information

#### 4. Small, Isolated Bug Fixes
- Fix clearly scoped issues with accompanying failing tests
- Address specific error conditions
- Improve error messages and exception handling
- Fix typos in user-facing messages

### 🟡 MEDIUM RISK (Require Justification)

#### 5. Test Infrastructure
- Add new test utilities and fixtures
- Improve test organization and structure
- Add property-based tests using `hypothesis`
- Create integration test frameworks

#### 6. Performance Optimizations
- Optimize hot paths with benchmarks as proof
- Add performance monitoring/metrics
- Reduce memory usage in data processing
- **Constraint**: Must include before/after benchmarks

### 🔴 HIGH RISK (Require Explicit Approval)

#### 7. New Features (Behind Feature Flags)
- Small, self-contained features
- Must be disabled by default
- Require comprehensive tests
- Need documentation updates

#### 8. New Ingestion Adapters
- Add support for new data sources
- Must include full test suite
- Follow existing adapter patterns
- Document supported formats/features

---

## Strict Constraints & Guardrails

### Scope Constraints
- **One Task Per PR**: No combining multiple unrelated changes
- **Surgical Changes**: Minimal diffs, focused modifications
- **No Broad Refactors**: Avoid large-scale code reorganization
- **API Stability**: Do not alter public APIs without explicit approval

### Data Safety Constraints
- **No Data Loss**: Never delete or migrate user data
- **Additive Only**: All changes must be reversible
- **Migration Review**: Database schema changes require human review
- **Backup First**: Document rollback procedures

### Performance Constraints
- **No Quadratic Complexity**: Avoid O(n²) algorithms on hot paths
- **Benchmark Required**: Performance changes need before/after measurements
- **Memory Conscious**: Monitor memory usage in data processing
- **Timeout Handling**: All I/O operations must have timeouts

### Security Constraints
- **Dependency Minimization**: Avoid new third-party dependencies
- **Well-Known Libraries**: Prefer established, maintained packages
- **License Compatibility**: Preserve file headers, check license compatibility
- **Input Validation**: Sanitize all external inputs

### Code Quality Constraints
- **Zero Warnings**: `ruff check` must pass with no warnings
- **Type Safety**: `pyright` must pass with no errors
- **Test Coverage**: New code requires corresponding tests
- **Documentation**: Public APIs need docstrings

---

## Coding Standards

### Style & Formatting
```bash
# Code must pass these checks
ruff format --check .   # Formatting check
ruff check .           # Linting check (zero warnings)
```

### Type Annotations
```python
# ✅ Good: Explicit types on public APIs
def process_memory(content: str, metadata: dict[str, Any]) -> ProcessedMemory:
    """Process raw content into structured memory."""
    pass

# ❌ Bad: Missing types on public function
def process_memory(content, metadata):
    pass
```

### Error Handling
```python
# ✅ Good: Specific exceptions with helpful messages
if not content.strip():
    raise ValueError("Content cannot be empty or whitespace-only")

try:
    result = risky_operation()
except SpecificError as e:
    logger.error("Operation failed: %s", e)
    raise ProcessingError(f"Failed to process content: {e}") from e

# ❌ Bad: Bare except or vague errors
try:
    result = risky_operation()
except:
    raise Exception("Something went wrong")
```

### Function Design
```python
# ✅ Good: Pure function, separate logic from I/O
def calculate_similarity(text1: str, text2: str) -> float:
    """Calculate similarity between two texts."""
    # Pure computation logic only
    return similarity_score

def save_similarity_result(text1: str, text2: str, db_connection: Connection) -> None:
    """Save similarity calculation to database."""
    score = calculate_similarity(text1, text2)  # Use pure function
    # I/O operations here
    db_connection.execute("INSERT INTO ...", score)

# ❌ Bad: Mixed logic and I/O
def calculate_and_save_similarity(text1: str, text2: str) -> float:
    score = compute_score(text1, text2)
    save_to_db(score)  # I/O mixed with logic
    return score
```

### Documentation Standards
```python
def extract_entities(text: str, model: str = "default") -> list[Entity]:
    """Extract named entities from text using specified model.

    Args:
        text: Input text to process. Must not be empty.
        model: Model name to use for extraction. Defaults to "default".

    Returns:
        List of Entity objects found in the text. Empty list if no entities found.

    Raises:
        ValueError: If text is empty or model is not supported.
        ExtractionError: If the extraction process fails.

    Example:
        >>> entities = extract_entities("John lives in New York")
        >>> len(entities)
        2
        >>> entities[0].type
        'PERSON'
    """
```

---

## Testing Strategy

### Test Organization
```bash
# Mirror module structure
mhe/extraction/text_processor.py  →  tests/extraction/test_text_processor.py
mhe/memory/store.py               →  tests/memory/test_store.py
```

### Test Categories
1. **Unit Tests** (preferred): Fast, isolated, no external dependencies
2. **Integration Tests**: Limited use, marked with `@pytest.mark.integration`
3. **End-to-End Tests**: Minimal, critical user journeys only

### Test Quality Requirements
```python
# ✅ Good: Descriptive name, single assertion, fast
def test_text_processor_handles_empty_input():
    """Text processor should return empty result for empty input."""
    processor = TextProcessor()
    result = processor.process("")
    assert result.is_empty()

def test_text_processor_extracts_key_phrases():
    """Text processor should identify important phrases."""
    processor = TextProcessor()
    text = "Machine learning is a subset of artificial intelligence."
    result = processor.process(text)
    assert "machine learning" in result.key_phrases
    assert "artificial intelligence" in result.key_phrases

# ❌ Bad: Vague name, multiple assertions, external dependencies
def test_processor():
    processor = TextProcessor()
    result = processor.process("some text")
    assert result  # What are we testing?
    assert len(result.phrases) > 0  # Multiple unrelated assertions
    result.save_to_database()  # External dependency
```

### Test Performance
- Each test must complete in <100ms
- Use `@pytest.mark.slow` for tests >100ms
- Mark network tests with `@pytest.mark.network` and skip by default
- Use fixtures and mocks for external services

---

## CI/CD Requirements

### Pre-Commit Checks (MUST PASS)
```bash
# All PRs must pass these checks
ruff check .                    # Zero warnings required
ruff format --check .          # Code formatting check
pyright                        # Zero type errors required
pytest -q                      # All tests must pass
```

### Failure Response
If CI fails, agents must:
1. Identify the root cause
2. Fix the issue OR revert the breaking change
3. Re-run all checks locally
4. Push the fix
5. **Never ignore CI failures**

---

## PR Requirements & Template

### Pre-PR Checklist
- [ ] All quality gates pass locally
- [ ] Tests added for new functionality
- [ ] Documentation updated (if behavior changed)
- [ ] CHANGELOG.md updated (for user-facing changes)
- [ ] No secrets or credentials committed

### Mandatory PR Template
```markdown
## Summary
<One clear paragraph describing the change and its purpose.>

## Scope & Risk Assessment
- **Affected modules**: <specific list>
- **Public API**: unchanged | changed (provide details)
- **Data migrations**: none | details and rollback plan
- **Dependencies**: none added | list new dependencies with justification

## Verification
- [ ] Local: `ruff check . && ruff format --check . && pyright && pytest -q`
- [ ] Added/updated tests with >90% coverage
- [ ] Documentation updated (if behavior changed)
- [ ] Manual testing completed (describe scenarios)

## Notes for Reviewer
<Any deviations from standard process, trade-offs made, or follow-up work needed.>

---
## Agent Metrics (Required for Agent-Generated PRs)
#AGENT-METRICS
task_category: <low_risk|medium_risk|high_risk>
estimated_human_time_saved: <minutes>
human_review_time_spent: <minutes>
rework_required: none | minor | major
test_coverage_added: <%>
```

---

## Prohibited Actions

Agents must NEVER:

❌ **Infrastructure Changes**
- Introduce new external services or APIs
- Modify Docker configurations without approval
- Change CI/CD pipelines or GitHub Actions

❌ **Data & Schema Changes**
- Alter database schemas
- Delete or migrate user data  
- Change data serialization formats

❌ **Architecture Changes**
- Large-scale file moves or renames
- Broad refactoring across multiple modules
- Changes to core interfaces or protocols

❌ **Security Violations**
- Commit any secrets or credentials
- Add dependencies with known vulnerabilities
- Bypass security measures or validations

❌ **Experimental Features**
- Add features requiring paid/private models by default
- Introduce breaking changes to public APIs
- Add experimental code without feature flags

---

## Task Execution Recipes

### Recipe 1: Safe Dependency Update

**Goal**: Update patch/minor versions safely

**Steps**:
1. **Audit current dependencies**:
   ```bash
   pip list --outdated
   ```

2. **Check constraints**:
   - Review `pyproject.toml` for pinned versions
   - Only bump patch (X.Y.Z → X.Y.Z+1) or minor (X.Y.Z → X.Y+1.0)
   - Never bump major versions (X.Y.Z → X+1.0.0)

3. **Update and test**:
   ```bash
   # Update specific package
   pip install "package-name>=X.Y.Z,<X.Y+1" 
   
   # Run full test suite
   ruff check . && ruff format --check . && pyright && pytest -q
   ```

4. **Document changes**:
   - Update `CHANGELOG.md` with bullet points
   - Note any breaking changes or new features

5. **Create PR** with dependency update template

### Recipe 2: Add Unit Tests for Pure Function

**Goal**: Improve test coverage for existing pure functions

**Steps**:
1. **Identify target function**:
   - Must be pure (no side effects, same input → same output)
   - Currently lacks tests
   - Has clear, testable behavior

2. **Create test file**:
   ```bash
   # Mirror module structure
   # mhe/extraction/parser.py → tests/extraction/test_parser.py
   touch tests/extraction/test_parser.py
   ```

3. **Write comprehensive tests**:
   ```python
   def test_parser_handles_empty_input():
       """Parser should handle empty input gracefully."""
       result = parse("")
       assert result.is_empty()

   def test_parser_extracts_valid_data():
       """Parser should extract structured data from valid input."""
       input_data = "valid format data"
       result = parse(input_data)
       assert result.is_valid()
       assert len(result.items) > 0

   def test_parser_rejects_invalid_format():
       """Parser should raise ValueError for invalid format."""
       with pytest.raises(ValueError, match="Invalid format"):
           parse("invalid data")
   ```

4. **Verify performance**:
   ```bash
   # Each test should complete in <100ms
   pytest tests/extraction/test_parser.py -v --durations=10
   ```

5. **Run full test suite and create PR**

### Recipe 3: Documentation Enhancement

**Goal**: Improve README.md quickstart section

**Steps**:
1. **Test instructions in clean environment**:
   ```bash
   # Create new virtual environment
   python -m venv test_env && source test_env/bin/activate
   
   # Follow existing README instructions
   # Document any issues or missing steps
   ```

2. **Update README.md**:
   - Keep quickstart section under 120 lines
   - Include common error solutions
   - Add working examples
   - Link to detailed docs for advanced topics

3. **Verify examples work**:
   ```bash
   # Test every command in the README
   python -m cli.mhe_cli --help
   python -m cli.mhe_cli ingest-status
   ```

4. **Create PR with documentation template**

---

## Review Process & Ownership

### Code Owners
- **General Code**: @Phoenix, @<maintainer2>
- **Security Reviews**: @<security-owner> (for auth/secrets changes)
- **Data Reviews**: @<data-owner> (for persistence changes)

### Review Criteria
Reviewers will check:
- [ ] All CI checks pass
- [ ] Code follows established patterns
- [ ] Tests provide adequate coverage
- [ ] Documentation is clear and accurate
- [ ] No security vulnerabilities introduced
- [ ] Performance impact is acceptable

### Agent Success Metrics
Track these metrics for agent-generated PRs:
- **Time to Review**: Target <2 business days
- **Rework Required**: Aim for "none" or "minor"
- **Test Coverage**: New code should have >90% coverage
- **Human Time Saved**: Document estimated time savings

---

## Roadmap Alignment

### Current Priorities (Preferred Tasks)
1. **Technical Debt Reduction**: Tests, types, docs, dependency updates
2. **Code Quality**: Lint fixes, type safety, error handling
3. **Developer Experience**: Better tooling, clearer documentation
4. **Stability**: Bug fixes, edge case handling, error recovery

### Future Considerations (Human-Led)
- Architectural changes and major refactors
- New feature design and implementation
- External API integrations
- Performance optimization strategies

---

## Emergency Procedures

### If Agent Breaks Something
1. **Immediately revert** the breaking change
2. **Notify code owners** with details
3. **Run full test suite** to verify revert
4. **Document the issue** for future prevention
5. **Do not attempt to fix** without human guidance

### If CI is Down
1. **Stop all development work**
2. **Do not merge any PRs**
3. **Wait for human intervention**
4. **Document any blocked work**

---

## Conclusion

This document provides comprehensive guidance for autonomous agents working on the Memory Harvester Engine. Success requires:

- **Strict adherence** to all constraints and guardrails
- **Focus on low-risk, high-value** tasks
- **Thorough testing** and documentation
- **Clear communication** in PRs and code

Remember: **When in doubt, ask for human approval before proceeding.**

---

*Last Updated: [Current Date]*  
*Version: 2.0*  
*Next Review: [3 months from current date]*