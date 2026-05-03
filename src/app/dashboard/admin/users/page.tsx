'use client';
import { useEffect, useState, useCallback } from 'react';
import { Badge, Button, Select, Card, EmptyState, Skeleton } from '@/components/ui';
import { Users, CheckCircle, XCircle, Trash2, RefreshCw } from 'lucide-react';
import { apiCall } from '@/utils/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

interface User {
  _id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRole, setFilterRole] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterRole) params.set('role', filterRole);
      if (filterStatus) params.set('status', filterStatus);
      const data = await apiCall<{ users: User[] }>(`/api/admin/users?${params}`);
      setUsers(data.users);
    } catch {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [filterRole, filterStatus]);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (id: string, status: string) => {
    setActionLoading(id + status);
    try {
      await apiCall(`/api/admin/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      toast.success(`User ${status}`);
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setActionLoading(null);
    }
  };

  const deleteUser = async (id: string) => {
    if (!confirm('Delete this user permanently?')) return;
    setActionLoading(id + 'delete');
    try {
      await apiCall(`/api/admin/users/${id}`, { method: 'DELETE' });
      toast.success('User deleted');
      setUsers((u) => u.filter((x) => x._id !== id));
    } catch {
      toast.error('Failed to delete');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">User Management</h1>
          <p className="text-white/40 text-sm mt-0.5">Approve, reject, or manage all users</p>
        </div>
        <Button variant="ghost" size="sm" onClick={load}>
          <RefreshCw size={14} /> Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <Select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          options={[{ value: '', label: 'All Roles' }, { value: 'teacher', label: 'Teachers' }, { value: 'student', label: 'Students' }]}
          className="w-full sm:w-40"
        />
        <Select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          options={[{ value: '', label: 'All Status' }, { value: 'pending', label: 'Pending' }, { value: 'approved', label: 'Approved' }, { value: 'rejected', label: 'Rejected' }]}
          className="w-full sm:w-40"
        />
      </div>

      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : users.length === 0 ? (
          <EmptyState icon={<Users size={32} />} title="No users found" description="Try adjusting your filters" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  {['Name', 'Email', 'Role', 'Status', 'Joined', 'Actions'].map((h) => (
                    <th key={h} className="text-left px-5 py-3.5 text-xs font-semibold text-white/40 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u._id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs shrink-0">
                          {u.name.charAt(0)}
                        </div>
                        <span className="font-medium text-white">{u.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-white/50">{u.email}</td>
                    <td className="px-5 py-3.5"><Badge value={u.role} /></td>
                    <td className="px-5 py-3.5"><Badge value={u.status} /></td>
                    <td className="px-5 py-3.5 text-white/40 text-xs">
                      {format(new Date(u.createdAt), 'MMM dd, yyyy')}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5">
                        {u.status !== 'approved' && (
                          <Button
                            size="sm" variant="ghost"
                            loading={actionLoading === u._id + 'approved'}
                            onClick={() => updateStatus(u._id, 'approved')}
                            className="text-green-400 hover:text-green-300 hover:bg-green-500/10"
                          >
                            <CheckCircle size={14} />
                          </Button>
                        )}
                        {u.status !== 'rejected' && (
                          <Button
                            size="sm" variant="ghost"
                            loading={actionLoading === u._id + 'rejected'}
                            onClick={() => updateStatus(u._id, 'rejected')}
                            className="text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                          >
                            <XCircle size={14} />
                          </Button>
                        )}
                        <Button
                          size="sm" variant="danger"
                          loading={actionLoading === u._id + 'delete'}
                          onClick={() => deleteUser(u._id)}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
