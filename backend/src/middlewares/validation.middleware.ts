import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";

/**
 * Universal validation middleware.
 * 
 * @param schema - The Zod schema to validate against.
 * @param target - Optional. The part of the request to validate ("body", "query", "params").
 *                 If provided, validates `req[target]`.
 *                 If NOT provided, validates the entire request object `{ body, query, params }`.
 */
export const validate = (schema: ZodSchema, target?: "body" | "query" | "params") => {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            if (target) {
                await schema.parseAsync(req[target]);
            } else {
                await schema.parseAsync({
                    body: req.body,
                    query: req.query,
                    params: req.params,
                });
            }
            next();
        } catch (error) {
            if (error instanceof ZodError) {
                return res.status(400).json({
                    message: "Validation Error",
                    errors: error.issues.map(issue => ({
                        path: issue.path.join("."),
                        message: issue.message
                    }))
                });
            }
            next(error);
        }
    };
};
