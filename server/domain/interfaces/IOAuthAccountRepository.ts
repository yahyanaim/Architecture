import { OAuthAccount } from '../entities/OAuthAccount';

export interface IOAuthAccountRepository {
  findByProviderAndSub(provider: string, providerSub: string): Promise<OAuthAccount | null>;
  findByUserId(userId: string): Promise<OAuthAccount[]>;
  save(account: OAuthAccount): Promise<void>;
  delete(id: string): Promise<void>;
}
