# Lightweight runtime image that clones code from GitHub on start
FROM node:20-alpine

WORKDIR /app

# Install git and build dependencies for bcrypt
RUN apk add --no-cache git python3 make g++

# Copy only the entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Create directories for mounted volumes
RUN mkdir -p /app/content /app/public/images

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000
# Override this with your repo URL (required for Docker deployments)
ENV REPO_URL=

EXPOSE 3000

ENTRYPOINT ["/docker-entrypoint.sh"]
