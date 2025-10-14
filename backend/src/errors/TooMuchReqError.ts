import { CustomError } from "./CustomError";

export class TooMuchReqError extends CustomError {
  statusCode = 429;
  message: string;
  constructor(message?: string) {
    super(message || "Too many requests");
    Object.setPrototypeOf(this, TooMuchReqError.prototype);
    this.message = message || "Too many requests";
  }

  serializeErrors() {
    return [{ message: this.message }];
  }
}
