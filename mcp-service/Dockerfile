FROM node:20-slim

WORKDIR /app

# Copy root workspace configuration
COPY package.json package-lock.json ./

# Copy all package files
COPY shared/package.json ./shared/
COPY client-app/package.json ./client-app/
COPY tasks-service/package.json ./tasks-service/
COPY bff-service/package.json ./bff-service/
COPY mcp-service/package.json ./mcp-service/
COPY agent-service/package.json ./agent-service/

# Install dependencies
RUN npm ci

# Copy source code
COPY shared ./shared
COPY mcp-service ./mcp-service

WORKDIR /app/mcp-service

# Expose the MCP ports
EXPOSE 4003

# Start the service
CMD ["npm", "start"]
