# Makefile Quick Reference

This document provides a quick reference for all available Makefile targets for the Desktop Commander MCP server deployment.

## NPX Deployment Commands

### `make npx-up`
Starts the Desktop Commander MCP server using NPX.
```bash
npx desktop-commander-test
```

### `make npx-remove`
Removes the NPX-installed Desktop Commander package.
```bash
npm uninstall -g desktop-commander-test
```

### `make setup-npx`
Sets up the NPX deployment environment (validates Node.js and npm).
```bash
node -v && npm -v
```

### `make test-npx`
Tests the NPX deployment by running the help command.
```bash
npx desktop-commander-test --help
```

## Docker Deployment Commands

### `make docker-up`
Starts the Desktop Commander MCP server using Docker Compose.
```bash
WSPACE=$(shell pwd) docker compose -f docker/desktop-commander/docker-compose.yml up -d
```

### `make docker-build`
Builds the Docker image for the Desktop Commander MCP server.
```bash
WSPACE=$(shell pwd) docker compose -f docker/desktop-commander/docker-compose.yml build
```

### `make docker-pull`
Pulls the latest base images for the Docker build.
```bash
docker pull node:20-alpine
```

### `make setup-docker`
Sets up the Docker deployment environment (validates Docker and Docker Compose).
```bash
docker --version && docker compose version
```

### `make test-docker`
Tests the Docker deployment by checking if the container is running.
```bash
WSPACE=$(shell pwd) docker compose -f docker/desktop-commander/docker-compose.yml ps
```

## Convenience Commands

### `make help`
Displays all available Makefile targets with descriptions.

### `make clean`
Cleans up temporary files and stopped containers.
```bash
docker system prune -f
```

### `make status`
Shows the status of both NPX and Docker deployments.

### `make logs`
Displays logs from the Docker deployment.
```bash
WSPACE=$(shell pwd) docker compose -f docker/desktop-commander/docker-compose.yml logs -f
```

## Validation Commands

### `make validate-env`
Validates all environment prerequisites.
```bash
node -v && npm -v && docker --version && docker compose version
```

### `make validate-npx`
Validates NPX deployment readiness.
```bash
node -v && npm -v
```

### `make validate-docker`
Validates Docker deployment readiness.
```bash
docker --version && docker compose version && docker info
```

## Usage Examples

### Quick Start with NPX
```bash
make setup-npx
make test-npx
make npx-up
```

### Quick Start with Docker
```bash
make setup-docker
make docker-build
make docker-up
make logs
```

### Environment Validation
```bash
make validate-env
```

### Cleanup
```bash
make clean
```

## Environment Variables

### Required for Docker
- `WORKSPACE`: Automatically set to current directory by Makefile

### Optional
- `NODE_ENV`: Set to 'production' for production deployments
- `DEBUG`: Set to enable debug logging

## Notes

1. **Windows Users**: Use PowerShell or Git Bash for best compatibility
2. **Docker Requirements**: Docker Desktop must be running for Docker commands
3. **NPX Requirements**: Internet connection required for first-time package download
4. **Permissions**: Some commands may require elevated privileges on Windows

## Troubleshooting

### Make Command Not Found
- **Windows**: Install Make via Chocolatey (`choco install make`) or use Git Bash
- **macOS**: Install via Homebrew (`brew install make`)
- **Linux**: Usually pre-installed, or install via package manager

### Docker Commands Failing
1. Ensure Docker Desktop is running
2. Check Docker daemon status with `docker info`
3. Verify Docker Compose is installed

### NPX Commands Failing
1. Check Node.js and npm versions
2. Clear npm cache: `npm cache clean --force`
3. Check internet connectivity

---

**Quick Reference Version**: 1.0
**Compatible with**: Desktop Commander MCP Server Implementation
**Last Updated**: 2025-09-09