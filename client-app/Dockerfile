# Build stage
FROM node:20-slim AS build

WORKDIR /app

# Copy root workspace configuration
COPY package.json package-lock.json ./

# Copy all package files to allow a proper root install
COPY shared/package.json ./shared/
COPY client-app/package.json ./client-app/
COPY tasks-service/package.json ./tasks-service/
COPY bff-service/package.json ./bff-service/
COPY mcp-service/package.json ./mcp-service/
COPY agent-service/package.json ./agent-service/

# Install ALL dependencies at the root
RUN npm ci

# Copy source code
COPY shared ./shared
COPY client-app ./client-app

# Build the client
WORKDIR /app/client-app
RUN npm install @tailwindcss/oxide-linux-arm64-gnu@4.0.13 @tailwindcss/oxide-linux-x64-gnu@4.0.13 lightningcss-linux-arm64-gnu lightningcss-linux-x64-gnu --no-save --force
RUN npm run build

# Production stage
FROM nginx:stable-alpine
COPY --from=build /app/client-app/dist /usr/share/nginx/html

# Custom nginx config to support SPA routing
RUN echo 'server { \
    listen 80; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html index.htm; \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
