# syntax = docker/dockerfile:1
FROM node:18-alpine

# Set working directory inside the container
WORKDIR /app

# Install tools needed for better-sqlite3 native compilation
RUN apk add --no-cache python3 make g++ 

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the application code
COPY . .

# Start the server by default
CMD ["node", "server.js"]