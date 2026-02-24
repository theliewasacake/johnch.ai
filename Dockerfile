# Multi-stage build: build dependencies + app
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies for bcrypt
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev)
RUN npm ci

# Final runtime image
FROM node:20-alpine

WORKDIR /app

# Install SSH client for git operations
RUN apk add --no-cache openssh-client git

# Copy package files and node_modules from builder
COPY package*.json ./
COPY --from=builder /app/node_modules ./node_modules

# Copy application code
COPY server/ ./server/
COPY templates/ ./templates/
COPY public/ ./public/
COPY config.json* ./

# Copy entrypoint script
COPY docker-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Create directories for mounted volumes
RUN mkdir -p /app/content /app/public/images

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=60s \
  CMD wget -q --spider http://localhost:3000 || exit 1

# Use entrypoint script instead of direct npm start
ENTRYPOINT ["/entrypoint.sh"]
