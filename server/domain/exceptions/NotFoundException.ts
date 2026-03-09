import { AppError } from './AppError';

export class NotFoundException extends AppError {
  constructor(message: string) {
    super(message, 404);
  }
}
