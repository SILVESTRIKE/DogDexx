# Stage 1: Build the application
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the application source code
COPY . .

# Build the TypeScript project
# (Giả định bạn có script "build" trong package.json để biên dịch TS ra JS)
RUN npm run build

# Stage 2: Create the final, smaller production image
FROM node:18-alpine

WORKDIR /app

# Copy only the necessary files from the builder stage
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./
COPY --from=builder /app/dist ./

# Expose the port the app runs on
EXPOSE 3000

# Command to run the application
CMD [ "node", "dist/server.js" ]
