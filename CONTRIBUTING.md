# Contributing to Memory Harvester Engine (MHE)

Welcome! We appreciate your interest in contributing to the Memory Harvester Engine. This guide will help you get started and ensure your contributions align with our project standards.

## Quick Start

### 1. Environment Setup

```bash
# Clone the repository
git clone https://github.com/<ORG>/<REPO>.git
cd mhe

# Set up Python environment
python -V  # Ensure Python 3.11+
python -m venv .venv && source .venv/bin/activate
pip install -U pip wheel
pip install -e ".[dev]"
```

### 2. Verify Your Setup

Run our quality checks to ensure everything works:

```bash
# Code quality
ruff check .
ruff format --check .
pyright

# Tests
pytest -q --maxfail=1 --disable-warnings
```

### 3. Optional: Start Development Services

If your work requires databases or other services:

```bash
docker compose -f infra/compose.yaml up -d
```

## Project Structure

Understanding the codebase:

- **`mhe/`** - Core library (capture, extraction, memory, access, consolidation)
- **`cli/`** - CLI entry points (e.g., `mhe_cli.py`)
- **`ingestion/`** - Source adapters and parsers
- **`docs/`** - User and developer documentation
- **`tests/`** - pytest test suite
- **`infra/`** - Infrastructure as Code (Docker, Compose, Helm, Terraform)
- **`scripts/`** - Administrative and development helper scripts

### Entry Points

- **CLI**: `python -m cli.mhe_cli <command>`
- **Library**: `import from mhe.*`

## What We're Looking For

We welcome contributions in these areas, roughly in order of priority:

### 🟢 Low Risk, High Impact
- **Dependency Updates**: Patch/minor version bumps with testing
- **Code Quality**: Improving lint rules, type hints, test coverage
- **Documentation**: README improvements, docstrings, usage examples
- **Bug Fixes**: Well-scoped fixes with accompanying tests

### 🟡 Medium Risk (Discuss First)
- **New Features**: Small additions behind feature flags
- **Ingestion Adapters**: New parsers with comprehensive tests
- **Performance Improvements**: With benchmarks and measurements

### 🔴 High Risk (Requires RFC)
- **API Changes**: Modifications to public interfaces
- **Architecture Changes**: Broad refactors or design changes
- **Database Migrations**: Schema changes or data transformations

## Coding Standards

### Style and Formatting
- **Formatter**: Use `ruff format` for consistent code style
- **Linter**: Zero warnings from `ruff check`
- **Line Length**: 88 characters (ruff default)

### Type Safety
- **Type Hints**: Required for all public functions and classes
- **Type Checker**: Code must pass `pyright` without errors
- **Gradual Typing**: Improve existing code incrementally

### Documentation
Use Google-style docstrings for all public APIs:

```python
def process_memory(content: str, metadata: dict) -> ProcessedMemory:
    """Process raw content into structured memory.

    Args:
        content: Raw text content to process.
        metadata: Additional context and tags.

    Returns:
        ProcessedMemory object with extracted information.

    Raises:
        ProcessingError: If content cannot be parsed.
    """
```

### Error Handling
- Use specific exception types
- Provide helpful error messages
- Avoid bare `except` clauses
- Log appropriately for debugging

### Code Organization
- **Pure Functions**: Separate business logic from I/O
- **Single Responsibility**: Functions and classes should have one clear purpose
- **Dependency Injection**: Avoid global state where possible

## Testing

### Test Structure
- Mirror the module structure under `tests/`
- One test file per module: `tests/test_module.py`
- Use descriptive test names: `test_summarizer_handles_empty_input`

### Test Types
- **Unit Tests**: Fast, isolated, no external dependencies (preferred)
- **Integration Tests**: Limited use, mark with `@pytest.mark.integration`
- **Property-Based Tests**: Use `hypothesis` for complex logic

