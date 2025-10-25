import { Request, Response, NextFunction, RequestHandler } from 'express';
import jwt from "jsonwebtoken";
import { userService, EnrichedUser } from "../services/user.service"; // THAY ĐỔI: Import EnrichedUser
import { IncomingMessage } from 'http';
import { parse } from 'url';
import { logger } from '../utils/logger.util';

interface JwtPayload {
  userId: string;
}

export const optionalAuthMiddleware: RequestHandler = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
      // userService.getById giờ đây trả về user đã được làm giàu
      const user = await userService.getById(decoded.userId);

      if (user) {
        // Gán user đã được làm giàu vào req.user
        (req as any).user = user as EnrichedUser;
      }
    } catch (error) {
      // Bỏ qua token không hợp lệ và tiếp tục như một khách
    }
  }

  // --- LOGIC ĐỒNG BỘ FINGERPRINT ---
  // Ưu tiên fingerprint do client gửi lên để đảm bảo tính nhất quán.
  const visitorIdFromHeader = req.headers['x-visitor-id'] as string;
  if (visitorIdFromHeader) {
    // Ghi đè hoặc tạo đối tượng fingerprint với hash từ client.
    // Điều này đảm bảo tất cả các middleware sau đó (như tokenLimiter)
    // sẽ sử dụng cùng một định danh.
    (req as any).fingerprint = {
      ...(req as any).fingerprint, // Giữ lại các thông tin khác nếu có
      hash: visitorIdFromHeader,
    };
  }
  next();
};

export const authenticateSocket = async (req: IncomingMessage, callback: () => void) => {
  const { query } = parse(req.url || '', true);
  const token = query.token as string | undefined;

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
      const user = await userService.getById(decoded.userId);
      
      if (user) {
        // Gán user đã được làm giàu vào request
        (req as any).user = user;
        logger.info(`[SocketAuth] User ${user.username} authenticated for WebSocket.`);
      } else {
        logger.warn(`[SocketAuth] Token valid, but user not found for token.`);
      }
    } catch (error) {
      logger.warn(`[SocketAuth] Invalid token for WebSocket: ${(error as Error).message}`);
    }
  } else {
    logger.info('[SocketAuth] No token provided for WebSocket connection. Continuing as guest.');
  }

  callback();
};