FROM node:20-slim

WORKDIR /app

# Copy root workspace configuration
COPY package.json package-lock.json ./

# Copy all package files to allow a proper root install
COPY shared/package.json ./shared/
COPY client-app/package.json ./client-app/
COPY tasks-service/package.json ./tasks-service/
COPY bff-service/package.json ./bff-service/

# Install ALL dependencies at the root
RUN npm ci

# Copy source code
COPY shared ./shared
COPY tasks-service ./tasks-service

WORKDIR /app/tasks-service

# Expose the service port
EXPOSE 4002

# Start the service in dev mode
CMD ["npm", "run", "dev"]
