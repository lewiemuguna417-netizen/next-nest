FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --silent || npm install --silent

# Copy source code
COPY . .

# Build the app with proper error handling
RUN echo "Starting build process..." && \
    npm run build && \
    echo "Frontend build completed successfully" && \
    ls -la dist/ && \
    echo "Verifying dist contents:" && \
    ls -la dist/assets/ && \
    echo "Build verification complete"

# Copy custom server
COPY server.js .

# Expose the correct port
EXPOSE 8080

# Use custom server to properly serve static files and handle SPA routing
CMD ["node", "server.js"]