import { Request, Response, NextFunction } from "express";
import { NotAuthorizedError, BadRequestError } from "../errors";

export const checkAllowedRoles = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Middleware này chỉ hoạt động nếu user đã được xác thực (req.user tồn tại)
    // Nếu không có user (ví dụ: guest đi qua optionalAuth), bỏ qua kiểm tra vai trò.
    if (!req.user) {
      return next();
    }

    // Nếu user tồn tại, kiểm tra xem vai trò của họ có trong danh sách được phép không.
    if (!req.user.role || !roles.includes(req.user.role)) {
      return next(new NotAuthorizedError(`Bạn không có quyền truy cập tài nguyên này.`));
    }
    
    next();
  };
};
