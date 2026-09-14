import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PasskeyService } from './PasskeyService';
import { AuthService } from './AuthService';
import { InMemoryUserRepository } from '../../infrastructure/repositories/InMemoryUserRepository';
import { IPasskeyRepository } from '../interfaces/IPasskeyRepository';
import { PasskeyCredential } from '../entities/PasskeyCredential';
import { User } from '../entities/User';
import { Organization } from '../entities/Organization';
import { BusinessException } from '../exceptions/BusinessException';
import { NotFoundException } from '../exceptions/NotFoundException';
import {
  generateRegistrationOptions,
  generateAuthenticationOptions,
  verifyRegistrationResponse,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';

vi.mock('@simplewebauthn/server', async () => {
  const actual = await vi.importActual<typeof import('@simplewebauthn/server')>('@simplewebauthn/server');
  return {
    ...actual,
    verifyRegistrationResponse: vi.fn(),
    verifyAuthenticationResponse: vi.fn(),
  };
});

class MemPasskeyRepo implements IPasskeyRepository {
  credentials: PasskeyCredential[] = [];

  async findById(id: string): Promise<PasskeyCredential | null> {
    return this.credentials.find((c) => c.id === id) ?? null;
  }

  async findByUserId(userId: string): Promise<PasskeyCredential[]> {
    return this.credentials.filter((c) => c.userId === userId);
  }

  async save(credential: PasskeyCredential): Promise<void> {
    const idx = this.credentials.findIndex((c) => c.id === credential.id);
    if (idx >= 0) {
      this.credentials[idx] = credential;
    } else {
      this.credentials.push(credential);
    }
  }

  async updateCounter(id: string, counter: number, lastUsedAt: Date = new Date()): Promise<void> {
    const cred = await this.findById(id);
    if (cred) {
      cred.counter = counter;
      cred.lastUsedAt = lastUsedAt;
    }
  }

  async delete(id: string, userId: string): Promise<void> {
    this.credentials = this.credentials.filter((c) => !(c.id === id && c.userId === userId));
  }
}

describe('PasskeyService', () => {
  let userRepo: InMemoryUserRepository;
  let passkeyRepo: MemPasskeyRepo;
  let authService: AuthService;
  let passkeyService: PasskeyService;
  let testUser: User;
  let testOrg: Organization;

  beforeEach(async () => {
    userRepo = new InMemoryUserRepository();
    passkeyRepo = new MemPasskeyRepo();

    testOrg = new Organization('org-123', 'Acme Corp', 'acme-corp');
    testUser = new User('user-123', 'Alice', 'alice@example.com', 'hashed_pw', new Date(), true, 'user', 0, null, 'org-123');
    await userRepo.save(testUser);

    // Mock minimal AuthService
    authService = {
      ensureOrg: vi.fn().mockResolvedValue(testOrg),
      issueSession: vi.fn().mockResolvedValue({
        access: 'mock-access-jwt',
        refresh: 'mock-refresh-token',
      }),
    } as unknown as AuthService;

    passkeyService = new PasskeyService(
      passkeyRepo,
      userRepo,
      authService,
      {
        rpName: 'Test RP',
        rpID: 'localhost',
        rpOrigin: 'http://localhost:40001',
      }
    );
  });

  it('generates registration options with user details and credential exclusions', async () => {
    // Add existing credential
    const existingCred = new PasskeyCredential(
      'cred-existing',
      testUser.id,
      'pubkey-existing',
      1,
      'singleDevice',
      false,
      ['internal'],
      'Existing Key'
    );
    await passkeyRepo.save(existingCred);

    const options = await passkeyService.generateRegistrationOptions(testUser);

    expect(options.rp.name).toBe('Test RP');
    expect(options.rp.id).toBe('localhost');
    expect(options.user.name).toBe('alice@example.com');
    expect(options.challenge).toBeTruthy();
    expect(options.excludeCredentials?.some((c) => c.id === 'cred-existing')).toBe(true);
  });

  it('verifies registration response and persists the new credential', async () => {
    const rawPublicKey = new Uint8Array([1, 2, 3, 4, 5, 6]);

    vi.mocked(verifyRegistrationResponse).mockResolvedValueOnce({
      verified: true,
      registrationInfo: {
        fmt: 'none',
        aaguid: '00000000-0000-0000-0000-000000000000',
        credential: {
          id: 'new-cred-id',
          publicKey: rawPublicKey,
          counter: 0,
          transports: ['internal'],
        },
        credentialType: 'public-key',
        attestationObject: new Uint8Array(),
        userVerified: true,
        credentialDeviceType: 'singleDevice',
        credentialBackedUp: false,
        origin: 'http://localhost:40001',
      },
    });

    const mockResponse: any = {
      id: 'new-cred-id',
      rawId: 'new-cred-id',
      response: {
        clientDataJSON: 'mock-client-data',
        attestationObject: 'mock-attestation',
      },
      type: 'public-key',
      clientExtensionResults: {},
    };

    const credential = await passkeyService.verifyRegistration(
      testUser,
      mockResponse,
      'expected-challenge-123',
      'MacBook Touch ID'
    );

    expect(credential.id).toBe('new-cred-id');
    expect(credential.userId).toBe(testUser.id);
    expect(credential.name).toBe('MacBook Touch ID');
    expect(credential.publicKey).toBe(Buffer.from(rawPublicKey).toString('base64url'));

    const saved = await passkeyRepo.findById('new-cred-id');
    expect(saved).toBeTruthy();
    expect(saved?.name).toBe('MacBook Touch ID');
  });

  it('generates authentication options allowing discoverable credentials', async () => {
    const options = await passkeyService.generateAuthenticationOptions();

    expect(options.rpId).toBe('localhost');
    expect(options.challenge).toBeTruthy();
    expect(options.userVerification).toBe('preferred');
  });

  it('verifies authentication response, increments counter, and issues session tokens', async () => {
    const rawPublicKey = new Uint8Array([9, 8, 7, 6]);
    const pubKeyBase64 = Buffer.from(rawPublicKey).toString('base64url');

    const cred = new PasskeyCredential(
      'auth-cred-id',
      testUser.id,
      pubKeyBase64,
      10,
      'singleDevice',
      false,
      ['internal'],
      'YubiKey'
    );
    await passkeyRepo.save(cred);

    vi.mocked(verifyAuthenticationResponse).mockResolvedValueOnce({
      verified: true,
      authenticationInfo: {
        credentialID: 'auth-cred-id',
        newCounter: 11,
        userVerified: true,
        credentialDeviceType: 'singleDevice',
        credentialBackedUp: false,
        origin: 'http://localhost:40001',
        rpID: 'localhost',
      },
    });

    const mockResponse: any = {
      id: 'auth-cred-id',
      rawId: 'auth-cred-id',
      response: {
        clientDataJSON: 'mock-client-data',
        authenticatorData: 'mock-auth-data',
        signature: 'mock-sig',
      },
      type: 'public-key',
      clientExtensionResults: {},
    };

    const result = await passkeyService.verifyAuthentication(
      mockResponse,
      'challenge-nonce',
      '127.0.0.1'
    );

    expect(result.user.id).toBe(testUser.id);
    expect(result.tokens.access).toBe('mock-access-jwt');
    expect(result.tokens.refresh).toBe('mock-refresh-token');

    const updated = await passkeyRepo.findById('auth-cred-id');
    expect(updated?.counter).toBe(11);
    expect(updated?.lastUsedAt).toBeTruthy();
  });

  it('rejects authentication with replay attack if counter does not increment', async () => {
    const rawPublicKey = new Uint8Array([1, 2, 3]);
    const pubKeyBase64 = Buffer.from(rawPublicKey).toString('base64url');

    const cred = new PasskeyCredential(
      'replay-cred-id',
      testUser.id,
      pubKeyBase64,
      50,
      'singleDevice',
      false,
      ['internal'],
      'Device'
    );
    await passkeyRepo.save(cred);

    // Return stale counter <= existing counter
    vi.mocked(verifyAuthenticationResponse).mockResolvedValueOnce({
      verified: true,
      authenticationInfo: {
        credentialID: 'replay-cred-id',
        newCounter: 49,
        userVerified: true,
        credentialDeviceType: 'singleDevice',
        credentialBackedUp: false,
        origin: 'http://localhost:40001',
        rpID: 'localhost',
      },
    });

    const mockResponse: any = {
      id: 'replay-cred-id',
      rawId: 'replay-cred-id',
      response: {
        clientDataJSON: 'mock-client-data',
        authenticatorData: 'mock-auth-data',
        signature: 'mock-sig',
      },
      type: 'public-key',
    };

    await expect(
      passkeyService.verifyAuthentication(mockResponse, 'challenge-nonce')
    ).rejects.toThrow(BusinessException);
  });

  it('rejects authentication for unknown credential ID', async () => {
    const mockResponse: any = {
      id: 'unknown-cred-id',
      rawId: 'unknown-cred-id',
      response: { clientDataJSON: '...', authenticatorData: '...', signature: '...' },
      type: 'public-key',
    };

    await expect(
      passkeyService.verifyAuthentication(mockResponse, 'challenge-nonce')
    ).rejects.toThrow(BusinessException);
  });

  it('lists user credentials and enforces ownership on deletion', async () => {
    const cred1 = new PasskeyCredential('cred-1', testUser.id, 'key1', 0, 'singleDevice', false, null, 'Key 1');
    const cred2 = new PasskeyCredential('cred-2', 'other-user', 'key2', 0, 'singleDevice', false, null, 'Key 2');
    await passkeyRepo.save(cred1);
    await passkeyRepo.save(cred2);

    const list = await passkeyService.listCredentials(testUser.id);
    expect(list.length).toBe(1);
    expect(list[0]?.id).toBe('cred-1');

    // Trying to delete other user's credential throws NotFoundException
    await expect(passkeyService.deleteCredential('cred-2', testUser.id)).rejects.toThrow(NotFoundException);

    // Deleting own credential succeeds
    await passkeyService.deleteCredential('cred-1', testUser.id);
    const updatedList = await passkeyService.listCredentials(testUser.id);
    expect(updatedList.length).toBe(0);
  });
});
