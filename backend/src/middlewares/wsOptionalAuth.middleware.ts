import { Request } from 'express';
import { NextFunction } from 'express-serve-static-core';
import WebSocket from 'ws';
import jwt from 'jsonwebtoken';
import { UserDoc, UserModel } from '../models/user.model';
import { logger } from '../utils/logger.util';

/**
 * Middleware xác thực tùy chọn dành riêng cho WebSocket.
 * Nó kiểm tra token từ query parameter `?token=...` hoặc từ cookie.
 * Nếu hợp lệ, nó sẽ gắn `req.user`. Nếu không, nó sẽ bỏ qua.
 * @param ws - Đối tượng WebSocket.
 * @param req - Đối tượng Request ban đầu của kết nối WebSocket.
 * @param next - Hàm next.
 */
export const wsOptionalAuthMiddleware = async (ws: WebSocket, req: Request, next: NextFunction) => {
  // Ưu tiên token từ query param cho WebSocket
  let token = req.query.token as string;
  const visitorId = req.query.visitorId as string;

  // Nếu không có, thử lấy từ cookie
  if (!token && (req as any).cookies) {
    token = (req as any).cookies.accessToken;
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
      const user = await UserModel.findById(decoded.userId).select('-password');
      if (user) {
        (req as any).user = user;
        logger.info(`[WS-Auth] Authenticated user ${user.username} (ID: ${user._id}) for WebSocket connection.`);
      }
    } catch (error) {
      // Bỏ qua lỗi (token hết hạn, không hợp lệ, v.v.) và coi như là guest
      logger.warn(`[WS-Auth] Invalid token provided for WebSocket. Treating as guest. Error: ${(error as Error).message}`);
    }
  }

  // --- LOGIC ĐỒNG BỘ FINGERPRINT CHO WEBSOCKET ---
  // Nếu có visitorId từ query, sử dụng nó làm định danh cho guest.
  if (visitorId && !(req as any).user) {
    // Ghi đè hoặc tạo đối tượng fingerprint với hash từ client.
    // Điều này đảm bảo tất cả các controller/service sau đó sẽ sử dụng cùng một định danh.
    (req as any).fingerprint = {
      ...(req as any).fingerprint,
      hash: visitorId,
    };
    logger.info(`[WS-Auth] Identified guest using client-provided visitorId: ${visitorId}.`);
  }


  next();
};
