import { AppError } from './AppError';

export class ValidationException extends AppError {
  constructor(message: string, public errors?: any) {
    super(message, 422);
  }
}
