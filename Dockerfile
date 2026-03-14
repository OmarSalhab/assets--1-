FROM node:18-alpine

# Install tools needed for better-sqlite3 native compilation
RUN apk add --no-cache python3 make g++ 

# Set working directory inside the container
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the application
COPY . .

# Expose the API port
EXPOSE 3000

# Start the server
CMD ["node", "server.js"]
