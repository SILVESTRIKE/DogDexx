import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { userService, EnrichedUser } from "../services/user.service";
import { NotAuthorizedError } from "../errors";
import { tokenConfig } from "../config/token.config";

interface JwtPayload {
  id: string;
  role: string;
}

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(new NotAuthorizedError("Token is not provided"));
  }

  const token = authHeader.split(" ")[1];
  try {
    const secret = tokenConfig.access.secret;

    const decoded = jwt.verify(token, secret) as JwtPayload;
    if (!decoded.id) {
      return next(new NotAuthorizedError("Invalid token payload"));
    }

    const user = await userService.getById(decoded.id);

    if (!user) {
      return next(new NotAuthorizedError("User not found"));
    }

    (req as any).user = user as EnrichedUser;

    next();
  } catch (error) {
    return next(new NotAuthorizedError("Token is invalid or expired"));
  }
};