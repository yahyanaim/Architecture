import { useState, useEffect } from 'react';
import { profileApi, Profile } from '../api/profileApi';
import { useAuth } from '@/features/auth/context/AuthContext';
import { toast } from 'sonner';
import { Loader2, Trash2 } from 'lucide-react';
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
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [activeTab, setActiveTab] = useState<'profile' | 'password' | 'danger'>('profile');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const data = await profileApi.getProfile();
        setProfile(data);
        setName(data.name);
        setEmail(data.email);
      } catch {
        toast.error('Failed to load profile');
      } finally {
        setIsLoading(false);
      }
    };
    fetchProfile();
  }, []);

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
    } catch {
      toast.error('Failed to save');
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

    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (!/[A-Z]/.test(newPassword)) {
      toast.error('Password must contain an uppercase letter');
      return;
    }
    if (!/[a-z]/.test(newPassword)) {
      toast.error('Password must contain a lowercase letter');
      return;
    }
    if (!/[0-9]/.test(newPassword)) {
      toast.error('Password must contain a number');
      return;
    }

    setIsSaving(true);
    try {
      await profileApi.changePassword(currentPassword, newPassword);
      toast.success('Password changed');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      toast.error('Failed to change password');
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
          className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-all ${
            activeTab === 'profile'
              ? 'bg-white text-black shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Profile
        </button>
        <button
          onClick={() => setActiveTab('password')}
          className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-all ${
            activeTab === 'password'
              ? 'bg-white text-black shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Password
        </button>
        <button
          onClick={() => setActiveTab('danger')}
          className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-all ${
            activeTab === 'danger'
              ? 'bg-white text-red-600 text-red-600 shadow-sm'
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

          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-400 uppercase">Member Since</p>
            <p className="text-sm text-gray-500">
              {profile?.createdAt 
                ? new Date(profile.createdAt).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  }) 
                : 'Loading...'}
            </p>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="w-full py-2 text-sm font-medium bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save'}
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
                        window.location.reload();
                      } catch {
                        toast.error('Failed to delete account');
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