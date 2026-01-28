FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY backend/package*.json ./backend/

# Install dependencies
WORKDIR /app/backend
RUN npm install --production

# Copy all files
WORKDIR /app
COPY . .

# Expose port
EXPOSE 3001

# Start server
WORKDIR /app/backend
CMD ["node", "src/server.js"]
