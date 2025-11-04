import { CustomError } from './CustomError';

export class PaymentRequiredError extends CustomError {
  statusCode = 402;

  constructor(public message: string) {
    super(message);
    Object.setPrototypeOf(this, PaymentRequiredError.prototype);
  }

  serializeErrors() {
    return [{ message: this.message }];
  }
}
