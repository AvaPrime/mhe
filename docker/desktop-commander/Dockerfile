FROM node:18-alpine

# Create non-root user
RUN addgroup -g 1000 -S mhe && \
    adduser -u 1000 -S mhe -G mhe

# Install security updates
RUN apk update && apk upgrade && \
    apk add --no-cache dumb-init && \
    rm -rf /var/cache/apk/*

# Set working directory
WORKDIR /workspace

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy application code
COPY . .

# Change ownership to non-root user
RUN chown -R mhe:mhe /workspace

# Switch to non-root user
USER mhe

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Default command
CMD ["node", "--version"]