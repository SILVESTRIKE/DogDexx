import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { userService } from "../services/user.service";
import { PlainUser } from "../services/user.service";
import { NotAuthorizedError } from "../errors";

interface JwtPayload {
  userId: string;
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
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;

    const user = await userService.getById(decoded.userId);

    if (!user) {
      return next(new NotAuthorizedError("User not found"));
    }

    req.user = user as PlainUser;

    next();
  } catch (error) {
    return next(new NotAuthorizedError("Token is invalid or expired"));
  }
};
