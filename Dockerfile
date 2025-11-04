FROM node:22-slim AS base
WORKDIR /app

# Accept Actual API version and metadata as build args
ARG ACTUAL_API_VERSION
ARG GIT_SHA
ARG APP_VERSION

# Install build deps for native modules (better-sqlite3) and production deps;
# allow overriding @actual-app/api when provided
COPY package*.json ./
ENV HUSKY=0
# Ensure Python is available for node-gyp and advertise via env (npm v10 no longer supports `npm config set python`)
ENV PYTHON=/usr/bin/python3
ENV npm_config_python=/usr/bin/python3
RUN set -eux; \
    if command -v apk >/dev/null 2>&1; then \
      apk add --no-cache python3 make g++; \
    else \
      apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*; \
    fi; \
    if [ -n "$ACTUAL_API_VERSION" ]; then \
      npm pkg set dependencies.@actual-app/api=$ACTUAL_API_VERSION && \
      npm install --package-lock-only --no-audit --no-fund; \
    fi; \
    npm ci --omit=dev --no-audit --no-fund

# Copy source
COPY src ./src

ENV NODE_ENV=production

# Useful metadata labels
LABEL org.opencontainers.image.revision="$GIT_SHA" \
      org.opencontainers.image.version="$APP_VERSION" \
      io.actual.api.version="$ACTUAL_API_VERSION"

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "const p=process.env.HTTP_PORT||'3000';require('http').get('http://localhost:'+p+'/healthz',res=>process.exit(res.statusCode===200?0:1)).on('error',()=>process.exit(1))"
ENTRYPOINT ["node", "src/index.js"]
