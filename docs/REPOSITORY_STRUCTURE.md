# Repository Structure Guide

## Overview

This document describes the reorganized structure of the MHE (Memory Harvester Engine) repository, designed to enhance modularity, maintainability, and clarity.

## Directory Structure

### Root Level
```
mhe/
├── config/           # Configuration files
├── docs/             # Documentation
├── src/              # Source code
├── services/         # Service components
├── tools/            # Development and operational tools
├── tests/            # Test suites
├── artifacts/        # Build outputs and generated files
└── [project files]   # Package.json, README, etc.
```

### Configuration (`config/`)
Centralized configuration management:
- `environment/` - Environment variables and settings
- `build/` - Build system configuration (docker-compose.yml)
- `database/` - Database configuration and migrations (alembic)
- `testing/` - Test configuration (pytest.ini)

### Services (`services/`)
Service-oriented components:
- `mcp/components/` - MCP (Model Context Protocol) components
  - `safe-exec/` - SafeExec server implementation
  - `desktop-commander/` - Desktop Commander components
- `frontend/app/` - Frontend application
- `monitoring/components/` - Monitoring and observability

### Tools (`tools/`)
Development and operational utilities:
- `scripts/operational/` - Operational scripts (version-sync, validation)
- `deployment/` - Deployment tools and configurations
  - `ops/` - Operations scripts (env-validate, monitor)
  - `docker/` - Docker configurations
- `security/` - Security tools (policy-lock.mjs)

### Tests (`tests/`)
Organized testing structure:
- `unit/` - Unit tests
- `integration/` - Integration tests
- `e2e/` - End-to-end tests
- `legacy/` - Existing test files (temporary)

### Artifacts (`artifacts/`)
Generated content and build outputs:
- `builds/` - Build artifacts
- `logs/` - Application logs
- `reports/` - Test reports and analysis

## Migration Summary

### Key Changes
1. **Root Cleanup**: Moved configuration and operational files to dedicated directories
2. **Service Organization**: Grouped related services under `services/`
3. **Tool Consolidation**: Centralized scripts and tools under `tools/`
4. **Test Structure**: Created proper test hierarchy
5. **Configuration Management**: Centralized all config files

### File Movements
- `policy-lock.mjs` → `tools/security/policy-lock.mjs`
- `.env.example` → `config/environment/.env.example`
- `test/` → `tests/legacy/`
- `mcp/` → `services/mcp/components/`
- `frontend/` → `services/frontend/app/`
- `scripts/` → `tools/scripts/operational/`
- `ops/` → `tools/deployment/ops/`
- `docker/` → `tools/deployment/docker/`
- `alembic.ini` → `config/database/alembic.ini`
- `pytest.ini` → `config/testing/pytest.ini`

## Updated Scripts

All npm scripts have been updated to reflect new paths:
```json
{
  "policy:validate": "node tools/security/policy-lock.mjs validate",
  "env:validate": "node tools/deployment/ops/env-validate.mjs",
  "test:integration": "node tests/legacy/integration.spec.mjs",
  "safeexec:start": "cd services/mcp/components/safe-exec && node server.mjs"
}
```

## Benefits

1. **Improved Organization**: Clear separation of concerns
2. **Enhanced Maintainability**: Easier to locate and modify components
3. **Better Scalability**: Structure supports future growth
4. **Cleaner Root**: Reduced clutter in project root
5. **Consistent Naming**: Standardized directory and file naming

## Backward Compatibility

- All npm scripts updated to new paths
- Import statements in test files corrected
- Configuration references updated
- Legacy test structure preserved during transition

## Next Steps

1. Gradually migrate legacy tests to proper structure
2. Update documentation references
3. Consider creating symbolic links for critical backward compatibility
4. Update CI/CD pipelines to use new paths

For questions or issues with the new structure, refer to the REORGANIZATION_PLAN.md file or contact the development team.