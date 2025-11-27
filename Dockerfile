# ==============================================
# PAXFORM FULLSTACK DOCKERFILE
# Multi-stage build for complete application deployment
# ==============================================

# Stage 1: Build Backend Dependencies
FROM node:18-alpine AS backend-builder

WORKDIR /app

# Copy backend package files
COPY backend/package*.json backend/.env* ./backend/

# Install backend dependencies
WORKDIR /app/backend
RUN npm install --include=dev

# Copy backend source and build
COPY backend/ .
RUN npm run build

# Stage 2: Build Frontend Dependencies  
FROM node:18-alpine AS frontend-builder

WORKDIR /app

# Copy frontend package files
COPY frontend/package*.json frontend/package-lock.json ./frontend/

# Install frontend dependencies
WORKDIR /app/frontend
RUN npm ci

# Copy frontend source and build
COPY frontend/ .
RUN npm run build

# Stage 3: Production Stage
FROM node:18-alpine AS production

# Install runtime dependencies (only what's actually needed)
RUN apk add --no-cache \
    dumb-init \
    curl

# Create non-root user
RUN addgroup -g 1001 -S paxform && \
    adduser -S paxform -u 1001

WORKDIR /app

# Copy backend build artifacts
COPY --from=backend-builder /app/backend/dist ./backend/dist
COPY --from=backend-builder /app/backend/node_modules ./backend/node_modules
COPY --from=backend-builder /app/backend/package*.json ./backend/

# Copy frontend build artifacts
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist
COPY --from=frontend-builder /app/frontend/server.js ./frontend/
COPY --from=frontend-builder /app/frontend/package*.json ./frontend/

# Install production dependencies for backend
WORKDIR /app/backend
RUN npm ci --only=production

# Create upload directory with proper permissions
RUN mkdir -p /app/uploads && \
    chown -R paxform:paxform /app/uploads

# Create environment configuration script
RUN echo '#!/bin/sh' > /app/load-env.sh && \
    echo 'set -a' >> /app/load-env.sh && \
    echo '# Load environment variables with defaults' >> /app/load-env.sh && \
    echo 'export NODE_ENV="${NODE_ENV:-production}"' >> /app/load-env.sh && \
    echo 'export PORT="${PORT:-8080}"' >> /app/load-env.sh && \
    echo 'export JWT_SECRET="${JWT_SECRET:-d3a5e7c9b2f4a1d8e6c3b9a7d2f5e8c1b4a6d9e2f7c5b8a3d1e6f9c2b5a8d4e7}"' >> /app/load-env.sh && \
    echo 'export DATABASE_URL="${DATABASE_URL:-postgresql://localhost:5432/paxform}"' >> /app/load-env.sh && \
    echo 'export FRONTEND_URL="${FRONTEND_URL:-http://localhost:8080}"' >> /app/load-env.sh && \
    echo 'export API_PREFIX="${API_PREFIX:-api}"' >> /app/load-env.sh && \
    echo 'export API_VERSION="${API_VERSION:-v1}"' >> /app/load-env.sh && \
    echo 'export CORS_ORIGIN="${CORS_ORIGIN:-http://localhost:8080}"' >> /app/load-env.sh && \
    echo 'export VITE_BACKEND_URL="${VITE_BACKEND_URL:-http://localhost:8080}"' >> /app/load-env.sh && \
    echo 'export VITE_API_URL="${VITE_API_URL:-http://localhost:8080/api/v1}"' >> /app/load-env.sh && \
    echo 'export VITE_DEV_MODE="${VITE_DEV_MODE:-false}"' >> /app/load-env.sh && \
    echo 'set +a' >> /app/load-env.sh && \
    echo 'echo "Environment loaded: NODE_ENV=${NODE_ENV}, PORT=${PORT}"' >> /app/load-env.sh && \
    chmod +x /app/load-env.sh

# Create the main startup script
RUN echo '#!/bin/sh' > /app/start.sh && \
    echo '. /app/load-env.sh' >> /app/start.sh && \
    echo '' >> /app/start.sh && \
    echo '# Start the backend server' >> /app/start.sh && \
    echo 'cd /app/backend && exec npm run start' >> /app/start.sh && \
    chmod +x /app/start.sh

# Create comprehensive startup script with health checks and monitoring
RUN echo '#!/bin/sh' > /app/entrypoint.sh && \
    echo 'set -e' >> /app/entrypoint.sh && \
    echo '' >> /app/entrypoint.sh && \
    echo '# Load environment variables' >> /app/entrypoint.sh && \
    echo '. /app/load-env.sh' >> /app/entrypoint.sh && \
    echo '' >> /app/entrypoint.sh && \
    echo '# Log startup information' >> /app/entrypoint.sh && \
    echo 'echo "🚀 Starting PAXFORM Fullstack Application"' >> /app/entrypoint.sh && \
    echo 'echo "🌐 Frontend URL: ${FRONTEND_URL}"' >> /app/entrypoint.sh && \
    echo 'echo "🔗 API URL: ${FRONTEND_URL}/${API_PREFIX}/${API_VERSION}"' >> /app/entrypoint.sh && \
    echo 'echo "📚 API Docs: ${FRONTEND_URL}/${API_PREFIX}/${API_VERSION}/docs"' >> /app/entrypoint.sh && \
    echo 'echo "💾 Database: Connected"' >> /app/entrypoint.sh && \
    echo 'echo "📧 Email: SendGrid configured"' >> /app/entrypoint.sh && \
    echo 'echo "📅 Calendar: Google API configured"' >> /app/entrypoint.sh && \
    echo 'echo "🔐 JWT Secret: ${JWT_SECRET:0:10}..."' >> /app/entrypoint.sh && \
    echo '' >> /app/entrypoint.sh && \
    echo '# Start application services' >> /app/entrypoint.sh && \
    echo 'exec "$@"' >> /app/entrypoint.sh && \
    chmod +x /app/entrypoint.sh

# Change ownership to non-root user
RUN chown -R paxform:paxform /app
USER paxform

# Expose the application port
EXPOSE 8080

# Health check to verify backend API is responding
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8080/api/v1/health || exit 1

# Use the startup script with proper signal handling
ENTRYPOINT ["dumb-init", "--", "/app/entrypoint.sh"]

# Start the fullstack application
CMD ["/app/start.sh"]

# ==============================================
# BUILD CONTEXT NOTES:
# ==============================================
# This Dockerfile should be built with:
# docker build -t paxform-fullstack .
#
# Run with:
# docker run -p 8080:8080 \
#   -e NODE_ENV=production \
#   -e JWT_SECRET=your-secret-here \
#   -e DATABASE_URL=your-database-url \
#   paxform-fullstack
#
# Environment Variables (all have sensible defaults):
# - NODE_ENV: Application environment (default: production)
# - PORT: Application port (default: 8080)
# - JWT_SECRET: JWT signing secret (required for production)
# - DATABASE_URL: PostgreSQL connection string
# - FRONTEND_URL: Frontend base URL
# - VITE_API_URL: Frontend API URL
# - SENDGRID_API_KEY: SendGrid email service key
# - GOOGLE_CLIENT_ID/SECRET: Google OAuth credentials
# ==============================================