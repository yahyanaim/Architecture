import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { authApi } from '../api/authApi';
import { validatePassword } from '../lib/password';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { apiErrorMessage } from '@/lib/errors';

// Deep link from reset emails: /reset-password?token=… (public — the token
// IS the credential; single-use, 1h expiry, enforced server-side).
export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmNewPassword) {
      toast.error('Passwords do not match');
      return;
    }
    const pwError = validatePassword(newPassword);
    if (pwError) {
      toast.error(pwError);
      return;
    }
    setIsLoading(true);
    try {
      await authApi.resetPassword(token, newPassword, confirmNewPassword);
      toast.success('Password changed — sign in with the new one.');
      navigate('/login', { replace: true });
    } catch (error: unknown) {
      toast.error(apiErrorMessage(error, 'Could not reset password'));
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 w-full max-w-md text-center">
          <h1 className="text-xl font-bold text-black">Invalid reset link</h1>
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
          <h1 className="text-2xl font-bold text-black">Set a new password</h1>
          <p className="text-gray-500 mt-2">All other sessions will be signed out</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="reset-password" className="block text-sm font-medium text-gray-700 mb-1">
              New Password
            </label>
            <input
              id="reset-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black outline-none transition-colors"
              placeholder="••••••••"
              required
            />
          </div>
          <div>
            <label htmlFor="reset-confirm" className="block text-sm font-medium text-gray-700 mb-1">
              Confirm New Password
            </label>
            <input
              id="reset-confirm"
              type="password"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
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
            Reset password
          </button>
        </form>
      </div>
    </div>
  );
}
