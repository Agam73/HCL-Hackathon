import React, { useEffect, useState } from 'react';
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
import { api, login, register, logout } from '../api/client';
import { homeFor } from '../api/RequireRole';

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

  // Stores for the "preferred store" dropdown, loaded from the backend
  const [storeOptions, setStoreOptions] = useState([{ id: 'ST-BLR-01', name: 'NovaMart Koramangala — Bengaluru' }]);
  useEffect(() => {
    let cancelled = false;
    api
      .get('/stores', { type: 'STORE', size: 100 }, { auth: false })
      .then((stores) => {
        if (cancelled || stores.length === 0) return;
        setStoreOptions(stores.map((st) => ({ id: st.id, name: `${st.name} — ${st.address.city}` })));
        setRegStoreId((current) => (stores.some((st) => st.id === current) ? current : stores[0].id));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Membership Tiers
  const tierOptions = [
    { id: 'STANDARD', name: 'Standard', desc: 'Free membership with express delivery' },
    { id: 'SILVER', name: 'Silver Tier', desc: '5% cashback & weekly discounts' },
    { id: 'GOLD', name: 'Gold Privilege', desc: 'Instant ₹350 off + zero delivery fee' },
    { id: 'PLATINUM', name: 'Platinum VIP', desc: 'Priority concierge & 15% instant off' }
  ];

  const say = (message) => {
    if (onTriggerToast) onTriggerToast(message);
  };
  const firstProblem = (err) => err.details?.[0]?.message ?? err.message;

  // Submit Login - POST /auth/login. A wrong password is an error, never a session.
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    const email = loginEmail.trim().toLowerCase();
    if (!email || !loginPassword) {
      say('Please enter both email and password.');
      return;
    }

    setIsLoading(true);
    try {
      const user = await login(email, loginPassword);
      say(`Welcome back, ${user.fullName}!`);
      navigate(homeFor(user.role));
    } catch (err) {
      say(err.status === 401 ? 'Incorrect email or password.' : firstProblem(err));
    } finally {
      setIsLoading(false);
    }
  };

  // Submit Registration - POST /auth/register (new accounts start on the Standard tier)
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();

    if (!regEmail || !regPassword || !regFullName) {
      say('Please fill in name, email, and password.');
      return;
    }
    if (regPassword.length < 8) {
      say('Password must be at least 8 characters long.');
      return;
    }

    setIsLoading(true);
    try {
      const user = await register({
        fullName: regFullName.trim(),
        email: regEmail.trim().toLowerCase(),
        password: regPassword,
        phone: regPhone.trim() || undefined,
        city: regCity.trim() || undefined,
        country: 'IN',
        preferredStoreId: regStoreId,
      });
      say(`Account created for ${user.fullName}! Welcome to NovaMart.`);
      navigate(homeFor(user.role));
    } catch (err) {
      say(`Registration: ${firstProblem(err)}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 1-Click demo logins sign in to the seeded demo accounts on the backend.
  const DEMO_PASSWORD = 'Passw0rd!';
  const DEMO_ACCOUNTS = {
    customer: 'meera.iyer@example.com',
    storemanager: 'manager.blr01@novamart.com',
  };
  const handleQuickPersona = async (persona) => {
    if (persona === 'admin') {
      // The admin portal has no login: it opens only on an authorised admin PC.
      await logout();
      navigate('/admin');
      return;
    }
    setIsLoading(true);
    try {
      const user = await login(DEMO_ACCOUNTS[persona], DEMO_PASSWORD);
      say(`Logged in as ${user.fullName}`);
      navigate(homeFor(user.role));
    } catch (err) {
      say(firstProblem(err));
    } finally {
      setIsLoading(false);
    }
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
