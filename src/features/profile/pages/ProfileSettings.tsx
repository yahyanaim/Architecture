import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { profileApi, Profile } from '../api/profileApi';
import { passkeyApi, PasskeyCredentialDTO } from '@/features/auth/api/passkeyApi';
import { validatePassword } from '@/features/auth/lib/password';
import { apiErrorMessage } from '@/lib/errors';
import { useAuth } from '@/features/auth/context/AuthContext';
import { toast } from 'sonner';
import { Loader2, Trash2, KeyRound, Plus, ShieldCheck } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export function ProfileSettings() {
  const { user, setUser, logout } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [activeTab, setActiveTab] = useState<'profile' | 'password' | 'security' | 'danger'>('profile');
  const [isDeleting, setIsDeleting] = useState(false);

  // Passkeys state
  const [passkeys, setPasskeys] = useState<PasskeyCredentialDTO[]>([]);
  const [isPasskeysLoading, setIsPasskeysLoading] = useState(false);
  const [newPasskeyName, setNewPasskeyName] = useState('');
  const [isRegisteringPasskey, setIsRegisteringPasskey] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const data = await profileApi.getProfile();
        setProfile(data);
        setName(data.name);
        setEmail(data.email);
      } catch (error: unknown) {
        toast.error(apiErrorMessage(error, 'Failed to load profile'));
      } finally {
        setIsLoading(false);
      }
    };
    fetchProfile();
  }, []);

  useEffect(() => {
    if (activeTab === 'security') {
      loadPasskeys();
    }
  }, [activeTab]);

  const loadPasskeys = async () => {
    setIsPasskeysLoading(true);
    try {
      const data = await passkeyApi.listCredentials();
      setPasskeys(data);
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Failed to load passkeys'));
    } finally {
      setIsPasskeysLoading(false);
    }
  };

  const handleRegisterPasskey = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsRegisteringPasskey(true);
    try {
      const newCred = await passkeyApi.registerPasskey(newPasskeyName.trim() || undefined);
      toast.success('Passkey registered successfully!');
      setNewPasskeyName('');
      setPasskeys((prev) => [newCred, ...prev]);
    } catch (error: any) {
      if (error?.name === 'NotAllowedError') {
        return;
      }
      toast.error(apiErrorMessage(error, 'Failed to register passkey'));
    } finally {
      setIsRegisteringPasskey(false);
    }
  };

  const handleDeletePasskey = async (id: string) => {
    try {
      await passkeyApi.deleteCredential(id);
      setPasskeys((prev) => prev.filter((p) => p.id !== id));
      toast.success('Passkey removed');
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Failed to remove passkey'));
    }
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const updated = await profileApi.updateProfile({ name, email });
      setProfile(updated);
      if (user) {
        setUser({ ...user, name: updated.name, email: updated.email });
      }
      toast.success('Saved');
    } catch (error: unknown) {
      toast.error(apiErrorMessage(error, 'Failed to save'));
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    const pwError = validatePassword(newPassword);
    if (pwError) {
      toast.error(pwError);
      return;
    }

    setIsSaving(true);
    try {
      await profileApi.changePassword(currentPassword, newPassword);
      toast.success('Password changed');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: unknown) {
      toast.error(apiErrorMessage(error, 'Failed to change password'));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto">
      <h2 className="text-xl font-semibold text-black mb-6">Settings</h2>

      <div className="flex gap-2 mb-6 p-1 bg-gray-100 rounded-lg">
        <button
          onClick={() => setActiveTab('profile')}
          className={`flex-1 py-2 px-3 text-xs font-medium rounded-md transition-all ${
            activeTab === 'profile'
              ? 'bg-white text-black shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Profile
        </button>
        <button
          onClick={() => setActiveTab('password')}
          className={`flex-1 py-2 px-3 text-xs font-medium rounded-md transition-all ${
            activeTab === 'password'
              ? 'bg-white text-black shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Password
        </button>
        <button
          onClick={() => setActiveTab('security')}
          className={`flex-1 py-2 px-3 text-xs font-medium rounded-md transition-all ${
            activeTab === 'security'
              ? 'bg-white text-black shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Passkeys
        </button>
        <button
          onClick={() => setActiveTab('danger')}
          className={`flex-1 py-2 px-3 text-xs font-medium rounded-md transition-all ${
            activeTab === 'danger'
              ? 'bg-white text-red-600 shadow-sm'
              : 'text-red-500 hover:text-red-700'
          }`}
        >
          Danger
        </button>
      </div>

      {activeTab === 'profile' && (
        <form onSubmit={handleProfileUpdate} className="space-y-4">
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-500 uppercase">Full Name</p>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-black focus:bg-white transition-colors"
              required
            />
          </div>

          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-500 uppercase">Email</p>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-black focus:bg-white transition-colors"
              required
            />
          </div>

          <div className="pt-2 space-y-1">
            <p className="text-xs font-medium text-gray-400 uppercase">ID</p>
            <p className="text-sm text-gray-500 font-mono truncate">{profile?.id || 'Loading...'}</p>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="w-full py-2 text-sm font-medium bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save Profile'}
          </button>
        </form>
      )}

      {activeTab === 'password' && (
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-500 uppercase">Current Password</p>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-black focus:bg-white transition-colors"
              required
            />
          </div>

          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-500 uppercase">New Password</p>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-black focus:bg-white transition-colors"
              required
              minLength={6}
            />
          </div>

          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-500 uppercase">Confirm Password</p>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-black focus:bg-white transition-colors"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="w-full py-2 text-sm font-medium bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {isSaving ? 'Changing...' : 'Change Password'}
          </button>
        </form>
      )}

      {activeTab === 'security' && (
        <div className="space-y-6">
          <div className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <h3 className="text-sm font-semibold text-gray-900">FIDO2 Passkeys</h3>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              Passkeys let you sign in securely using your fingerprint, face recognition (Touch ID / Face ID), or a hardware security key (YubiKey).
            </p>

            <form onSubmit={handleRegisterPasskey} className="space-y-3 pt-2">
              <input
                type="text"
                placeholder="Device Name (e.g. MacBook Pro, iPhone)"
                value={newPasskeyName}
                onChange={(e) => setNewPasskeyName(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-black focus:bg-white transition-colors"
              />
              <button
                type="submit"
                disabled={isRegisteringPasskey}
                className="w-full py-2 px-3 text-xs font-medium bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isRegisteringPasskey ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                Register New Passkey
              </button>
            </form>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Your Registered Devices
            </h4>

            {isPasskeysLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              </div>
            ) : passkeys.length === 0 ? (
              <p className="text-xs text-gray-500 py-3 text-center border border-dashed border-gray-200 rounded-lg">
                No passkeys registered yet. Add one above for instant, passwordless sign-in.
              </p>
            ) : (
              <div className="space-y-2">
                {passkeys.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <KeyRound className="w-4 h-4 text-gray-600" />
                      <div>
                        <p className="font-medium text-gray-900">{p.name}</p>
                        <p className="text-[10px] text-gray-500">
                          Added {new Date(p.createdAt).toLocaleDateString()}
                          {p.lastUsedAt && ` · Last used ${new Date(p.lastUsedAt).toLocaleDateString()}`}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeletePasskey(p.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 rounded transition-colors"
                      title="Remove passkey"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'danger' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-red-200 bg-red-50 p-6">
            <div className="flex items-center gap-3 mb-4">
              <Trash2 className="w-5 h-5 text-red-600" />
              <h3 className="text-lg font-semibold text-red-600">Delete Account</h3>
            </div>
            <p className="text-sm text-red-700 mb-4">
              This will permanently delete your account and all associated data. This action cannot be undone.
            </p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  disabled={isDeleting}
                  className="w-full py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {isDeleting ? 'Deleting...' : 'Delete my account'}
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete your account. You will be logged out and will not be able to recover your data.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={async () => {
                      setIsDeleting(true);
                      try {
                        await profileApi.deleteAccount();
                        await logout();
                        navigate('/login', { replace: true });
                      } catch (error: unknown) {
                        toast.error(apiErrorMessage(error, 'Failed to delete account'));
                        setIsDeleting(false);
                      }
                    }}
                    className="bg-red-600 text-white hover:bg-red-700"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      )}
    </div>
  );
}