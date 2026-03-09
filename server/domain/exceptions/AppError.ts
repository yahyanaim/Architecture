export class AppError extends Error {
  constructor(public message: string, public statusCode: number, public isOperational = true) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this);
  }
}
