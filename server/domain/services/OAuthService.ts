import { IUserRepository } from '../interfaces/IUserRepository';
import { IOrganizationRepository, ISubscriptionRepository } from '../interfaces/ITenant';
import { IMembershipRepository } from '../interfaces/IMembershipRepository';
import { IOAuthAccountRepository } from '../interfaces/IOAuthAccountRepository';
import { ITwoFactorRepository } from '../interfaces/ITwoFactorRepository';
import { ITokenService } from '../interfaces/ITokenService';
import { AuthService, SessionTokens } from './AuthService';
import { IOAuthProviderClient, OAuthProfile } from '../../infrastructure/oauth/OAuthProviderClient';
import { User, UserRole } from '../entities/User';
import { Organization } from '../entities/Organization';
import { Subscription } from '../entities/Subscription';
import { Membership } from '../entities/Membership';
import { OAuthAccount } from '../entities/OAuthAccount';
import { BusinessException } from '../exceptions/BusinessException';
import { audit } from '../../infrastructure/audit';

export type OAuthAuthResult =
  | { mfaRequired: true; mfaToken: string }
  | { mfaRequired?: false; user: User; org: Organization; tokens: SessionTokens; isNewUser?: boolean };

export class OAuthService {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly orgRepository: IOrganizationRepository,
    private readonly subscriptionRepository: ISubscriptionRepository,
    private readonly membershipRepository: IMembershipRepository,
    private readonly oauthAccountRepository: IOAuthAccountRepository,
    private readonly authService: AuthService,
    private readonly oauthProviderClient: IOAuthProviderClient,
    private readonly twoFactorRepository?: ITwoFactorRepository,
    private readonly tokenService?: ITokenService,
    private readonly config: {
      appUrl: string;
      googleClientId?: string;
      githubClientId?: string;
    } = { appUrl: 'http://localhost:40001' }
  ) {}

  private get activeTokenService(): ITokenService {
    const ts = this.tokenService ?? this.authService.tokenService;
    if (!ts) {
      throw new Error('ITokenService not configured in OAuthService');
    }
    return ts;
  }

  /**
   * Check if real provider OAuth credentials are configured.
   */
  hasRealCredentials(provider: 'google' | 'github'): boolean {
    if (process.env.NODE_ENV === 'test') return true;
    if (provider === 'google') {
      return Boolean(this.config.googleClientId && this.config.googleClientId !== 'google-client-id-mock');
    }
    if (provider === 'github') {
      return Boolean(this.config.githubClientId && this.config.githubClientId !== 'github-client-id-mock');
    }
    return false;
  }

  /**
   * Generates the OAuth authorization URL for the chosen provider.
   */
  getAuthorizationUrl(provider: 'google' | 'github', state: string): string {
    const prov = provider.toLowerCase();
    const callbackUrl = `${this.config.appUrl}/api/auth/oauth/${prov}/callback`;

    if (prov === 'google') {
      const clientId = this.config.googleClientId || 'google-client-id-mock';
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: callbackUrl,
        response_type: 'code',
        scope: 'openid email profile',
        state,
        access_type: 'offline',
        prompt: 'select_account',
      });
      return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    }

    if (prov === 'github') {
      const clientId = this.config.githubClientId || 'github-client-id-mock';
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: callbackUrl,
        scope: 'read:user user:email',
        state,
      });
      return `https://github.com/login/oauth/authorize?${params.toString()}`;
    }

    throw new BusinessException(`Unsupported OAuth provider: ${provider}`);
  }

  /**
   * Exchanges authorization code with the provider and processes the resulting identity profile.
   */
  async handleCallback(
    provider: 'google' | 'github',
    code: string,
    ip?: string
  ): Promise<OAuthAuthResult> {
    const callbackUrl = `${this.config.appUrl}/api/auth/oauth/${provider.toLowerCase()}/callback`;
    const profile = await this.oauthProviderClient.exchangeCode(provider, code, callbackUrl);
    return this.authenticateWithProfile(profile, ip);
  }

  /**
   * Core identity resolution:
   * 1. Check verified email
   * 2. If provider link exists -> authenticate user
   * 3. Else if email matches existing user -> link provider to account
   * 4. Else -> bootstrap brand new user + personal organization
   * 5. Enforce 2FA challenge if active on the user
   */
  async authenticateWithProfile(profile: OAuthProfile, ip?: string): Promise<OAuthAuthResult> {
    if (!profile.emailVerified) {
      throw new BusinessException('OAuth email address is not verified by provider');
    }

    const provider = profile.provider.toLowerCase();
    const providerSub = profile.providerSub;
    const email = profile.email.toLowerCase().trim();

    // 1. Existing OAuth Account link
    const existingLink = await this.oauthAccountRepository.findByProviderAndSub(provider, providerSub);
    if (existingLink) {
      const user = await this.userRepository.findById(existingLink.userId);
      if (!user || !user.isActive) {
        throw new BusinessException('Account is disabled or not found');
      }

      // Check 2FA MFA challenge
      if (this.twoFactorRepository) {
        const twoFactor = await this.twoFactorRepository.findByUserId(user.id);
        if (twoFactor && twoFactor.isEnabled) {
          const mfaToken = this.activeTokenService.signAccessToken({
            userId: user.id,
            email: user.email,
            role: user.role,
            orgId: user.orgId,
            purpose: 'mfa',
          });
          return { mfaRequired: true, mfaToken };
        }
      }

      existingLink.updatedAt = new Date();
      await this.oauthAccountRepository.save(existingLink);

      const org = await this.authService.ensureOrg(user);
      const tokens = await this.authService.issueSession(user.id, user, ip);

      audit('oauth.login', user.id, {
        provider,
        providerSub,
        orgId: org.id,
      });

      return { user, org, tokens, isNewUser: false };
    }

    // 2. Existing User Match by Email (Account Linking)
    const existingUser = await this.userRepository.findByEmail(email);
    if (existingUser) {
      if (!existingUser.isActive) {
        throw new BusinessException('Account is disabled or not found');
      }

      // Link provider to this existing user
      const newLink = OAuthAccount.create(
        existingUser.id,
        provider,
        providerSub,
        existingUser.orgId
      );
      await this.oauthAccountRepository.save(newLink);

      // Check 2FA
      if (this.twoFactorRepository) {
        const twoFactor = await this.twoFactorRepository.findByUserId(existingUser.id);
        if (twoFactor && twoFactor.isEnabled) {
          const mfaToken = this.activeTokenService.signAccessToken({
            userId: existingUser.id,
            email: existingUser.email,
            role: existingUser.role,
            orgId: existingUser.orgId,
            purpose: 'mfa',
          });
          return { mfaRequired: true, mfaToken };
        }
      }

      const org = await this.authService.ensureOrg(existingUser);
      const tokens = await this.authService.issueSession(existingUser.id, existingUser, ip);

      audit('oauth.linked', existingUser.id, {
        provider,
        providerSub,
        orgId: org.id,
      });

      return { user: existingUser, org, tokens, isNewUser: false };
    }

    // 3. New User Bootstrap (First-User-Admin Rule)
    const hasUsers = await this.userRepository.hasUsers();
    const role: UserRole = !hasUsers ? 'admin' : 'user';

    const cleanName = profile.name?.trim() || email.split('@')[0] || 'User';
    const org = new Organization(
      globalThis.crypto.randomUUID(),
      `${cleanName}'s workspace`,
      this.activeTokenService.slugify(cleanName)
    );
    await this.orgRepository.save(org);
    await this.subscriptionRepository.save(new Subscription(org.id, 'free', 'trialing'));

    // Unusable random password hash since authentication is federated
    const randomPassword = globalThis.crypto.randomUUID() + globalThis.crypto.randomUUID();
    const newUser = await User.create(cleanName, email, randomPassword, role);
    newUser.orgId = org.id;
    newUser.markVerified(); // Provider already verified the email
    await this.userRepository.save(newUser);

    await this.membershipRepository.save(Membership.create(newUser.id, org.id, role));

    const newLink = OAuthAccount.create(newUser.id, provider, providerSub, org.id);
    await this.oauthAccountRepository.save(newLink);

    audit('oauth.registered', newUser.id, {
      provider,
      providerSub,
      role,
      orgId: org.id,
    });

    const tokens = await this.authService.issueSession(newUser.id, newUser, ip);
    return { user: newUser, org, tokens, isNewUser: true };
  }
}
