import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { validateLoginPassword } from '../lib/password';
import { apiErrorMessage } from '@/lib/errors';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { passkeyApi } from '../api/passkeyApi';
import { GoogleIcon, GitHubIcon, PasskeyIcon } from '../components/AuthIcons';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const { login, setUser } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isPasskeyLoading, setIsPasskeyLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const justVerified = searchParams.get('verified') === '1';
  const oauthError = searchParams.get('error');

  useEffect(() => {
    if (oauthError) {
      toast.error(oauthError);
    }
  }, [oauthError]);

  const validate = () => {
    const newErrors: { email?: string; password?: string } = {};

    if (!email) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Invalid email format';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else {
      // No strength rules at login (backend accepts min 1) — they apply at
      // set-time only. See validateLoginPassword.
      const pwError = validateLoginPassword(password);
      if (pwError) newErrors.password = pwError;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    try {
      await login(email, password);
      toast.success('Login successful!');
      navigate('/', { replace: true });
    } catch (error: unknown) {
      toast.error(apiErrorMessage(error, 'Login failed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasskeyLogin = async () => {
    setIsPasskeyLoading(true);
    try {
      const authUser = await passkeyApi.loginWithPasskey(email.trim() || undefined);
      setUser(authUser);
      toast.success('Signed in with Passkey!');
      navigate('/', { replace: true });
    } catch (error: any) {
      if (error?.name === 'NotAllowedError') {
        return;
      }
      toast.error(apiErrorMessage(error, 'Passkey login failed'));
    } finally {
      setIsPasskeyLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-black">Welcome Back</h1>
          <p className="text-gray-500 mt-2">Sign in to your account</p>
          {justVerified && (
            <p className="text-green-700 bg-green-50 border border-green-200 rounded-lg text-sm mt-4 px-3 py-2">
              Email verified — sign in to continue.
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-black focus:border-black outline-none transition-colors ${errors.email ? 'border-red-500' : 'border-gray-300'}`}
              placeholder="you@example.com"
            />
            {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <Link to="/forgot-password" className="text-xs text-gray-500 hover:text-black">
                Forgot password?
              </Link>
            </div>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-black focus:border-black outline-none transition-colors ${errors.password ? 'border-red-500' : 'border-gray-300'}`}
              placeholder="••••••••"
            />
            {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password}</p>}
          </div>

          <button
            type="submit"
            disabled={isLoading || isPasskeyLoading}
            className="w-full bg-black text-white py-2.5 rounded-lg font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            Sign In
          </button>
        </form>

        <button
          type="button"
          onClick={handlePasskeyLogin}
          disabled={isPasskeyLoading || isLoading}
          aria-label="Continue with Passkey"
          className="w-full mt-3 bg-white border border-gray-300 text-gray-800 py-2.5 rounded-lg font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
        >
          {isPasskeyLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <PasskeyIcon size={18} className="text-gray-700" />
          )}
          Continue with Passkey
        </button>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2 text-gray-500">Or continue with</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <a
            href="/api/v1/auth/oauth/google/url?redirect=true"
            aria-label="Sign in with Google"
            className="flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
          >
            <GoogleIcon size={18} />
            <span>Google</span>
          </a>
          <a
            href="/api/v1/auth/oauth/github/url?redirect=true"
            aria-label="Sign in with GitHub"
            className="flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
          >
            <GitHubIcon size={18} />
            <span>GitHub</span>
          </a>
        </div>

        <p className="text-center mt-6 text-gray-600">
          Don&apos;t have an account?{' '}
          <Link to="/register" className="text-black font-medium hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
