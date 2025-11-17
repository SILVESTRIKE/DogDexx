# Install dependencies
FROM node:18-alpine AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN npm install

# Build the app
FROM node:18-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Run the app
FROM node:18-alpine AS runner
WORKDIR /app
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./
COPY --from=builder /app/.next ./.next
# Cài đặt lại production dependencies thay vì copy toàn bộ node_modules
# Điều này giúp giảm kích thước image cuối cùng.
RUN npm install --omit=dev

EXPOSE 3001
CMD ["npm", "start"]
