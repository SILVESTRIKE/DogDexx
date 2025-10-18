import { Request, Response, NextFunction, RequestHandler } from 'express';
import jwt from "jsonwebtoken";
import { userService } from "../services/user.service";
import { PlainUser } from "../services/user.service";
import { IncomingMessage } from 'http';
import { parse } from 'url';

interface JwtPayload {
  userId: string;
}

export const optionalAuthMiddleware: RequestHandler = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
      const user = await userService.getById(decoded.userId);

      if (user) {
        req.user = user as PlainUser;
      }
    } catch (error) {}
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
        // Gắn user vào request để controller có thể sử dụng
        (req as any).user = user;
        console.log(`[SocketAuth] User ${user.username} authenticated for WebSocket.`);
      } else {
        console.log(`[SocketAuth] Token valid, but user not found.`);
      }
    } catch (error) {
      console.log(`[SocketAuth] Invalid token for WebSocket: ${(error as Error).message}`);
    }
  } else {
    console.log('[SocketAuth] No token provided for WebSocket connection. Continuing as guest.');
  }

  // Luôn gọi callback để tiếp tục xử lý, dù có xác thực thành công hay không
  callback();
};