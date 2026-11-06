# Production Dockerfile for ZeroVault Backend
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package descriptors
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies including dev dependencies for build
RUN npm ci

# Generate Prisma Client
RUN npx prisma generate

# Copy source code and config
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript to dist
RUN npm run build

# Remove development dependencies
RUN npm prune --production

# ---------------------------------------------
# Runner stage
# ---------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001

# Copy production artifacts
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Create storage directories
RUN mkdir -p storage/public storage/private

EXPOSE 3001

CMD ["node", "dist/index.js"]
