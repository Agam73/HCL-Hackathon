import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { getStoredUser, isSignedIn, startAdminSession } from './client';

/** Where each role lands after signing in. */
export const homeFor = (role) => ({ ADMIN: '/admin', STORE_MANAGER: '/storemanager' })[role] ?? '/';

/** Re-render when the session changes (login, logout, expired refresh token). */
function useSession() {
  const read = () => (isSignedIn() ? getStoredUser() : null);
  const [user, setUser] = useState(read);
  useEffect(() => {
    const onChange = () => setUser(read());
    window.addEventListener('auth-state-changed', onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener('auth-state-changed', onChange);
      window.removeEventListener('storage', onChange);
    };
  }, []);
  return user;
}

/**
 * Shows its children only to a signed-in user with one of the given roles.
 * Nobody signed in -> the login page. Signed in with another role -> their own home.
 * The backend enforces the same roles on every call; this only decides what is shown.
 */
export default function RequireRole({ roles, children }) {
  const user = useSession();
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!roles.includes(user.role)) return <Navigate to={homeFor(user.role)} replace />;
  return children;
}

const gateStyle = {
  page: { minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#F8FAFC', padding: '24px' },
  card: { maxWidth: '420px', textAlign: 'center', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '32px 28px', color: '#0F172A' },
  text: { fontSize: '13.5px', color: '#475569', margin: '10px 0 20px', lineHeight: 1.5 },
  link: { display: 'inline-block', background: '#2563EB', color: '#FFFFFF', fontWeight: 600, fontSize: '13.5px', padding: '10px 18px', borderRadius: '9px' },
};

/**
 * Guards the admin portal. There is no admin login: the backend gives an ADMIN
 * session only to an authorised admin PC, and refuses a browser that is signed
 * in as a customer or store manager.
 */
export function AdminGate({ children }) {
  const user = useSession();
  const blocked = user && user.role !== 'ADMIN';
  const [state, setState] = useState('checking'); // checking | granted | denied
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (blocked) return undefined;
    let cancelled = false;
    startAdminSession()
      .then(() => !cancelled && setState('granted'))
      .catch((err) => {
        if (cancelled) return;
        setReason(err.message);
        setState('denied');
      });
    return () => {
      cancelled = true;
    };
  }, [blocked]);

  if (blocked) return <Navigate to={homeFor(user.role)} replace />;
  if (state === 'granted') return children;
  return (
    <div style={gateStyle.page}>
      <div style={gateStyle.card}>
        {state === 'checking' ? (
          <p style={{ ...gateStyle.text, margin: 0 }}>Checking this device…</p>
        ) : (
          <>
            <ShieldAlert size={34} color="#DC2626" />
            <h1 style={{ fontSize: '18px', fontWeight: 700, marginTop: '10px' }}>Admin portal unavailable</h1>
            <p style={gateStyle.text}>{reason}</p>
            <a href="/login" style={gateStyle.link}>Go to sign in</a>
          </>
        )}
      </div>
    </div>
  );
}
