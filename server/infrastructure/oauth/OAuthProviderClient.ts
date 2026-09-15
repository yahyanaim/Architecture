export interface OAuthProfile {
  provider: 'google' | 'github' | string;
  providerSub: string;
  email: string;
  name: string;
  emailVerified: boolean;
}

export interface IOAuthProviderClient {
  exchangeCode(provider: string, code: string, redirectUri: string): Promise<OAuthProfile>;
}

export class DefaultOAuthProviderClient implements IOAuthProviderClient {
  constructor(
    private readonly googleClientId: string,
    private readonly googleClientSecret: string,
    private readonly githubClientId: string,
    private readonly githubClientSecret: string
  ) {}

  async exchangeCode(provider: string, code: string, redirectUri: string): Promise<OAuthProfile> {
    const prov = provider.toLowerCase();

    // Automated test mock exchange (unit/integration tests only)
    if (process.env.NODE_ENV === 'test' && (code.startsWith('dev_mock_') || code.startsWith('mock_'))) {
      if (prov === 'google') {
        return {
          provider: 'google',
          providerSub: 'google-test-user-001',
          email: 'google.test@example.com',
          name: 'Google Test User',
          emailVerified: true,
        };
      }
      if (prov === 'github') {
        return {
          provider: 'github',
          providerSub: 'github-test-user-002',
          email: 'github.test@example.com',
          name: 'GitHub Test User',
          emailVerified: true,
        };
      }
    }

    if (prov === 'google') {
      return this.exchangeGoogle(code, redirectUri);
    } else if (prov === 'github') {
      return this.exchangeGitHub(code, redirectUri);
    }
    throw new Error(`Unsupported OAuth provider: ${provider}`);
  }

  private async exchangeGoogle(code: string, redirectUri: string): Promise<OAuthProfile> {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: this.googleClientId,
        client_secret: this.googleClientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      throw new Error(`Google token exchange failed: ${err}`);
    }

    const tokenData = await tokenRes.json() as { access_token?: string; id_token?: string };
    if (!tokenData.access_token) {
      throw new Error('No access_token returned by Google');
    }

    const userRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userRes.ok) {
      throw new Error('Failed to fetch Google userinfo');
    }

    const userData = await userRes.json() as {
      sub: string;
      email: string;
      name?: string;
      email_verified?: boolean;
    };

    return {
      provider: 'google',
      providerSub: userData.sub,
      email: userData.email,
      name: userData.name || (userData.email ? userData.email.split('@')[0] : 'User') || 'User',
      emailVerified: Boolean(userData.email_verified),
    };
  }

  private async exchangeGitHub(code: string, redirectUri: string): Promise<OAuthProfile> {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: this.githubClientId,
        client_secret: this.githubClientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      throw new Error(`GitHub token exchange failed: ${err}`);
    }

    const tokenData = await tokenRes.json() as { access_token?: string };
    if (!tokenData.access_token) {
      throw new Error('No access_token returned by GitHub');
    }

    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        'User-Agent': 'CleanArchitecture-SaaS',
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!userRes.ok) {
      throw new Error('Failed to fetch GitHub user');
    }

    const userData = await userRes.json() as { id: number | string; name?: string; login: string; email?: string };

    let email = userData.email;
    let emailVerified = false;

    if (!email) {
      const emailRes = await fetch('https://api.github.com/user/emails', {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          'User-Agent': 'CleanArchitecture-SaaS',
          Accept: 'application/vnd.github.v3+json',
        },
      });

      if (emailRes.ok) {
        const emails = await emailRes.json() as Array<{ email: string; primary: boolean; verified: boolean }>;
        const primary = emails.find((e) => e.primary && e.verified) || emails.find((e) => e.verified) || emails[0];
        if (primary) {
          email = primary.email;
          emailVerified = primary.verified;
        }
      }
    } else {
      emailVerified = true;
    }

    if (!email) {
      throw new Error('No verified email found on GitHub account');
    }

    return {
      provider: 'github',
      providerSub: String(userData.id),
      email,
      name: userData.name || userData.login,
      emailVerified,
    };
  }
}