### Writing Good Tests
```python
def test_card_summarizer_handles_empty_input():
    """Summarizer should return empty string for empty input."""
    result = summarize([])
    assert result == ""

def test_card_summarizer_preserves_key_information():
    """Summarizer should retain essential details."""
    cards = [Card(title="Test", content="Important info")]
    result = summarize(cards)
    assert "Important info" in result
```

### Test Requirements
- Tests must be deterministic and hermetic
- Use mocks/fakes for external services
- Each test should complete in <100ms
- Mark slow or network tests: `@pytest.mark.slow`

## Security and Safety

### Secrets Management
- **Never commit secrets** to the repository
- Use environment variables: `DB_URL`, `OPENAI_API_KEY`
- Store development secrets in `.env` (gitignored)
- Use mocks/fakes in tests instead of real credentials

### Dependencies
- Minimize new third-party dependencies
- Justify any new dependencies in PR description
- Prefer well-established libraries
- Check licenses for compatibility

### Data Safety
- No destructive migrations without explicit approval
- All data changes must be reversible
- Test migrations on sample data first

## Pull Request Process

### Before Opening a PR

1. **Run the full quality suite**:
   ```bash
   ruff check . && ruff format --check . && pyright && pytest -q
   ```

2. **Auto-fix what you can**:
   ```bash
   ruff format .
   ruff check . --fix
   ```

3. **Update documentation** if you changed behavior

### PR Guidelines

- **Keep PRs focused**: One task per PR, surgical changes only
- **Write clear descriptions**: Use our template (see below)
- **Include tests** for new functionality
- **Update docs** when adding features or changing behavior

### PR Template

When opening a PR, please use this template:

```markdown
## Summary
<One-paragraph description of the change.>

## Scope & Risk
- Affected modules: <list>
- Public API: unchanged | changed (details)
- Data migrations: none | details

## Verification
- [ ] Local: ruff, pyright, pytest all pass
- [ ] Added/updated tests
- [ ] Docs updated (if behavior changed)

## Notes for Reviewer
<Any deviations, trade-offs, or follow-ups.>
```

## Development Workflows

### Common Tasks

**Dependency Update**:
```bash
# Update versions in pyproject.toml
# Run tests to verify compatibility
pytest -q
# Update CHANGELOG.md
# Open PR
```

**Adding Tests**:
```bash
# Create test file matching module structure
touch tests/test_new_module.py
# Write tests covering happy path + edge cases
# Ensure tests are fast and reliable
pytest tests/test_new_module.py -v
```

**Documentation Update**:
```bash
# Verify examples actually work
python -m cli.mhe_cli --help
# Keep README.md concise (<120 lines)
# Link to docs/ for detailed information
```

## Getting Help

- **Code Owners**: @Phoenix, @<maintainer2>
- **Security Questions**: @<security-owner>
- **Data/Migration Questions**: @<data-owner>

## Review Process

All PRs require:
- ✅ Passing CI (ruff, pyright, pytest)
- ✅ Code review approval
- ✅ Documentation updates (if applicable)

We aim to review PRs within 2-3 business days.

## What's Not Accepted

To maintain project quality and security:

- ❌ New external APIs or services without prior discussion
- ❌ Large-scale file reorganization or renames
- ❌ Database schema changes without migration review
- ❌ Features requiring paid/private models by default
- ❌ Committed secrets or credentials
- ❌ Broad architectural refactors without RFC

## Recognition

Contributors who make significant improvements will be:
- Added to CONTRIBUTORS.md
- Credited in release notes
- Invited to join the maintainer team (for ongoing contributors)

---

Thank you for contributing to MHE! Your help makes this project better for everyone. 🚀

## Quick Commands Reference

```bash
# Setup
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"

# Quality gates (run before every commit)
ruff check . && ruff format --check . && pyright && pytest -q

# Auto-fix (safe changes only)
ruff format .
ruff check . --fix

# Example CLI usage
python -m cli.mhe_cli ingest-status
```