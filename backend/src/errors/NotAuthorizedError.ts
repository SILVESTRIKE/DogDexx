import { CustomError } from "./CustomError";

export class NotAuthorizedError extends CustomError {
    statusCode = 401; 
    message: string;
    constructor(message?: string) {
        super(message || "Not authorized");
        Object.setPrototypeOf(this, NotAuthorizedError.prototype);
        this.message = message || "Not authorized";
    }

    serializeErrors() {
        return [{ message: this.message }];
    }
}
