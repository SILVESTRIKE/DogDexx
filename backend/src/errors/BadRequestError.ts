import { ZodError } from "zod";
import { CustomError } from "./CustomError";

export class BadRequestError extends CustomError{
    statusCode = 400;
    message: string = "";
    zodError?: ZodError
    constructor(err?: string|ZodError) {
        super(err instanceof ZodError ? "Zod Error Bad Request" : err || "Bad request");
        if (err instanceof ZodError) {
            this.zodError = err;
            this.message = err.issues.reduce((acc: string, cur: { message: string })=>{
                return acc + `${cur.message} `;
            }, "");
        }
        else {
            this.message = err || "Bad request";
        }
        Object.setPrototypeOf(this, BadRequestError.prototype);
    }

    serializeErrors() {
        if (this.zodError) {
            return this.zodError.issues.map(issue => ({
                message: issue.message,
                field: issue.path.join('.')
            }));
        }
        return [{ message: this.message }];
    }
}