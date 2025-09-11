# syntax=docker/dockerfile:1.7-labs

FROM node:22-alpine AS client-build
ARG CLIENT_DIR=web
WORKDIR /usr/src/${CLIENT_DIR}
COPY ${CLIENT_DIR}/package*.json ./
RUN --mount=type=cache,id=npm-cache,target=/root/.npm \
    if [ -f package-lock.json ]; then npm ci; else npm install; fi
COPY ${CLIENT_DIR}/ .
RUN npm run build

FROM python:3.12-slim AS python-base
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates git \
    && rm -rf /var/lib/apt/lists/*

ARG APP_USER=appuser
RUN useradd -m -u 10001 ${APP_USER}
WORKDIR /app

COPY pyproject.toml ./
COPY requirements.txt ./ 2>/dev/null || true

RUN set -eux; \
    python -m pip install --upgrade pip; \
    if [ -f requirements.txt ]; then pip install -r requirements.txt; else pip install -e .[dev]; fi

COPY . .

ARG CLIENT_DIR=web
COPY --from=client-build /usr/src/${CLIENT_DIR}/dist ./public 2>/dev/null || true
COPY --from=client-build /usr/src/${CLIENT_DIR}/build ./public 2>/dev/null || true

USER ${APP_USER}
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s CMD python -c "import socket; s=socket.socket(); s.connect(('127.0.0.1',8000))" || exit 1
CMD ["python", "-m", "your_package_name"]
