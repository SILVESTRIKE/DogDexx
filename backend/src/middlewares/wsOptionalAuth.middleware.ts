import { Request } from 'express';
import { NextFunction } from 'express-serve-static-core';
import WebSocket from 'ws';
import jwt from 'jsonwebtoken';
import { userService } from '../services/user.service';
import { logger } from '../utils/logger.util';
import { tokenConfig } from '../config/token.config';

interface JwtPayload {
  id: string;
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
      const secret = tokenConfig.access.secret;
      const decoded = jwt.verify(token, secret) as JwtPayload;
      if (decoded.id) {
        const user = await userService.getById(decoded.id);

        if (user) {
          (req as any).user = user;
          logger.info(`[WS-Auth] Authenticated user ${user.username} (ID: ${user._id})`);
        }
      } else {
        logger.warn(`[WS-Auth] Token missing 'id' payload.`);
      }
    } catch (error) {
      logger.warn(`[WS-Auth] Token verification failed: ${(error as Error).message}`);
    }
  }

  if (visitorId && !(req as any).user) {
    (req as any).fingerprint = {
      ...(req as any).fingerprint,
      hash: visitorId,
    };
    logger.info(`[WS-Auth] Identified guest: ${visitorId}`);
  }

  next();
};