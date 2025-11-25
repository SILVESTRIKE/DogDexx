FROM node:20-alpine AS builder

WORKDIR /server

COPY package*.json ./

# Lưu ý: Nếu dùng Docker, hãy gỡ 'ffmpeg-static' khỏi package.json để giảm dung lượng ảnh
RUN npm install

COPY . .

RUN npm run build

# --- Giai đoạn Runtime ---
FROM node:20-alpine

WORKDIR /server

# 1. Cài đặt ffmpeg (và vips cho thư viện sharp)
RUN apk add --no-cache ffmpeg vips

# 2. (Tùy chọn nhưng KHUYÊN DÙNG) Thiết lập biến môi trường trỏ thẳng vào ffmpeg hệ thống
# Điều này giúp code của bạn tìm thấy ngay process.env.FFMPEG_PATH mà không cần dò tìm
ENV FFMPEG_PATH=/usr/bin/ffmpeg
ENV FFPROBE_PATH=/usr/bin/ffprobe

COPY --from=builder /server/package*.json ./

# Lưu ý: Sharp đôi khi cần chạy script cài đặt, nếu bị lỗi hãy bỏ --ignore-scripts
RUN npm install --omit=dev --ignore-scripts

COPY --from=builder /server/dist ./dist
COPY --from=builder /server/public ./public
# Nếu có swagger
COPY --from=builder /server/swaggerConfig.js ./ 

EXPOSE 5000
CMD [ "node", "dist/server.js" ]