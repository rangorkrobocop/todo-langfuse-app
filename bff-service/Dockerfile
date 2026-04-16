FROM node:20-slim

WORKDIR /app

# Copy root workspace configuration
COPY package.json package-lock.json ./

# Copy all package files to allow a proper root install
COPY shared/package.json ./shared/
COPY client/package.json ./client/
COPY tasks-service/package.json ./tasks-service/
COPY bff-service/package.json ./bff-service/

# Install ALL dependencies at the root
RUN npm ci

# Copy source code
COPY shared ./shared
COPY bff-service ./bff-service

WORKDIR /app/bff-service

# Expose the server port
EXPOSE 4001

# Start the server in dev mode
CMD ["npm", "run", "dev"]
