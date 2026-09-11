import { TwoFactorAuth } from '../entities/TwoFactorAuth';

export interface ITwoFactorRepository {
  findByUserId(userId: string): Promise<TwoFactorAuth | null>;
  save(twoFactor: TwoFactorAuth): Promise<void>;
  delete(userId: string): Promise<void>;
}
