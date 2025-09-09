FROM node:20-alpine
WORKDIR /app
COPY mcp/safe-exec/package.json ./package.json
RUN npm i --omit=dev
COPY mcp/safe-exec/server.mjs ./server.mjs
COPY mcp/safe-exec/policy.json ./policy.json
ENV SAFEEXEC_WORKDIR=/workspace \
    SAFEEXEC_TIMEOUT_MS=600000 \
    SAFEEXEC_POLICY=/app/policy.json
ENTRYPOINT ["node","/app/server.mjs"]
