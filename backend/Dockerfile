# Stage 1: Install production dependencies
FROM node:20-alpine AS dependencies

WORKDIR /app

COPY package*.json ./

# Install production dependencies deterministically
RUN npm ci --omit=dev || npm install --omit=dev

# Stage 2: Production runtime image
FROM node:20-alpine AS runner

WORKDIR /app

# Switch to non-root user
USER node

# Copy dependencies and application source with appropriate ownership
COPY --chown=node:node --from=dependencies /app/node_modules ./node_modules
COPY --chown=node:node package*.json ./
COPY --chown=node:node src/ ./src/

ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:5000/api/health || exit 1

CMD ["node", "src/server.js"]
