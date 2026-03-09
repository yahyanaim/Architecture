import { AppError } from './AppError';

export class BusinessException extends AppError {
  constructor(message: string) {
    super(message, 400);
  }
}
