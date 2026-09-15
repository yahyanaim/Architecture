import { useState } from 'react';
import { Link } from 'react-router';
import { authApi } from '../api/authApi';
import { apiErrorMessage } from '@/lib/errors';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, MailCheck } from 'lucide-react';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const validate = () => {
    if (!email.trim()) {
      setError('Email is required');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Invalid email format');
      return false;
    }
    setError('');
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    try {
      await authApi.requestPasswordReset(email.trim());
      setIsSubmitted(true);
      toast.success('Password reset link sent!');
    } catch (err: unknown) {
      toast.error(apiErrorMessage(err, 'Failed to request password reset'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-black">Forgot Password</h1>
          <p className="text-gray-500 mt-2 text-sm">
            Enter your email address and we&apos;ll send you instructions to reset your password.
          </p>
        </div>

        {isSubmitted ? (
          <div className="space-y-6 text-center">
            <div className="mx-auto w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center">
              <MailCheck className="w-6 h-6" />
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-gray-900">Check your inbox</h2>
              <p className="text-sm text-gray-600">
                If an account exists for <span className="font-medium text-gray-900">{email}</span>, we have sent a password reset link.
              </p>
            </div>
            <div className="pt-4 border-t border-gray-100">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 text-sm font-medium text-black hover:underline"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to sign in
              </Link>
            </div>
          </div>
        ) : (
          <form noValidate onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="reset-email" className="block text-sm font-medium text-gray-700 mb-1">
                Email address
              </label>
              <input
                id="reset-email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError('');
                }}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-black focus:border-black outline-none transition-colors ${
                  error ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="you@example.com"
                disabled={isLoading}
              />
              {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-black text-white py-2.5 rounded-lg font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              Send reset link
            </button>

            <div className="text-center pt-2">
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-black transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to sign in
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
