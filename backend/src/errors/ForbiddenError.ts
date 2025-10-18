import { CustomError } from './CustomError'; 

export class ForbiddenError extends CustomError {
    statusCode = 403; 
    message: string;
    source?: string;

    constructor(message: string = 'Forbidden.') {
        super(message);
        Object.setPrototypeOf(this, ForbiddenError.prototype);
        this.message = message;
    }
    serializeErrors() {
        return [{ message: this.message, source: this.source}];
    }
}