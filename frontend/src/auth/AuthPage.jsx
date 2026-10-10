import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Lock,
  Mail,
  User,
  Phone,
  MapPin,
  Store,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  ShoppingBag,
  CheckCircle2,
  ArrowLeft
} from 'lucide-react';
import './AuthPage.css';

export default function AuthPage({ mode = 'login', onTriggerToast }) {
  const navigate = useNavigate();
  const location = useLocation();

  // Active tab: 'login' or 'register'
  const isRegisterRoute = location.pathname === '/register';
  const [tabOverride, setTabOverride] = useState(null);
  const activeTab = tabOverride ?? (isRegisterRoute ? 'register' : mode);
  const setActiveTab = (tab) => setTabOverride(tab);

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Register form state
  const [regFullName, setRegFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regPhone, setRegPhone] = useState('');
  const [regCity, setRegCity] = useState('Bengaluru');
  const [regStoreId, setRegStoreId] = useState('ST-BLR-01');
  const [regTier, setRegTier] = useState('GOLD');

  // Loading indicator
  const [isLoading, setIsLoading] = useState(false);

  // Available stores
  const storeOptions = [
    { id: 'ST-BLR-01', name: 'Indiranagar Flagship — Bengaluru' },
    { id: 'ST-BLR-02', name: 'Koramangala Hypermarket — Bengaluru' },
    { id: 'ST-BLR-03', name: 'Whitefield Tech Zone — Bengaluru' },
    { id: 'ST-DEL-01', name: 'Connaught Place Hypermarket — New Delhi' },
    { id: 'ST-MUM-01', name: 'Bandra West Flagship — Mumbai' },
    { id: 'ST-AUS-104', name: 'Austin Flagship (Store #104) — Texas' }
  ];

  // Membership Tiers
  const tierOptions = [
    { id: 'STANDARD', name: 'Standard', desc: 'Free membership with express delivery' },
    { id: 'SILVER', name: 'Silver Tier', desc: '5% cashback & weekly discounts' },
    { id: 'GOLD', name: 'Gold Privilege', desc: 'Instant ₹350 off + zero delivery fee' },
    { id: 'PLATINUM', name: 'Platinum VIP', desc: 'Priority concierge & 15% instant off' }
  ];

  // Helper to persist auth & redirect
  const completeAuth = (user, token) => {
    localStorage.setItem('auth_token', token || 'mock-jwt-token-' + Date.now());
    localStorage.setItem('auth_user', JSON.stringify(user));
    window.dispatchEvent(new Event('auth-state-changed'));

    if (user.role === 'STORE_MANAGER') {
      navigate('/storemanager');
    } else if (user.role === 'ADMIN') {
      navigate('/admin');
    } else {
      navigate('/');
    }
  };

  // Submit Login
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    const email = loginEmail.trim().toLowerCase();
    const password = loginPassword;

    if (!email || !password) {
      if (onTriggerToast) onTriggerToast('Please enter both email and password.');
      return;
    }

    setIsLoading(true);

    try {
      // 1. Try real backend API
      const res = await fetch('http://localhost:8080/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok && data?.data?.token) {
        setIsLoading(false);
        if (onTriggerToast) {
          onTriggerToast(`Welcome back, ${data.data.user.fullName || email}!`);
        }
        completeAuth(data.data.user, data.data.token);
        return;
      }
    } catch {
      // Backend offline, fallback to mock credentials below
    }

    setIsLoading(false);

    // 2. Mock Fallback based on email conventions
    let role = 'CUSTOMER';
    let name = email.split('@')[0];
    let tier = 'GOLD';

    if (email.includes('admin')) {
      role = 'ADMIN';
      name = 'Aarav Mehta';
      tier = 'PLATINUM';
    } else if (email.includes('manager')) {
      role = 'STORE_MANAGER';
      name = 'Alex Morgan';
      tier = 'STANDARD';
    } else {
      name = 'Priya Sharma';
    }

    const mockUser = {
      id: 'USR-' + Date.now(),
      email,
      fullName: name,
      role,
      membershipTier: tier,
      preferredStoreId: 'ST-BLR-01',
      city: 'Bengaluru',
      country: 'IN'
    };

    if (onTriggerToast) {
      onTriggerToast(`Signed in as ${name} (${role})`);
    }
    completeAuth(mockUser);
  };

  // Submit Registration
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();

    if (!regEmail || !regPassword || !regFullName) {
      if (onTriggerToast) onTriggerToast('Please fill in name, email, and password.');
      return;
    }

    if (regPassword.length < 8) {
      if (onTriggerToast) onTriggerToast('Password must be at least 8 characters long.');
      return;
    }

    setIsLoading(true);

    const payload = {
      fullName: regFullName.trim(),
      email: regEmail.trim().toLowerCase(),
      password: regPassword,
      phone: regPhone.trim() || undefined,
      city: regCity.trim() || undefined,
      country: 'IN',
      membershipTier: regTier,
      preferredStoreId: regStoreId,
    };

    try {
      const res = await fetch('http://localhost:8080/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data?.data?.token) {
        setIsLoading(false);
        if (onTriggerToast) {
          onTriggerToast(`Account created for ${data.data.user.fullName}! Welcome to NovaMart.`);
        }
        completeAuth(data.data.user, data.data.token);
        return;
      } else if (data?.error?.message) {
        setIsLoading(false);
        if (onTriggerToast) onTriggerToast(`Registration: ${data.error.message}`);
        return;
      }
    } catch {
      // Backend offline, fallback to mock account
    }

    setIsLoading(false);

    const newUser = {
      id: 'USR-' + Date.now(),
      email: payload.email,
      fullName: payload.fullName,
      phone: payload.phone,
      city: payload.city,
      role: 'CUSTOMER',
      membershipTier: payload.membershipTier,
      preferredStoreId: payload.preferredStoreId
    };

    if (onTriggerToast) {
      onTriggerToast(`Account created for ${payload.fullName}! Tier: ${payload.membershipTier}`);
    }
    completeAuth(newUser);
  };

  // 1-Click Demo Persona Login
  const handleQuickPersona = (persona) => {
    let user;
    if (persona === 'customer') {
      user = {
        id: 'USR-CUST-101',
        email: 'priya.sharma@example.com',
        fullName: 'Priya Sharma',
        role: 'CUSTOMER',
        membershipTier: 'GOLD',
        preferredStoreId: 'ST-BLR-01',
        city: 'Bengaluru'
      };
      if (onTriggerToast) onTriggerToast('Logged in as Priya Sharma (Customer • Gold Member)');
    } else if (persona === 'storemanager') {
      user = {
        id: 'USR-MGR-201',
        email: 'alex.morgan@novamart.com',
        fullName: 'Alex Morgan',
        role: 'STORE_MANAGER',
        managedStoreId: 'ST-AUS-104',
        membershipTier: 'STANDARD',
        city: 'Austin'
      };
      if (onTriggerToast) onTriggerToast('Logged in as Alex Morgan (Store Manager • Austin Flagship)');
    } else if (persona === 'admin') {
      user = {
        id: 'USR-ADM-001',
        email: 'admin@novamart.com',
        fullName: 'Aarav Mehta',
        role: 'ADMIN',
        membershipTier: 'PLATINUM',
        city: 'New Delhi'
      };
      if (onTriggerToast) onTriggerToast('Logged in as Aarav Mehta (Central Operations Admin)');
    }

    completeAuth(user);
  };

  return (
    <div className="auth-page-root">
      {/* Background Decor */}
      <div className="auth-bg-blob auth-blob-1" />
      <div className="auth-bg-blob auth-blob-2" />

      {/* Top Bar Return Link */}
      <div className="auth-top-nav">
        <button type="button" className="auth-back-btn" onClick={() => navigate('/')}>
          <ArrowLeft size={16} />
          <span>Back to Storefront</span>
        </button>
      </div>

      <div className="auth-card-container">
        {/* Header Branding */}
        <div className="auth-card-header">
          <div className="auth-brand-badge" onClick={() => navigate('/')}>
            <div className="auth-logo-box">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
            </div>
            <span className="auth-brand-name">NovaMart</span>
          </div>
          <h2 className="auth-title">
            {activeTab === 'login' ? 'Welcome Back' : 'Create an Account'}
          </h2>
          <p className="auth-subtitle">
            {activeTab === 'login'
              ? 'Access 15,000+ groceries, personalized deals & real-time store inventory'
              : 'Sign up to unlock Gold Privilege benefits & 24-minute express delivery'}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="auth-tab-switch">
          <button
            type="button"
            className={`auth-tab-item ${activeTab === 'login' ? 'active' : ''}`}
            onClick={() => setActiveTab('login')}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`auth-tab-item ${activeTab === 'register' ? 'active' : ''}`}
            onClick={() => setActiveTab('register')}
          >
            Register
          </button>
        </div>

        {/* 1-Click Persona Demo Logins */}
        <div className="demo-persona-strip">
          <div className="demo-persona-label">
            <Sparkles size={13} color="#2563EB" />
            <span>1-Click Hackathon Demo Access:</span>
          </div>
          <div className="demo-persona-buttons">
            <button
              type="button"
              className="persona-btn customer"
              onClick={() => handleQuickPersona('customer')}
              title="Sign in as Priya Sharma (Customer)"
            >
              <ShoppingBag size={13} />
              <span>Customer</span>
            </button>
            <button
              type="button"
              className="persona-btn manager"
              onClick={() => handleQuickPersona('storemanager')}
              title="Sign in as Alex Morgan (Store Manager)"
            >
              <Store size={13} />
              <span>Store Manager</span>
            </button>
            <button
              type="button"
              className="persona-btn admin"
              onClick={() => handleQuickPersona('admin')}
              title="Sign in as Aarav Mehta (Administrator)"
            >
              <ShieldCheck size={13} />
              <span>Admin</span>
            </button>
          </div>
        </div>

        {/* ------------------------------------------------------------------
            FORM 1: LOGIN
            ------------------------------------------------------------------ */}
        {activeTab === 'login' ? (
          <form onSubmit={handleLoginSubmit} className="auth-form">
            <div className="auth-field-group">
              <label className="auth-label">Email Address</label>
              <div className="auth-input-wrap">
                <Mail size={16} className="auth-input-icon" />
                <input
                  type="email"
                  className="auth-input"
                  placeholder="name@example.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>
            </div>

            <div className="auth-field-group">
              <div className="auth-label-row">
                <label className="auth-label">Password</label>
                <button
                  type="button"
                  className="auth-link-text"
                  onClick={() => {
                    if (onTriggerToast) onTriggerToast('Password reset link sent to registered email.');
                  }}
                >
                  Forgot password?
                </button>
              </div>
              <div className="auth-input-wrap">
                <Lock size={16} className="auth-input-icon" />
                <input
                  type={showLoginPassword ? 'text' : 'password'}
                  className="auth-input"
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                >
                  {showLoginPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="auth-checkbox-row">
              <label className="auth-checkbox-label">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span>Remember me on this browser</span>
              </label>
            </div>

            <button type="submit" className="auth-submit-btn" disabled={isLoading}>
              {isLoading ? (
                <span>Signing in...</span>
              ) : (
                <>
                  <span>Sign In to NovaMart</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>

            <div className="auth-footer-prompt">
              Don't have an account yet?{' '}
              <button
                type="button"
                className="auth-link-inline"
                onClick={() => setActiveTab('register')}
              >
                Create one now
              </button>
            </div>
          </form>
        ) : (
          /* ------------------------------------------------------------------
              FORM 2: REGISTER
              ------------------------------------------------------------------ */
          <form onSubmit={handleRegisterSubmit} className="auth-form">
            <div className="auth-field-group">
              <label className="auth-label">Full Name</label>
              <div className="auth-input-wrap">
                <User size={16} className="auth-input-icon" />
                <input
                  type="text"
                  className="auth-input"
                  placeholder="Priya Sharma"
                  value={regFullName}
                  onChange={(e) => setRegFullName(e.target.value)}
                  required
                  autoFocus
                />
              </div>
            </div>

            <div className="auth-field-group">
              <label className="auth-label">Email Address</label>
              <div className="auth-input-wrap">
                <Mail size={16} className="auth-input-icon" />
                <input
                  type="email"
                  className="auth-input"
                  placeholder="priya.sharma@example.com"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="auth-field-group">
              <label className="auth-label">Password (min. 8 characters)</label>
              <div className="auth-input-wrap">
                <Lock size={16} className="auth-input-icon" />
                <input
                  type={showRegPassword ? 'text' : 'password'}
                  className="auth-input"
                  placeholder="At least 8 characters"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  onClick={() => setShowRegPassword(!showRegPassword)}
                >
                  {showRegPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="auth-grid-2">
              <div className="auth-field-group">
                <label className="auth-label">Phone Number (Optional)</label>
                <div className="auth-input-wrap">
                  <Phone size={16} className="auth-input-icon" />
                  <input
                    type="tel"
                    className="auth-input"
                    placeholder="+91-98765-43210"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                  />
                </div>
              </div>

              <div className="auth-field-group">
                <label className="auth-label">City</label>
                <div className="auth-input-wrap">
                  <MapPin size={16} className="auth-input-icon" />
                  <input
                    type="text"
                    className="auth-input"
                    placeholder="Bengaluru"
                    value={regCity}
                    onChange={(e) => setRegCity(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="auth-field-group">
              <label className="auth-label">Preferred Neighborhood Store</label>
              <div className="auth-input-wrap">
                <Store size={16} className="auth-input-icon" />
                <select
                  className="auth-select"
                  value={regStoreId}
                  onChange={(e) => setRegStoreId(e.target.value)}
                >
                  {storeOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="auth-field-group">
              <label className="auth-label">Membership Tier</label>
              <div className="tier-cards-grid">
                {tierOptions.map((t) => (
                  <div
                    key={t.id}
                    className={`tier-choice-card ${regTier === t.id ? 'active' : ''}`}
                    onClick={() => setRegTier(t.id)}
                  >
                    <div className="tier-choice-header">
                      <span className="tier-choice-title">{t.name}</span>
                      {regTier === t.id && <CheckCircle2 size={15} color="#2563EB" />}
                    </div>
                    <span className="tier-choice-desc">{t.desc}</span>
                  </div>
                ))}
              </div>
            </div>

            <button type="submit" className="auth-submit-btn" disabled={isLoading}>
              {isLoading ? (
                <span>Creating Account...</span>
              ) : (
                <>
                  <span>Create NovaMart Account</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>

            <div className="auth-footer-prompt">
              Already have an account?{' '}
              <button
                type="button"
                className="auth-link-inline"
                onClick={() => setActiveTab('login')}
              >
                Sign In instead
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
