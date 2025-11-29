import { Request, Response, NextFunction, RequestHandler } from 'express';
import jwt from "jsonwebtoken";
import { userService, EnrichedUser } from "../services/user.service";
import { IncomingMessage } from 'http';
import { parse } from 'url';
import { logger } from '../utils/logger.util';
import { NotAuthorizedError } from '../errors';
import { tokenConfig } from '../config/token.config';

interface JwtPayload {
  id: string;
  role?: string;
}
export const optionalAuthMiddleware: RequestHandler = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  const visitorIdFromHeader = req.headers['x-visitor-id'] as string;
  if (visitorIdFromHeader) {
    (req as any).fingerprint = {
      ...(req as any).fingerprint,
      hash: visitorIdFromHeader,
    };
  }

  // 1. Nếu KHÔNG gửi token -> Là Khách -> Cho qua (next)
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next();
  }

  const token = authHeader.split(" ")[1];
  try {
    const secret = tokenConfig.access.secret || process.env.ACCESS_TOKEN_SECRET || process.env.JWT_SECRET!;

    // 2. Verify Token
    const decoded = jwt.verify(token, secret) as JwtPayload;

    if (!decoded.id) {
      // Payload sai -> Báo lỗi 401
      throw new Error("Token missing 'id' field");
    }

    const user = await userService.getById(decoded.id);

    if (user) {
      (req as any).user = user as EnrichedUser;
      return next();
    } else {
      // Token đúng signature nhưng User không tồn tại trong DB -> Báo lỗi 401
      return next(new NotAuthorizedError("User not found"));
    }
  } catch (error) {
    // 3. BẮT LỖI HẾT HẠN (TokenExpiredError)
    // Thay vì cho qua làm Guest, phải trả về 401 để Frontend kích hoạt Refresh Token
    return next(new NotAuthorizedError("Token expired or invalid"));
  }
};