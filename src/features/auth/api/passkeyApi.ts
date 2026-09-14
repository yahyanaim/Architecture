import { apiClient } from '@/lib/axios';
import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
} from '@simplewebauthn/browser';

export interface PasskeyCredentialDTO {
  id: string;
  name: string;
  deviceType: string;
  backedUp: boolean;
  createdAt: string;
  lastUsedAt: string | null;
}

export const passkeyApi = {
  isSupported(): boolean {
    return browserSupportsWebAuthn();
  },

  async isPlatformAuthenticatorAvailable(): Promise<boolean> {
    try {
      return await platformAuthenticatorIsAvailable();
    } catch {
      return false;
    }
  },

  async getRegistrationOptions() {
    const { data } = await apiClient.post('/auth/passkey/register/options');
    return data;
  },

  async verifyRegistration(response: any, name?: string): Promise<{ verified: boolean; credential: PasskeyCredentialDTO }> {
    const { data } = await apiClient.post('/auth/passkey/register/verify', { response, name });
    return data;
  },

  async getAuthenticationOptions(email?: string) {
    const { data } = await apiClient.post('/auth/passkey/login/options', null, {
      params: email ? { email } : undefined,
    });
    return data;
  },

  async verifyAuthentication(response: any) {
    const { data } = await apiClient.post('/auth/passkey/login/verify', { response });
    return data;
  },

  async listCredentials(): Promise<PasskeyCredentialDTO[]> {
    const { data } = await apiClient.get('/auth/passkey/credentials');
    return data;
  },

  async deleteCredential(id: string): Promise<void> {
    await apiClient.delete(`/auth/passkey/credentials/${id}`);
  },

  async registerPasskey(name?: string): Promise<PasskeyCredentialDTO> {
    if (!browserSupportsWebAuthn()) {
      throw new Error('WebAuthn is not supported by your browser.');
    }
    const options = await this.getRegistrationOptions();
    const attestationResponse = await startRegistration({ optionsJSON: options });
    const result = await this.verifyRegistration(attestationResponse, name);
    return result.credential;
  },

  async loginWithPasskey(email?: string) {
    if (!browserSupportsWebAuthn()) {
      throw new Error('WebAuthn is not supported by your browser.');
    }
    const options = await this.getAuthenticationOptions(email);
    const assertionResponse = await startAuthentication({ optionsJSON: options });
    const user = await this.verifyAuthentication(assertionResponse);
    return user;
  },
};
