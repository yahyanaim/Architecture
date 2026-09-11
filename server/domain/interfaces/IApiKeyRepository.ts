import { ApiKey } from '../entities/ApiKey';

export interface IApiKeyRepository {
  findById(id: string, orgId: string): Promise<ApiKey | null>;
  findByHash(keyHash: string): Promise<ApiKey | null>;
  findAllByOrg(orgId: string): Promise<ApiKey[]>;
  save(apiKey: ApiKey): Promise<void>;
  updateLastUsed(id: string, orgId: string): Promise<void>;
  delete(id: string, orgId: string): Promise<void>;
}
