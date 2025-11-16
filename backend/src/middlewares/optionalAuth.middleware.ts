import { Request, Response, NextFunction, RequestHandler } from 'express';
import jwt from "jsonwebtoken";
import { userService, EnrichedUser } from "../services/user.service";
import { IncomingMessage } from 'http';
import { parse } from 'url';
import { logger } from '../utils/logger.util';

interface JwtPayload {
  userId: string;
}

export const optionalAuthMiddleware: RequestHandler = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  // --- LOGIC ĐỒNG BỘ FINGERPRINT (giữ nguyên, nên đặt lên đầu) ---
  const visitorIdFromHeader = req.headers['x-visitor-id'] as string;
  if (visitorIdFromHeader) {
    req.fingerprint = { hash: visitorIdFromHeader };
  }

  // Nếu không có header Authorization, coi như là khách và cho qua.
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next();
  }

  // Nếu CÓ header, chúng ta phải xác thực nó.
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
    const user = await userService.getById(decoded.userId);

    if (user) {
      logger.info(`[OptionalAuth] Authenticated user ${user.username} (ID: ${user._id}) for request to ${req.originalUrl}`);
      req.user = user;
      return next(); // Xác thực thành công, đi tiếp
    } else {
      // Token hợp lệ nhưng không tìm thấy user -> lỗi -> trả về 401
      logger.warn(`[OptionalAuth] Token valid, but user with ID ${decoded.userId} not found.`);
      return res.status(401).json({ message: "User for this token not found." });
    }
  } catch (error) {
    // Bất kỳ lỗi nào trong quá trình verify (hết hạn, sai chữ ký) đều trả về 401.
    // Đây là tín hiệu để client biết cần phải làm mới token.
    const errorMessage = (error as Error).message;
    logger.warn(`[OptionalAuth] Invalid token for ${req.originalUrl}. Error: ${errorMessage}`);
    return res.status(401).json({ message: `Invalid Token: ${errorMessage}` });
  }
};


// Phần authenticateSocket giữ nguyên, không cần thay đổi
export const authenticateSocket = async (req: IncomingMessage, callback: () => void) => {
  const { query } = parse(req.url || '', true);
  const token = query.token as string | undefined;

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
      const user = await userService.getById(decoded.userId);
      
      if (user) {
        (req as any).user = user;
        logger.info(`[SocketAuth] User ${user.username} authenticated for WebSocket.`);
      }
    } catch (error) {
      logger.warn(`[SocketAuth] Invalid token for WebSocket: ${(error as Error).message}`);
    }
  } else if (query.visitorId) {
    logger.info(`[SocketAuth] Guest connection with visitorId: ${query.visitorId}`);
  } else {
    logger.info('[SocketAuth] No token provided for WebSocket connection. Continuing as guest.');
  }

  callback();
};