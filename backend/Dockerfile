FROM node:20-slim AS builder

WORKDIR /server

COPY package*.json ./

# Install dependencies
RUN npm install

COPY . .

RUN npm run build

# --- Giai đoạn Runtime ---
FROM node:20-slim

WORKDIR /server

# 1. Cài đặt ffmpeg và các dependencies cần thiết để cài MongoDB Tools
RUN apt-get update && apt-get install -y \
    ffmpeg \
    wget \
    && rm -rf /var/lib/apt/lists/*

# 2. Tải và cài đặt MongoDB Database Tools (mongodump, mongorestore)
# Sử dụng phiên bản dành cho Debian 12 (Bookworm) - tương ứng với node:20-slim
RUN wget https://fastdl.mongodb.org/tools/db/mongodb-database-tools-debian12-x86_64-100.9.4.deb && \
    apt-get install -y ./mongodb-database-tools-*.deb && \
    rm mongodb-database-tools-*.deb

# 3. Thiết lập biến môi trường cho ffmpeg (optional but recommended)
ENV FFMPEG_PATH=/usr/bin/ffmpeg
ENV FFPROBE_PATH=/usr/bin/ffprobe

COPY --from=builder /server/package*.json ./

# Cài đặt dependencies production
RUN npm install --omit=dev --ignore-scripts

COPY --from=builder /server/dist ./dist
COPY --from=builder /server/public ./public
# Nếu có swagger
COPY --from=builder /server/swaggerConfig.js ./ 

EXPOSE 5000
CMD ["sh", "-c", "ls -R /server/dist && node dist/server.js"]