import { Request, Response, NextFunction } from "express";
import { NotAuthorizedError, BadRequestError } from "../errors";

export const checkAllowedRoles = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next();
    }

    if (!req.user.role || !roles.includes(req.user.role)) {
      return next(new NotAuthorizedError(`Bạn không có quyền truy cập tài nguyên này.`));
    }

    next();
  };
};
