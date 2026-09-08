import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { validatePassword } from '../lib/password';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { apiErrorMessage } from '@/lib/errors';

// Deep link from invite emails: /invite?token=… (public — the token IS the
// credential; single-use, 7d expiry, enforced server-side).
export function InvitePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { acceptInvite } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    const pwError = validatePassword(password);
    if (pwError) {
      toast.error(pwError);
      return;
    }
    setIsLoading(true);
    try {
      await acceptInvite(token, password, confirmPassword, name.trim() ? name.trim() : undefined);
      toast.success('Welcome aboard!');
      navigate('/', { replace: true });
    } catch (error: unknown) {
      toast.error(apiErrorMessage(error, 'Could not accept invite'));
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 w-full max-w-md text-center">
          <h1 className="text-xl font-bold text-black">Invalid invite link</h1>
          <p className="text-gray-500 mt-2 text-sm">This link is missing its token. Check your email for the full URL.</p>
          <Link to="/login" className="text-black font-medium hover:underline text-sm mt-4 inline-block">
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-black">Accept your invite</h1>
          <p className="text-gray-500 mt-2">Set your name and password to join the workspace</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="invite-name" className="block text-sm font-medium text-gray-700 mb-1">
              Full Name <span className="text-gray-400">(optional)</span>
            </label>
            <input
              id="invite-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black outline-none transition-colors"
              placeholder="Jane Doe"
            />
          </div>
          <div>
            <label htmlFor="invite-password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              id="invite-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black outline-none transition-colors"
              placeholder="••••••••"
              required
            />
          </div>
          <div>
            <label htmlFor="invite-confirm" className="block text-sm font-medium text-gray-700 mb-1">
              Confirm Password
            </label>
            <input
              id="invite-confirm"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black outline-none transition-colors"
              placeholder="••••••••"
              required
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-black text-white py-2.5 rounded-lg font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            Join workspace
          </button>
        </form>
      </div>
    </div>
  );
}
