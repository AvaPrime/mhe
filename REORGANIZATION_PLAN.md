# Repository Reorganization Plan

## Current Structure Analysis

### Issues Identified:
1. **Root Directory Clutter**: Too many files in root (40+ items)
2. **Inconsistent Naming**: Mixed conventions (snake_case, kebab-case, PascalCase)
3. **Poor Documentation Organization**: Scattered across multiple locations
4. **Mixed Concerns**: Configuration, source code, docs, and scripts intermixed
5. **Redundant Directories**: Multiple docs folders with unclear purposes

## Proposed New Structure

```
mhe/
├── .github/                    # GitHub workflows and templates
├── .vscode/                    # IDE configuration
├── config/                     # All configuration files
│   ├── environment/
│   │   ├── .env.example
│   │   ├── .nvmrc
│   │   └── .tool-versions
│   ├── build/
│   │   ├── docker-compose.yml
│   │   ├── Makefile
│   │   └── pyproject.toml
│   ├── database/
│   │   ├── alembic.ini
│   │   └── alembic/
│   └── testing/
│       ├── pytest.ini
│       └── requirements-test.txt
├── docs/                       # Consolidated documentation
│   ├── architecture/
│   ├── api/
│   ├── deployment/
│   ├── development/
│   ├── integration/
│   ├── security/
│   └── user-guides/
├── src/                        # Source code (unchanged - well organized)
│   └── mhe/
├── services/                   # MCP and external services
│   ├── mcp/
│   │   ├── desktop-commander/
│   │   └── safe-exec/
│   ├── monitoring/
│   └── frontend/
├── tools/                      # Development and operational tools
│   ├── scripts/
│   ├── deployment/
│   └── security/
├── tests/                      # All test files
│   ├── unit/
│   ├── integration/
│   ├── security/
│   └── fixtures/
├── artifacts/                  # Build outputs and generated files
│   ├── reports/
│   ├── logs/
│   └── builds/
└── legacy/                     # Temporary backward compatibility
```

## Migration Strategy

### Phase 1: Create New Directory Structure
- Create all new directories
- Maintain existing structure during transition

### Phase 2: Move and Rename Files
- Move files to appropriate new locations
- Rename files following consistent conventions
- Update file contents with new paths

### Phase 3: Update Dependencies
- Update all import/require statements
- Update configuration references
- Update build system paths

### Phase 4: Verification and Cleanup
- Test all functionality
- Remove old empty directories
- Update documentation

## File Naming Conventions

### General Rules:
- Use kebab-case for directories: `user-guides/`, `safe-exec/`
- Use snake_case for Python files: `memory_harvester.py`
- Use kebab-case for JavaScript/Node files: `error-handler.js`
- Use UPPER_CASE for documentation: `README.md`, `CHANGELOG.md`
- Use descriptive names that indicate purpose

### Specific Patterns:
- Configuration files: `config-name.json`, `service-name.config.js`
- Test files: `component-name.test.js`, `test_component.py`
- Documentation: `COMPONENT_GUIDE.md`, `api-reference.md`
- Scripts: `action-name.sh`, `deploy-service.js`

## Backward Compatibility

### Symlinks Strategy:
- Create symlinks from old locations to new locations
- Maintain for 2 release cycles
- Add deprecation warnings in code

### Environment Variables:
- Update all path-based environment variables
- Provide fallback logic for old paths
- Document migration in CHANGELOG

## Implementation Priority:

1. **High Priority**: Core source code and configuration
2. **Medium Priority**: Documentation and tools
3. **Low Priority**: Legacy files and artifacts

## Success Criteria:

- [ ] All tests pass after reorganization
- [ ] All services start successfully
- [ ] Documentation is easily navigable
- [ ] Build system works without modification
- [ ] No broken internal references
- [ ] Consistent naming throughout