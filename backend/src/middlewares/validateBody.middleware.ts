import { Request, Response, NextFunction } from "express";
import { ZodError, ZodObject } from "zod";
import { ValidationError } from "../errors/ValidationError";

export const validateData = (
  schema: ZodObject<any, any>,
  type: "body" | "query" | "params",
  path?: string
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const dataToValidate = path ? req[type][path] : req[type];
      schema.parse(dataToValidate);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(new ValidationError(error.issues));
      }
      next(error);
    }
  };
};
