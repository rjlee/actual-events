FROM node:22-slim AS builder
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

ENV HUSKY=0
ENV PYTHON=/usr/bin/python3
ENV npm_config_python=/usr/bin/python3

ARG ACTUAL_API_VERSION
ARG GIT_SHA
ARG APP_VERSION

COPY package*.json ./
RUN npm pkg delete scripts.prepare || true && \
    if [ -n "$ACTUAL_API_VERSION" ]; then \
      npm pkg set dependencies.@actual-app/api=$ACTUAL_API_VERSION && \
      npm install --package-lock-only --no-audit --no-fund; \
    fi && \
    npm ci --omit=dev --no-audit --no-fund

COPY . .

FROM node:22-slim AS runner
WORKDIR /app

COPY --from=builder /app /app

ARG ACTUAL_API_VERSION
ARG GIT_SHA
ARG APP_VERSION
LABEL org.opencontainers.image.revision="$GIT_SHA" \
      org.opencontainers.image.version="$APP_VERSION" \
      io.actual.api.version="$ACTUAL_API_VERSION"

ENV NODE_ENV=production

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "const p=process.env.HTTP_PORT||'3000';require('http').get('http://localhost:'+p+'/healthz',res=>process.exit(res.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["npm", "run", "start"]
