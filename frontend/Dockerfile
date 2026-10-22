# Stage 1: Build React 19 + Vite 8 frontend
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package manifests and .npmrc for legacy peer dependencies
COPY package*.json .npmrc* ./

# Deterministic install
RUN npm ci --legacy-peer-deps || npm install --legacy-peer-deps

# Copy frontend source files
COPY . ./

# Build-time API configuration (defaults to /api for reverse proxy)
ARG VITE_API_URL=/api
ENV VITE_API_URL=${VITE_API_URL}

# Compile production bundle to /app/dist
RUN npm run build

# Stage 2: Production Nginx web server
FROM nginx:1.27-alpine AS runner

# Remove default nginx html files
RUN rm -rf /usr/share/nginx/html/*

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled static files
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
