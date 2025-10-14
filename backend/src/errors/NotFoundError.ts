import { CustomError } from "./CustomError";

export class NotFoundError extends CustomError {
  statusCode = 404; // 404
  source?: string;
  message: string;

  constructor(message: string = "Not found.", source?: string) {
    super(message);
    this.source = source;
    this.message = message;
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
  serializeErrors() {
    return [{ message: this.message, source: this.source }];
  }
}