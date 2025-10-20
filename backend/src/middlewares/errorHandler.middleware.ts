import { Request, Response, NextFunction } from "express";
import { CustomError } from "../errors/CustomError";
import { logger } from "../utils/logger.util";

export const errorHandlerMiddleware = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  logger.error(err); // Sử dụng logger để ghi lại lỗi với đầy đủ stack trace
  if (err instanceof CustomError) {
    return res.status(err.statusCode).send({
      success: false,
      errors: err.serializeErrors(),
    });
  }

  res.status(500).send({
    success: false,
    errors: [{ message: "Something went wrong" }],
  });
};
