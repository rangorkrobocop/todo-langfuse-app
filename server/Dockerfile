FROM node:20-slim

WORKDIR /app

# Copy root workspace configuration
COPY package.json package-lock.json ./

# Copy all package files to allow a proper root install
COPY shared/package.json ./shared/
COPY client/package.json ./client/
COPY server/package.json ./server/

# Install ALL dependencies at the root
RUN npm ci

# Copy source code
COPY shared ./shared
COPY server ./server

WORKDIR /app/server
RUN mkdir -p data

# Expose the server port
EXPOSE 4001

# Start the server in dev mode (as it uses tsx)
CMD ["npm", "run", "dev"]
