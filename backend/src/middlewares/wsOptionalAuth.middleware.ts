import { Request } from 'express';
import { NextFunction } from 'express-serve-static-core';
import WebSocket from 'ws';
import jwt from 'jsonwebtoken';
import { userService } from '../services/user.service'; // Dùng service để tận dụng cache/enrich nếu có
import { logger } from '../utils/logger.util';
import { tokenConfig } from '../config/token.config'; // IMPORT CONFIG TOKEN

interface JwtPayload {
  id: string; // SỬA: Phải là 'id' để khớp với auth.service
  role?: string;
}

export const wsOptionalAuthMiddleware = async (ws: WebSocket, req: Request, next: NextFunction) => {
  let token = req.query.token as string;
  const visitorId = req.query.visitorId as string;

  if (!token && (req as any).cookies) {
    token = (req as any).cookies.accessToken;
  }

  if (token) {
    try {
      // SỬA 1: Dùng secret từ tokenConfig để đồng bộ với lúc tạo token
      const secret = tokenConfig.access.secret;
      
      // SỬA 2: Verify và ép kiểu đúng
      const decoded = jwt.verify(token, secret) as JwtPayload;

      // SỬA 3: Kiểm tra 'id' thay vì 'userId'
      if (decoded.id) {
        // Dùng userService.getById để đồng bộ logic lấy user (bao gồm check isDeleted,...)
        const user = await userService.getById(decoded.id);
        
        if (user) {
          (req as any).user = user;
          logger.info(`[WS-Auth] Authenticated user ${user.username} (ID: ${user._id})`);
        }
      } else {
          logger.warn(`[WS-Auth] Token missing 'id' payload.`);
      }
    } catch (error) {
      // Nếu token lỗi, log ra để debug nhưng vẫn cho qua (để fallback về guest)
      // Quan trọng: Client đã fix logic refresh trước khi connect, nên lỗi ở đây 
      // thường là do Token cũ quá hoặc Hack, fallback về Guest là an toàn.
      logger.warn(`[WS-Auth] Token verification failed: ${(error as Error).message}`);
    }
  }

  // --- LOGIC GUEST / FINGERPRINT ---
  if (visitorId && !(req as any).user) {
    (req as any).fingerprint = {
      ...(req as any).fingerprint,
      hash: visitorId,
    };
    logger.info(`[WS-Auth] Identified guest: ${visitorId}`);
  }

  next();
};