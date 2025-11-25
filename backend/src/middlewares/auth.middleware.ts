import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { userService, EnrichedUser } from "../services/user.service";
import { NotAuthorizedError } from "../errors";
import { tokenConfig } from "../config/token.config"; // Thêm import này

// SỬA 1: Đổi userId thành id để khớp với hàm generateTokens
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
    // SỬA 2: Dùng secret từ config để đồng bộ với lúc tạo token
    const secret = tokenConfig.access.secret;
    
    const decoded = jwt.verify(token, secret) as JwtPayload;

    // SỬA 3: Dùng decoded.id thay vì decoded.userId
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