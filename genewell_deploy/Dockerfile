# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies for building)
RUN npm ci

# Copy source code
COPY . .

# Build client (Vite SPA) and server (Node.js bundle)
RUN npm run build

# Stage 2: Production
FROM node:22-alpine AS runner

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install only production dependencies
RUN npm ci --omit=dev

# Copy built artifacts from builder
COPY --from=builder /app/dist ./dist

# Copy public assets (fonts, favicon, etc.) needed at runtime
COPY --from=builder /app/public ./public

# Expose port (Zeabur will override via PORT env var)
EXPOSE 5000

# Start the server
CMD ["node", "dist/server/production.mjs"]
