import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MapPin,
  ArrowRight,
  Sparkles,
  Zap,
  Eye,
  EyeOff,
  Thermometer,
  RotateCcw,
  Clock,
  CheckCircle2,
  Apple,
  Milk,
  Smartphone,
  Flower2,
  Coffee,
  Leaf,
  User,
  Lock,
  Mail,
  Phone,
  Shield,
  X
} from 'lucide-react';
import './LandingPage.css';
import { login, register, logout } from '../api/client';
import { homeFor } from '../api/RequireRole';

export default function LandingPage({ onTriggerToast }) {
  const navigate = useNavigate();

  // Search input state
  const [searchLocation, setSearchLocation] = useState('');

  // Authentication Modal State
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'
  const [showPassword, setShowPassword] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPhone, setRegisterPhone] = useState('');
  const [registerCity, setRegisterCity] = useState('Bengaluru');
  const [registerStoreId, setRegisterStoreId] = useState('ST-BLR-01');
  const [registerTier, setRegisterTier] = useState('GOLD');
  const [registerPassword, setRegisterPassword] = useState('');

  // Live countdown timer for Today's Spotlight Deals
  const [timeLeft, setTimeLeft] = useState({ hours: 3, minutes: 24, seconds: 18 });

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev.seconds > 0) {
          return { ...prev, seconds: prev.seconds - 1 };
        } else if (prev.minutes > 0) {
          return { ...prev, minutes: 59, seconds: 59 };
        } else if (prev.hours > 0) {
          return { hours: prev.hours - 1, minutes: 59, seconds: 59 };
        }
        return prev;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDigits = (num) => String(num).padStart(2, '0');

  const handleExploreStores = (loc) => {
    const query = loc || searchLocation || 'Indiranagar Flagship';
    if (onTriggerToast) {
      onTriggerToast(`Locating nearest stores in ${query}... Directing to live floor.`);
    }
    navigate('/');
  };

  const handleCategoryClick = (categoryName) => {
    if (onTriggerToast) {
      onTriggerToast(`Opening category: ${categoryName}`);
    }
    navigate('/');
  };

  const handleAddToCart = (productName, price) => {
    if (onTriggerToast) {
      onTriggerToast(`Added "${productName}" to shopping cart (₹${price.toLocaleString('en-IN')})`);
    }
  };

  const say = (message) => {
    if (onTriggerToast) onTriggerToast(message);
  };
  const firstProblem = (err) => err.details?.[0]?.message ?? err.message;

  // Login - POST /auth/login. A wrong password is an error, never a session.
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    const email = loginEmail.trim().toLowerCase();
    if (!email || !loginPassword) {
      say('Please enter both email and password.');
      return;
    }
    try {
      const user = await login(email, loginPassword);
      setShowAuthModal(false);
      say(`Welcome back, ${user.fullName}!`);
      navigate(homeFor(user.role));
    } catch (err) {
      say(err.status === 401 ? 'Incorrect email or password.' : firstProblem(err));
    }
  };

  // Register - POST /auth/register (new accounts start on the Standard tier)
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (!registerEmail || !registerPassword || !registerName) {
      say('Please fill in all required fields.');
      return;
    }
    if (registerPassword.length < 8) {
      say('Password must be at least 8 characters.');
      return;
    }
    try {
      const user = await register({
        fullName: registerName.trim(),
        email: registerEmail.trim().toLowerCase(),
        password: registerPassword,
        phone: registerPhone.trim() || undefined,
        city: registerCity.trim() || undefined,
        country: 'IN',
        preferredStoreId: registerStoreId,
      });
      setShowAuthModal(false);
      say(`Account created for ${user.fullName}! Welcome to NovaMart.`);
      navigate(homeFor(user.role));
    } catch (err) {
      say(`Registration: ${firstProblem(err)}`);
    }
  };

  // 1-Click demo logins sign in to the seeded demo accounts on the backend.
  const handleQuickPersonaLogin = async (persona) => {
    setShowAuthModal(false);
    if (persona === 'admin') {
      // The admin portal has no login: it opens only on an authorised admin PC.
      await logout();
      navigate('/admin');
      return;
    }
    const email = persona === 'storemanager' ? 'manager.blr01@novamart.com' : 'meera.iyer@example.com';
    try {
      const user = await login(email, 'Passw0rd!');
      say(`Logged in as ${user.fullName}`);
      navigate(homeFor(user.role));
    } catch (err) {
      say(firstProblem(err));
    }
  };

  // Categories data matching reference screenshot
  const categories = [
    {
      id: 1,
      name: 'Fresh Fruits & Farm Vegetables',
      desc: 'Direct from local peri-urban farm collectives daily.',
      count: '420+ Items available',
      badge: 'Up to 35% Off',
      badgeClass: 'green',
      iconClass: 'green',
      icon: <Apple size={22} />
    },
    {
      id: 2,
      name: 'Daily Dairy, Bakery & Eggs',
      desc: 'A2 milk, artisan sourdough, and farm-laid eggs.',
      count: '210+ Fresh Items',
      badge: 'Daily Fresh',
      badgeClass: 'blue',
      iconClass: 'blue',
      icon: <Milk size={22} />
    },
    {
      id: 3,
      name: 'Consumer Electronics & Tech',
      desc: 'Chargers, wireless audio, peripherals & smart home.',
      count: '850+ Gadgets',
      badge: 'Up to 40% Off',
      badgeClass: 'purple',
      iconClass: 'purple',
      icon: <Smartphone size={22} />
    },
    {
      id: 4,
      name: 'Personal Care & Wellness',
      desc: 'Dermatologist-approved skincare, hygiene & vitamins.',
      count: '640+ Derm-Approved',
      badge: 'Trending',
      badgeClass: 'purple',
      iconClass: 'lavender',
      icon: <Flower2 size={22} />
    },
    {
      id: 5,
      name: 'Gourmet Snacks & Beverages',
      desc: 'Artisan confectionery, imported chocolates & roasted crisps.',
      count: '520+ Treats',
      badge: 'Buy 2 Get 1',
      badgeClass: 'blue',
      iconClass: 'blue',
      icon: <Coffee size={22} />
    },
    {
      id: 6,
      name: 'Home Care & Organic Living',
      desc: 'Non-toxic home cleaners, compostable tableware & refills.',
      count: '380+ Eco Choices',
      badge: 'Zero Plastic',
      badgeClass: 'green',
      iconClass: 'cyan',
      icon: <Leaf size={22} />
    }
  ];

  // Today's Spotlight Deals matching reference screenshot
  const spotlightDeals = [
    {
      id: 'deal-1',
      title: 'Farm-Fresh Ratnagiri Alphonso Mangoes',
      category: 'ORCHARD FARM FRESH',
      sub: '1 Dozen (Approx. 2.4 kg)',
      price: 499,
      origPrice: 650,
      badge: '-23%',
      badgeType: 'red',
      statusTag: 'Fresh Batch',
      image: 'https://images.unsplash.com/photo-1553279768-865429fa0078?w=500&auto=format&fit=crop&q=80'
    },
    {
      id: 'deal-2',
      title: 'AeroFit Wireless Smart Earbuds ANC',
      category: 'ELECTRONICS AISLE',
      sub: '32h Battery • IPX5 Water Proof',
      price: 2499,
      origPrice: 3999,
      badge: '-37%',
      badgeType: 'red',
      statusTag: 'Tech Hub',
      image: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=500&auto=format&fit=crop&q=80'
    },
    {
      id: 'deal-3',
      title: 'Cold-Pressed Virgin Coconut Oil',
      category: 'PANTRY STAPLES',
      sub: '1L Glass Bottle • Wood Pressed',
      price: 340,
      origPrice: 420,
      badge: '-20%',
      badgeType: 'red',
      statusTag: '100% Pure',
      image: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=500&auto=format&fit=crop&q=80'
    },
    {
      id: 'deal-4',
      title: 'Artisan Sourdough Country Loaf',
      category: 'ARTISAN BAKERY',
      sub: '450 g • Naturally Fermented',
      price: 140,
      origPrice: 180,
      badge: 'Buy 1 Get 1',
      badgeType: 'blue',
      statusTag: 'Baked 6 AM',
      image: 'https://images.unsplash.com/photo-1586444248902-2f64eddc13df?w=500&auto=format&fit=crop&q=80'
    }
  ];

  return (
    <div className="landing-page-root">
      {/* --------------------------------------------------------------------
          TOP NAVBAR
          -------------------------------------------------------------------- */}
      <div className="landing-nav-wrapper">
        <header className="landing-navbar">
          <div className="landing-nav-left">
            <div className="landing-brand" onClick={() => navigate('/landing')}>
              <div className="landing-brand-logo-box">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <path d="M16 10a4 4 0 0 1-8 0" />
                </svg>
              </div>
              <span className="landing-brand-name">NovaMart</span>
            </div>

            <nav className="landing-nav-links">
              <button
                type="button"
                className="landing-nav-link"
                onClick={() => {
                  document.getElementById('categories-section')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                Categories
              </button>
              <button
                type="button"
                className="landing-nav-link"
                onClick={() => navigate('/')}
              >
                Stores
              </button>
              <button
                type="button"
                className="landing-nav-link"
                onClick={() => {
                  document.getElementById('deals-section')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                Offers
              </button>
            </nav>
          </div>

          <div className="landing-nav-right">
            <button
              type="button"
              className="landing-login-btn"
              onClick={() => {
                setAuthMode('login');
                setShowAuthModal(true);
              }}
            >
              Login
            </button>
            <button
              type="button"
              className="landing-signup-btn"
              onClick={() => {
                setAuthMode('register');
                setShowAuthModal(true);
              }}
            >
              Sign Up
            </button>
            <button
              type="button"
              className="landing-user-icon-btn"
              onClick={() => {
                setAuthMode('login');
                setShowAuthModal(true);
              }}
              title="Customer Profile & Sign In"
            >
              <User size={18} />
            </button>
          </div>
        </header>
      </div>

      {/* --------------------------------------------------------------------
          HERO SECTION
          -------------------------------------------------------------------- */}
      <section className="landing-hero-section">
        {/* Pill Badge */}
        <div className="hero-pill-badge">
          <span className="pill-dot-pair">
            <span className="pill-dot-orange" />
            <span className="pill-dot-blue" />
          </span>
          <span>NEXT-GEN HYPERLOCAL COMMERCE • 10-MINUTE AI DISPATCH</span>
        </div>

        {/* Big Bold Headline */}
        <h1 className="hero-headline">
          Your Neighborhood Store.
          <span className="hero-headline-accent">Smarter Shopping.</span>
        </h1>

        {/* Subtitle */}
        <p className="hero-description">
          Experience AI-powered grocery and essentials shopping. NovaMart bridges your trusted neighborhood hypermarkets with real-time inventory intelligence, instant AI recommendations, and rapid 10-minute doorstep delivery.
        </p>

        {/* Search Bar / Store Finder */}
        <form
          className="hero-search-container"
          onSubmit={(e) => {
            e.preventDefault();
            handleExploreStores(searchLocation);
          }}
        >
          <MapPin size={18} color="#2563EB" />
          <input
            type="text"
            className="hero-search-input"
            placeholder="Enter your pincode, locality, or landmark (e.g., Indiranagar, Bengaluru)"
            value={searchLocation}
            onChange={(e) => setSearchLocation(e.target.value)}
          />
          <button type="submit" className="hero-search-btn">
            <span>Explore Nearby Stores</span>
            <ArrowRight size={14} />
          </button>
        </form>

        {/* Popular Areas */}
        <div className="popular-areas-row">
          <span>Popular Areas:</span>
          <span className="popular-area-pill" onClick={() => handleExploreStores('Indiranagar Flagship')}>
            📍 Indiranagar Flagship
          </span>
          <span>•</span>
          <span className="popular-area-pill" onClick={() => handleExploreStores('Koramangala 4th Block')}>
            📍 Koramangala 4th Block
          </span>
          <span>•</span>
          <span className="popular-area-pill" onClick={() => handleExploreStores('Whitefield ITPB')}>
            📍 Whitefield ITPB
          </span>
          <span>•</span>
          <span className="popular-area-pill" onClick={() => handleExploreStores('HSR Sector 1')}>
            📍 HSR Sector 1
          </span>
        </div>

        {/* 3 Counter / Metric Cards */}
        <div className="hero-stat-badges-row">
          <div className="stat-badge-card">
            <div className="stat-icon-wrapper blue">
              <Sparkles size={20} />
            </div>
            <div>
              <div className="stat-main-number">45+ Hubs</div>
              <div className="stat-sub-label">Micro-fulfillment Network</div>
            </div>
          </div>

          <div className="stat-badge-card">
            <div className="stat-icon-wrapper green">
              <CheckCircle2 size={20} />
            </div>
            <div>
              <div className="stat-main-number">15,000+ SKUs</div>
              <div className="stat-sub-label">Live-Verified Inventory</div>
            </div>
          </div>

          <div className="stat-badge-card">
            <div className="stat-icon-wrapper purple">
              <Clock size={20} />
            </div>
            <div>
              <div className="stat-main-number">99.4% On-Time</div>
              <div className="stat-sub-label">AI-Optimized Routing</div>
            </div>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------------------
          MAIN CONTENT CONTAINER
          -------------------------------------------------------------------- */}
      <div className="landing-content-container">
        {/* 1. POPULAR SHOPPING CATEGORIES */}
        <section id="categories-section">
          <div className="landing-section-header">
            <div>
              <div className="landing-section-pretitle">EXPLORE CURATED AISLES</div>
              <h2 className="landing-section-title">Popular Shopping Categories</h2>
              <p className="landing-section-subtitle">
                Browse fresh groceries, electronics, and daily essentials across verified local merchants.
              </p>
            </div>
            <div className="landing-link-right" onClick={() => navigate('/')}>
              <span>View all 24 departments</span>
              <ArrowRight size={14} />
            </div>
          </div>

          <div className="categories-card-grid">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="category-row-card"
                onClick={() => handleCategoryClick(cat.name)}
              >
                <div>
                  <div className="category-card-top-row">
                    <div className={`cat-circle-icon ${cat.iconClass}`}>
                      {cat.icon}
                    </div>
                    <span className={`cat-pill-badge ${cat.badgeClass}`}>
                      {cat.badge}
                    </span>
                  </div>
                  <h3 className="cat-card-name">{cat.name}</h3>
                  <p className="cat-card-desc">{cat.desc}</p>
                </div>
                <div className="cat-card-footer">
                  <span>{cat.count}</span>
                  <ArrowRight size={13} />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 2. TODAY'S SPOTLIGHT DEALS */}
        <section id="deals-section">
          <div className="landing-section-header">
            <div>
              <div className="landing-section-pretitle red">TIME-SENSITIVE OFFERS</div>
              <h2 className="landing-section-title">Today's Spotlight Deals</h2>
              <p className="landing-section-subtitle">
                Live flash discounts sourced from neighborhood shelf rebalances.
              </p>
            </div>
            <div className="countdown-pill">
              <Clock size={13} />
              <span>
                Ends in {formatDigits(timeLeft.hours)}h : {formatDigits(timeLeft.minutes)}m : {formatDigits(timeLeft.seconds)}s
              </span>
            </div>
          </div>

          <div className="spotlight-deals-grid">
            {spotlightDeals.map((deal) => (
              <div key={deal.id} className="deal-product-card">
                <div className="deal-photo-box">
                  <img src={deal.image} alt={deal.title} className="deal-img" />
                  <span className={`deal-discount-badge ${deal.badgeType}`}>
                    {deal.badge}
                  </span>
                  <span className="deal-status-tag">{deal.statusTag}</span>
                </div>

                <div className="deal-card-body">
                  <span className="deal-category-label">{deal.category}</span>
                  <h4 className="deal-product-title">{deal.title}</h4>
                  <p className="deal-product-sub">{deal.sub}</p>

                  <div className="deal-footer-row">
                    <div className="deal-pricing">
                      <span className="deal-current-price">₹{deal.price.toLocaleString('en-IN')}</span>
                      <span className="deal-orig-price">₹{deal.origPrice.toLocaleString('en-IN')}</span>
                    </div>
                    <button
                      type="button"
                      className="btn-deal-add"
                      onClick={() => handleAddToCart(deal.title, deal.price)}
                    >
                      + Add
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 5. 4 TRUST / GUARANTEE BADGES */}
        <div className="landing-trust-strip">
          <div className="landing-trust-box">
            <div className="trust-badge-icon-box blue">
              <Zap size={20} />
            </div>
            <h4 className="trust-box-title">30-Min Fast Dispatch</h4>
            <p className="trust-box-desc">
              Autonomous dispatch models minimise waiting time with zero surge pricing.
            </p>
          </div>

          <div className="landing-trust-box">
            <div className="trust-badge-icon-box green">
              <Eye size={20} />
            </div>
            <h4 className="trust-box-title">100% Floor Transparency</h4>
            <p className="trust-box-desc">
              What you see is what is in stock. Real-time optical shelf verification.
            </p>
          </div>

          <div className="landing-trust-box">
            <div className="trust-badge-icon-box cyan">
              <Thermometer size={20} />
            </div>
            <h4 className="trust-box-title">Cold-Chain Integrity</h4>
            <p className="trust-box-desc">
              Insulated thermal transport bags ensure chilled products arrive cold.
            </p>
          </div>

          <div className="landing-trust-box">
            <div className="trust-badge-icon-box indigo">
              <RotateCcw size={20} />
            </div>
            <h4 className="trust-box-title">No-Questions 7-Day Return</h4>
            <p className="trust-box-desc">
              Instant digital refunds processed immediately back to your original payment.
            </p>
          </div>
        </div>
      </div>

      {/* --------------------------------------------------------------------
          FOOTER
          -------------------------------------------------------------------- */}
      <footer className="landing-footer-wrapper">
        <div className="landing-footer-inner">
          <div className="landing-footer-columns">
            {/* Brand Column */}
            <div>
              <div className="landing-brand" onClick={() => navigate('/landing')}>
                <div className="landing-brand-logo-box" style={{ width: '32px', height: '32px' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                    <line x1="3" y1="6" x2="21" y2="6" />
                    <path d="M16 10a4 4 0 0 1-8 0" />
                  </svg>
                </div>
                <span className="landing-brand-name" style={{ fontSize: '18px' }}>NovaMart</span>
              </div>
              <p className="footer-brand-summary">
                AI-powered hyper-local retail network delivering predictive convenience, live inventory, and neighborhood speed.
              </p>
            </div>

            {/* Col 2 */}
            <div>
              <div className="footer-col-title">EXPLORE STORES</div>
              <ul className="footer-link-list">
                <li className="footer-link-item" onClick={() => navigate('/')}>Neighborhood Stations</li>
                <li className="footer-link-item" onClick={() => navigate('/')}>Fresh Produce Hubs</li>
                <li className="footer-link-item" onClick={() => navigate('/')}>Curated Pharmacies</li>
                <li className="footer-link-item" onClick={() => navigate('/')}>Artisan Bakeries</li>
              </ul>
            </div>

            {/* Col 3 */}
            <div>
              <div className="footer-col-title">CUSTOMER CARE</div>
              <ul className="footer-link-list">
                <li className="footer-link-item" onClick={() => navigate('/')}>Help Center</li>
                <li className="footer-link-item" onClick={() => navigate('/')}>Track Live Delivery</li>
                <li className="footer-link-item" onClick={() => navigate('/')}>Live Chat Assistant</li>
                <li className="footer-link-item" onClick={() => navigate('/')}>Feedback & Reviews</li>
              </ul>
            </div>

            {/* Col 4 */}
            <div>
              <div className="footer-col-title">POLICIES & RETURNS</div>
              <ul className="footer-link-list">
                <li className="footer-link-item" onClick={() => navigate('/')}>Instant Refund Policy</li>
                <li className="footer-link-item" onClick={() => navigate('/')}>Terms of Service</li>
                <li className="footer-link-item" onClick={() => navigate('/')}>Privacy & AI Safeguards</li>
                <li className="footer-link-item" onClick={() => navigate('/')}>Merchant Standards</li>
              </ul>
            </div>

            {/* Col 5 */}
            <div>
              <div className="footer-col-title">COMPANY</div>
              <ul className="footer-link-list">
                <li className="footer-link-item" onClick={() => navigate('/')}>About NovaMart</li>
                <li className="footer-link-item" onClick={() => navigate('/')}>Retail AI Labs</li>
                <li className="footer-link-item" onClick={() => navigate('/')}>Partner as Merchant</li>
                <li className="footer-link-item" onClick={() => navigate('/')}>Careers</li>
              </ul>
            </div>
          </div>

          <div className="footer-bottom-bar">
            <span>© 2026 NovaMart Technologies Inc. All rights reserved.</span>
            <div className="platform-status-indicator">
              <span className="telemetry-dot" style={{ width: '6px', height: '6px' }} />
              <span>AI Platform Status: Normal</span>
            </div>
          </div>
        </div>
      </footer>

      {/* --------------------------------------------------------------------
          AUTH MODAL (LOGIN & SIGN UP / REGISTER)
          -------------------------------------------------------------------- */}
      {showAuthModal && (
        <div className="auth-modal-backdrop" onClick={() => setShowAuthModal(false)}>
          <div className="auth-modal-container" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="auth-modal-header">
              <div className="auth-header-brand">
                <div className="landing-brand-logo-box" style={{ width: '32px', height: '32px', borderRadius: '8px' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                    <line x1="3" y1="6" x2="21" y2="6" />
                    <path d="M16 10a4 4 0 0 1-8 0" />
                  </svg>
                </div>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A' }}>NovaMart Account</h3>
                  <div style={{ fontSize: '11px', color: '#64748B' }}>Hyperlocal Retail & Automated AI Shopping</div>
                </div>
              </div>
              <button
                type="button"
                className="auth-close-btn"
                onClick={() => setShowAuthModal(false)}
              >
                <X size={16} />
              </button>
            </div>

            {/* Tabs: Sign In vs Create Account */}
            <div className="auth-tabs-bar">
              <button
                type="button"
                className={`auth-tab-btn ${authMode === 'login' ? 'active' : ''}`}
                onClick={() => setAuthMode('login')}
              >
                Sign In
              </button>
              <button
                type="button"
                className={`auth-tab-btn ${authMode === 'register' ? 'active' : ''}`}
                onClick={() => setAuthMode('register')}
              >
                Create Account
              </button>
            </div>

            {/* Modal Body */}
            <div className="auth-modal-body">
              {/* Quick Persona Logins for Demo */}
              <div className="demo-logins-section">
                <div className="demo-logins-title">
                  <Sparkles size={13} />
                  <span>1-Click Hackathon Demo Logins:</span>
                </div>
                <div className="demo-chips-grid">
                  <button
                    type="button"
                    className="demo-chip-btn"
                    onClick={() => handleQuickPersonaLogin('customer')}
                    title="Sign in as Priya Sharma (Customer)"
                  >
                    🛒 Priya (Customer)
                  </button>
                  <button
                    type="button"
                    className="demo-chip-btn"
                    onClick={() => handleQuickPersonaLogin('storemanager')}
                    title="Sign in as Alex Morgan (Store Manager)"
                  >
                    🏬 Alex (Manager)
                  </button>
                  <button
                    type="button"
                    className="demo-chip-btn"
                    onClick={() => handleQuickPersonaLogin('admin')}
                    title="Sign in as Ops Admin"
                  >
                    🛡️ Admin Portal
                  </button>
                </div>
              </div>

              {authMode === 'login' ? (
                /* LOGIN FORM: Strictly Email and Password */
                <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div className="auth-form-group">
                    <label className="auth-field-label">Email</label>
                    <div className="auth-input-wrapper">
                      <Mail size={16} color="#94A3B8" />
                      <input
                        type="email"
                        className="auth-input-element"
                        placeholder="name@example.com"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        autoFocus
                        required
                      />
                    </div>
                  </div>

                  <div className="auth-form-group">
                    <label className="auth-field-label">Password</label>
                    <div className="auth-input-wrapper">
                      <Lock size={16} color="#94A3B8" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        className="auth-input-element"
                        placeholder="Enter your password"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        required
                      />
                      <button
                        type="button"
                        className="auth-toggle-pwd-btn"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div className="auth-row-options">
                    <label className="auth-checkbox-label">
                      <input type="checkbox" defaultChecked />
                      <span>Remember this device</span>
                    </label>
                    <span
                      className="auth-forgot-link"
                      onClick={() => {
                        if (onTriggerToast) onTriggerToast('Password reset link sent to registered email.');
                      }}
                    >
                      Forgot Password?
                    </span>
                  </div>

                  <button type="submit" className="auth-submit-btn">
                    <span>Sign In to NovaMart</span>
                    <ArrowRight size={15} />
                  </button>

                  <div className="auth-footer-note">
                    <Shield size={12} color="#059669" />
                    <span>Protected by NovaMart 256-bit Retail Encryption</span>
                  </div>
                </form>
              ) : (
                /* REGISTER FORM: Aligned with Backend Schema (backend/src/modules/auth/auth.schema.js) */
                <form onSubmit={handleRegisterSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div className="auth-form-group">
                    <label className="auth-field-label">Full Name *</label>
                    <div className="auth-input-wrapper">
                      <User size={16} color="#94A3B8" />
                      <input
                        type="text"
                        className="auth-input-element"
                        placeholder="e.g. Priya Sharma"
                        value={registerName}
                        onChange={(e) => setRegisterName(e.target.value)}
                        autoFocus
                        minLength={2}
                        maxLength={120}
                        required
                      />
                    </div>
                  </div>

                  <div className="auth-form-group">
                    <label className="auth-field-label">Email Address *</label>
                    <div className="auth-input-wrapper">
                      <Mail size={16} color="#94A3B8" />
                      <input
                        type="email"
                        className="auth-input-element"
                        placeholder="name@example.com"
                        value={registerEmail}
                        onChange={(e) => setRegisterEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="auth-form-group">
                    <label className="auth-field-label">Password * (Minimum 8 characters)</label>
                    <div className="auth-input-wrapper">
                      <Lock size={16} color="#94A3B8" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        className="auth-input-element"
                        placeholder="At least 8 characters"
                        value={registerPassword}
                        onChange={(e) => setRegisterPassword(e.target.value)}
                        minLength={8}
                        maxLength={128}
                        required
                      />
                      <button
                        type="button"
                        className="auth-toggle-pwd-btn"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div className="auth-form-group">
                      <label className="auth-field-label">Phone Number</label>
                      <div className="auth-input-wrapper">
                        <Phone size={15} color="#94A3B8" />
                        <input
                          type="tel"
                          className="auth-input-element"
                          placeholder="+91-98100-00001"
                          value={registerPhone}
                          onChange={(e) => setRegisterPhone(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="auth-form-group">
                      <label className="auth-field-label">City</label>
                      <div className="auth-input-wrapper">
                        <MapPin size={15} color="#94A3B8" />
                        <input
                          type="text"
                          className="auth-input-element"
                          placeholder="Bengaluru"
                          value={registerCity}
                          onChange={(e) => setRegisterCity(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div className="auth-form-group">
                      <label className="auth-field-label">Membership Tier</label>
                      <div className="auth-input-wrapper">
                        <select
                          className="auth-input-element"
                          value={registerTier}
                          onChange={(e) => setRegisterTier(e.target.value)}
                          style={{ cursor: 'pointer' }}
                        >
                          <option value="STANDARD">STANDARD (Free)</option>
                          <option value="SILVER">SILVER Tier</option>
                          <option value="GOLD">GOLD Tier (Popular)</option>
                          <option value="PLATINUM">PLATINUM VIP</option>
                        </select>
                      </div>
                    </div>

                    <div className="auth-form-group">
                      <label className="auth-field-label">Preferred Store</label>
                      <div className="auth-input-wrapper">
                        <select
                          className="auth-input-element"
                          value={registerStoreId}
                          onChange={(e) => setRegisterStoreId(e.target.value)}
                          style={{ cursor: 'pointer' }}
                        >
                          <option value="ST-BLR-01">ST-BLR-01 • Koramangala (Bengaluru)</option>
                          <option value="ST-DEL-01">ST-DEL-01 • Connaught Place (Delhi)</option>
                          <option value="ST-DEL-02">ST-DEL-02 • Rohini (Delhi)</option>
                          <option value="ST-GGN-01">ST-GGN-01 • Cyber Hub (Gurugram)</option>
                          <option value="ST-MUM-01">ST-MUM-01 • Andheri West (Mumbai)</option>
                          <option value="ST-MUM-02">ST-MUM-02 • Powai (Mumbai)</option>
                          <option value="ST-HYD-01">ST-HYD-01 • Gachibowli (Hyderabad)</option>
                          <option value="ST-CHN-01">ST-CHN-01 • T Nagar (Chennai)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <label className="auth-checkbox-label" style={{ fontSize: '11.5px', marginTop: '4px' }}>
                    <input type="checkbox" defaultChecked required />
                    <span>I agree to NovaMart Terms of Service & Privacy Policy</span>
                  </label>

                  <button type="submit" className="auth-submit-btn">
                    <span>Create Account (Backend Synchronized)</span>
                    <ArrowRight size={15} />
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
