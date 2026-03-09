import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userApi } from '../api/userApi';
import { toast } from 'sonner';
import { User } from '../types';
import { X } from 'lucide-react';

export function UserList() {
  const queryClient = useQueryClient();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const { data: users, isLoading, error } = useQuery({
    queryKey: ['users'],
    queryFn: userApi.getUsers,
  });

  const toggleMutation = useMutation({
    mutationFn: userApi.toggleStatus,
    onSuccess: (updatedUser) => {
      toast.success('User status updated');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      if (selectedUser?.id === updatedUser.id) {
        setSelectedUser(updatedUser);
      }
    },
    onError: () => toast.error('Failed to update status')
  });

  const deleteMutation = useMutation({
    mutationFn: userApi.deleteUser,
    onSuccess: () => {
      toast.success('User deleted');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setSelectedUser(null);
    },
    onError: () => toast.error('Failed to delete user')
  });

  if (isLoading) return <div className="text-gray-500">Loading users...</div>;
  if (error) return <div className="text-red-500">Failed to load users.</div>;
  if (!users || users.length === 0) return <div className="text-gray-500">No users found.</div>;

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {users.map((user) => (
          <div 
            key={user.id}
            onClick={() => setSelectedUser(user)}
            className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md cursor-pointer transition-all flex flex-col gap-2"
          >
            <div className="flex justify-between items-start">
              <h4 className="font-semibold text-black truncate">{user.name}</h4>
              <span className={`px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold rounded-full ${user.isActive ? 'bg-gray-100 text-gray-800' : 'bg-gray-50 text-gray-400'}`}>
                {user.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            <p className="text-sm text-gray-500 truncate">{user.email}</p>
          </div>
        ))}
      </div>

      {/* Simple Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h3 className="text-xl font-bold text-black">User Details</h3>
              <button 
                onClick={() => setSelectedUser(null)}
                className="text-gray-400 hover:text-black transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 flex flex-col gap-4">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Name</p>
                <p className="text-base font-medium text-black">{selectedUser.name}</p>
              </div>
              
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Email</p>
                <p className="text-base text-gray-700">{selectedUser.email}</p>
              </div>

              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Status</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`w-2.5 h-2.5 rounded-full ${selectedUser.isActive ? 'bg-black' : 'bg-gray-300'}`}></span>
                  <span className="text-sm font-medium text-gray-700">
                    {selectedUser.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>

              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Joined</p>
                <p className="text-sm text-gray-700">
                  {new Date(selectedUser.createdAt).toLocaleDateString()} at {new Date(selectedUser.createdAt).toLocaleTimeString()}
                </p>
              </div>
            </div>

            <div className="p-6 bg-gray-50 border-t border-gray-100 flex gap-3 justify-end">
              <button 
                onClick={() => toggleMutation.mutate(selectedUser.id)}
                disabled={toggleMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:text-black transition-colors disabled:opacity-50"
              >
                {toggleMutation.isPending ? 'Updating...' : (selectedUser.isActive ? 'Deactivate' : 'Activate')}
              </button>
              <button 
                onClick={() => {
                  if (window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
                    deleteMutation.mutate(selectedUser.id);
                  }
                }}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-black rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
