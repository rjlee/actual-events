FROM node:20-alpine AS base
WORKDIR /app

# Install production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY src ./src

ENV NODE_ENV=production

EXPOSE 4000
ENTRYPOINT ["node", "src/index.js"]

