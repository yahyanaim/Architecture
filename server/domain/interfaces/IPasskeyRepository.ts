import { PasskeyCredential } from '../entities/PasskeyCredential';

export interface IPasskeyRepository {
  findById(id: string): Promise<PasskeyCredential | null>;
  findByUserId(userId: string): Promise<PasskeyCredential[]>;
  save(credential: PasskeyCredential): Promise<void>;
  updateCounter(id: string, counter: number, lastUsedAt?: Date): Promise<void>;
  delete(id: string, userId: string): Promise<void>;
}
