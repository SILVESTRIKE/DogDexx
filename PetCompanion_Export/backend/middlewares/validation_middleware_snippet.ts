// --- SUGGESTED MIDDLEWARE (backend/src/middlewares/validation.middleware.ts) ---

import { Request, Response, NextFunction } from "express";
import { z, ZodError } from "zod";
import { BadRequestError } from "../errors";

export const validateData = (schema: z.ZodSchema) => {
    return (req: Request, res: Response, next: NextFunction) => {
        try {
            schema.parse(req.body);
            next();
        } catch (error) {
            if (error instanceof ZodError) {
                const errorMessages = error.errors.map((issue: any) => ({
                    message: `${issue.path.join('.')} is ${issue.message}`,
                }));
                // Assuming BadRequestError can take an array or message
                // Adjust based on your actual Error handling implementation
                next(new BadRequestError("Validation failed", errorMessages));
            } else {
                next(new BadRequestError("Invalid data"));
            }
        }
    };
};
