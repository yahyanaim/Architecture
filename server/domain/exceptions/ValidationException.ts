import { AppError } from './AppError';

export class ValidationException extends AppError {
  constructor(message: string, public errors?: Record<string, unknown>) {
    super(message, 422);
  }
}
