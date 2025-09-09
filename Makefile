# Desktop Commander MCP - Automation Scripts

# ----- NPX path -----
npx-up:
	@echo "Starting Desktop Commander via NPX..."
	@echo "TRAE will spawn it automatically from .trae/mcp.json when needed."

npx-remove:
	npx -y @wonderwhy-er/desktop-commander@latest remove || true

# ----- Docker path -----
docker-up:
	WORKSPACE=$$(pwd) docker compose -f docker/desktop-commander/docker-compose.yml run --rm desktop-commander

docker-build:
	docker compose -f docker/desktop-commander/docker-compose.yml build

docker-pull:
	docker pull node:20-alpine

# Convenience: ensure env var exists for compose
print-workspace:
	@echo "WORKSPACE=$$(pwd)"

# ----- Setup and validation -----
setup-npx:
	@echo "Validating NPX setup..."
	node -v
	npm -v
	@echo "NPX setup complete. Configure TRAE to use 'desktop-commander' server."

setup-docker:
	@echo "Validating Docker setup..."
	docker --version
	docker compose version
	make docker-build
	@echo "Docker setup complete. Configure TRAE to use 'desktop-commander-docker' server."

# ----- Testing -----
test-npx:
	@echo "Run these commands in TRAE to test NPX deployment:"
	@echo "1. pwd && node -v"
	@echo "2. Create hello.txt with 'hi from TRAE' and read it back"

test-docker:
	@echo "Run these commands in TRAE to test Docker deployment:"
	@echo "1. pwd && whoami"
	@echo "2. Start background python -m http.server 8080, list processes, and kill it"

.PHONY: npx-up npx-remove docker-up docker-build docker-pull print-workspace setup-npx setup-docker test-npx test-docker