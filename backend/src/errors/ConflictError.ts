import { CustomError } from './CustomError'; 

export class ConflictError extends CustomError {
    statusCode = 409; 
    message: string;
    source?: string;

    constructor(message: string = 'Not found.') {
        super(message);
        Object.setPrototypeOf(this, ConflictError.prototype);
        this.message = message;
    }
    serializeErrors() {
        return [{ message: this.message, source: this.source}];
    }
}