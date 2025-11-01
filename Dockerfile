FROM node:20-alpine AS base
WORKDIR /app

# Install production dependencies
COPY package*.json ./
RUN npm ci --only=production --no-audit --no-fund

# Copy source
COPY src ./src

ENV NODE_ENV=production

EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node","-e","require('http').get('http://localhost:4000/healthz',res=>process.exit(res.statusCode===200?0:1)).on('error',()=>process.exit(1))"]
ENTRYPOINT ["node", "src/index.js"]
