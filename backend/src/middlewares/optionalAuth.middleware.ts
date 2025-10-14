import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { userService } from "../services/user.service";
import { PlainUser } from "../services/user.service";

interface JwtPayload {
  userId: string;
}

export const optionalAuthMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
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
