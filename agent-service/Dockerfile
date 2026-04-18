FROM node:20-slim

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
COPY agent-service ./agent-service

WORKDIR /app/agent-service

# Expose the server port
EXPOSE 4005

# Start the server in dev mode
CMD ["npm", "run", "dev"]
