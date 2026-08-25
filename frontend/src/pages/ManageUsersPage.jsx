import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api, ApiError } from '../api/client';
import AppLayout from '../components/AppLayout';

const SENSITIVE_ROLES = new Set(['admin', 'owner']);
const ALL_ROLES = ['patient', 'staff', 'admin', 'owner'];

export default function ManageUsersPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState(null);
  const [error, setError] = useState(null);
  const [pendingId, setPendingId] = useState(null);

  useEffect(() => {
    load();
  }, []);

  function load() {
    api.get('/users').then((data) => setUsers(data.users));
  }

  async function handleRoleChange(userId, role) {
    setError(null);
    setPendingId(userId);
    try {
      const data = await api.patch(`/users/${userId}/role`, { role });
      setUsers((prev) => prev.map((u) => (u.id === userId ? data.user : u)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
    } finally {
      setPendingId(null);
    }
  }

  const isOwner = me?.role === 'owner';
  const assignableRoles = isOwner ? ALL_ROLES : ['patient', 'staff'];

  return (
    <AppLayout>
      <div className="page-body page-body-wide">
        <h1 className="page-title">Team &amp; Roles</h1>
        <p className="page-subtitle">
          {isOwner
            ? 'Grant or revoke staff and admin access for any account.'
            : 'Grant or revoke staff access. Only an owner can manage admin accounts.'}
        </p>

        {error && (
          <div className="form-error" role="alert" style={{ marginBottom: 16 }}>
            {error}
          </div>
        )}

        {users === null ? (
          <div className="skeleton skeleton-card" role="status" aria-live="polite">
            <span className="sr-only">Loading…</span>
          </div>
        ) : (
          <div className="list-col">
            {users.map((u) => {
              const isSelf = u.id === me?.id;
              const locked = !isOwner && SENSITIVE_ROLES.has(u.role);
              return (
                <div key={u.id} className="appointment-card">
                  <div className="appointment-main">
                    <span className="appointment-doctor">{u.fullName}</span>
                    <span className="appointment-time">{u.email}</span>
                  </div>
                  <div className="appointment-actions">
                    <span className="role-badge">{u.role}</span>
                    {isSelf ? (
                      <span className="page-subtitle" style={{ margin: 0 }}>
                        (you)
                      </span>
                    ) : locked ? (
                      <span className="page-subtitle" style={{ margin: 0 }}>
                        Owner only
                      </span>
                    ) : (
                      <select
                        value={u.role}
                        disabled={pendingId === u.id}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        aria-label={`Change role for ${u.fullName}`}
                      >
                        {assignableRoles
                          .concat(assignableRoles.includes(u.role) ? [] : [u.role])
                          .map((role) => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))}
                      </select>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
