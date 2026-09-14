import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/server';
import { IPasskeyRepository } from '../interfaces/IPasskeyRepository';
import { IUserRepository } from '../interfaces/IUserRepository';
import { AuthService, SessionTokens } from './AuthService';
import { PasskeyCredential } from '../entities/PasskeyCredential';
import { User } from '../entities/User';
import { Organization } from '../entities/Organization';
import { BusinessException } from '../exceptions/BusinessException';
import { NotFoundException } from '../exceptions/NotFoundException';

export interface PasskeyServiceConfig {
  rpName: string;
  rpID: string;
  rpOrigin: string | string[];
}

export class PasskeyService {
  constructor(
    private readonly passkeyRepository: IPasskeyRepository,
    private readonly userRepository: IUserRepository,
    private readonly authService: AuthService,
    private readonly config: PasskeyServiceConfig
  ) {}

  async generateRegistrationOptions(user: User): Promise<PublicKeyCredentialCreationOptionsJSON> {
    const existing = await this.passkeyRepository.findByUserId(user.id);
    const excludeCredentials = existing.map((c) => ({
      id: c.id,
      transports: c.transports as any,
    }));

    const options = await generateRegistrationOptions({
      rpName: this.config.rpName,
      rpID: this.config.rpID,
      userName: user.email,
      userDisplayName: user.name || user.email,
      userID: new TextEncoder().encode(user.id),
      attestationType: 'none',
      excludeCredentials,
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    });

    return options;
  }

  async verifyRegistration(
    user: User,
    response: RegistrationResponseJSON,
    expectedChallenge: string,
    name?: string
  ): Promise<PasskeyCredential> {
    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response,
        expectedChallenge,
        expectedOrigin: this.config.rpOrigin,
        expectedRPID: this.config.rpID,
        requireUserVerification: false,
      });
    } catch (err: any) {
      throw new BusinessException(err.message || 'Passkey registration verification failed');
    }

    if (!verification.verified || !verification.registrationInfo) {
      throw new BusinessException('Passkey registration verification failed');
    }

    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
    const publicKeyBase64 = Buffer.from(credential.publicKey).toString('base64url');

    const passkeyCredential = new PasskeyCredential(
      credential.id,
      user.id,
      publicKeyBase64,
      credential.counter,
      credentialDeviceType,
      credentialBackedUp,
      (credential.transports as string[]) || null,
      name?.trim() || 'Passkey',
      new Date(),
      new Date()
    );

    await this.passkeyRepository.save(passkeyCredential);
    return passkeyCredential;
  }

  async generateAuthenticationOptions(email?: string): Promise<PublicKeyCredentialRequestOptionsJSON> {
    let allowCredentials: { id: string; transports?: any }[] | undefined = undefined;

    if (email) {
      const user = await this.userRepository.findByEmail(email.toLowerCase().trim());
      if (user) {
        const credentials = await this.passkeyRepository.findByUserId(user.id);
        if (credentials.length > 0) {
          allowCredentials = credentials.map((c) => ({
            id: c.id,
            transports: c.transports as any,
          }));
        }
      }
    }

    const options = await generateAuthenticationOptions({
      rpID: this.config.rpID,
      allowCredentials,
      userVerification: 'preferred',
    });

    return options;
  }

  async verifyAuthentication(
    response: AuthenticationResponseJSON,
    expectedChallenge: string,
    ip?: string
  ): Promise<{
    user: User;
    org: Organization;
    tokens: SessionTokens;
  }> {
    const credential = await this.passkeyRepository.findById(response.id);
    if (!credential) {
      throw new BusinessException('Passkey credential not recognized');
    }

    const user = await this.userRepository.findById(credential.userId);
    if (!user || !user.isActive) {
      throw new BusinessException('Account is inactive or disabled');
    }

    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge,
        expectedOrigin: this.config.rpOrigin,
        expectedRPID: this.config.rpID,
        credential: {
          id: credential.id,
          publicKey: new Uint8Array(Buffer.from(credential.publicKey, 'base64url')),
          counter: credential.counter,
          transports: (credential.transports as any) || undefined,
        },
        requireUserVerification: false,
      });
    } catch (err: any) {
      throw new BusinessException(err.message || 'Passkey authentication verification failed');
    }

    if (!verification.verified || !verification.authenticationInfo) {
      throw new BusinessException('Passkey authentication verification failed');
    }

    try {
      credential.recordUsage(
        verification.authenticationInfo.newCounter,
        verification.authenticationInfo.credentialBackedUp
      );
    } catch (err: any) {
      throw new BusinessException(err.message);
    }

    await this.passkeyRepository.updateCounter(
      credential.id,
      credential.counter,
      credential.lastUsedAt || new Date()
    );

    const org = await this.authService.ensureOrg(user);
    const tokens = await this.authService.issueSession(user.id, user, ip);

    return { user, org, tokens };
  }

  async listCredentials(userId: string): Promise<PasskeyCredential[]> {
    return this.passkeyRepository.findByUserId(userId);
  }

  async deleteCredential(id: string, userId: string): Promise<void> {
    const cred = await this.passkeyRepository.findById(id);
    if (!cred || cred.userId !== userId) {
      throw new NotFoundException('Passkey credential not found');
    }
    await this.passkeyRepository.delete(id, userId);
  }
}
