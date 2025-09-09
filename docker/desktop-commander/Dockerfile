FROM node:20-alpine
# Create non-root user
RUN addgroup -S dev && adduser -S dev -G dev
USER dev
WORKDIR /home/dev/app
# Cache npx downloads between runs when using a volume-mounted cache (optional)
ENV npm_config_cache=/home/dev/.npm
# Default command: run server via npx
ENTRYPOINT ["npx","-y","@wonderwhy-er/desktop-commander@latest"]