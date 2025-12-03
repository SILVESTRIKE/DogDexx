import { Request, Response, NextFunction } from "express";
import { CustomError } from "../errors/CustomError";
import { logger } from "../utils/logger.util";

export const errorHandlerMiddleware = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (err instanceof CustomError) {
    logger.warn(`[${err.statusCode}] ${err.message}`);
    return res.status(err.statusCode).send({
      success: false,
      errors: err.serializeErrors(),
    });
  }

  logger.error(err);
  const isProd = process.env.NODE_ENV === 'production';
  const defaultMessage = 'Something went wrong';
  const errorMessage = isProd ? defaultMessage : (err as any)?.message || defaultMessage;
  const payload: any = {
    success: false,
    errors: [
      { message: errorMessage }
    ],
  };
  if (!isProd) {
    (payload.errors[0] as any).stack = (err as any)?.stack;
  }

  res.status(500).send(payload);
};
