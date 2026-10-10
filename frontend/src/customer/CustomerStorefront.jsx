import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  ShoppingCart,
  MapPin,
  Sparkles,
  TrendingUp,
  Zap,
  ShieldCheck,
  Snowflake,
  QrCode,
  ChevronDown,
  X,
  Check,
  Send,
  Bot,
  HelpCircle,
  LayoutGrid,
  CheckCircle2,
  Package,
  Tag,
  Store,
  SlidersHorizontal,
  ArrowRight
} from 'lucide-react';
import './CustomerStorefront.css';

export default function CustomerStorefront({ onTriggerToast }) {
  const navigate = useNavigate();

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [activeNav, setActiveNav] = useState('home');
  const [activeStore, setActiveStore] = useState('Indiranagar Flagship');
  const [showStoreModal, setShowStoreModal] = useState(false);

  // Cart Drawer State (Default preloaded with 3 items matching reference screenshot: 3 items • ₹2,450)
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [appliedVoucher, setAppliedVoucher] = useState('NOVAFRESH');
  const [cartItems, setCartItems] = useState([
    {
      id: 101,
      name: 'Farm-Fresh Alphonso Mangoes',
      subtitle: 'GI-tagged Ratnagiri origin (1 Dozen)',
      price: 499,
      originalPrice: 650,
      quantity: 1,
      image: 'https://images.unsplash.com/photo-1553279768-865429fa0078?w=300&auto=format&fit=crop&q=80'
    },
    {
      id: 102,
      name: 'AeroFit Wireless Earbuds ANC',
      subtitle: 'Active Noise Cancellation, 36hr battery',
      price: 2499,
      originalPrice: 3999,
      quantity: 1,
      image: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=300&auto=format&fit=crop&q=80'
    },
    {
      id: 103,
      name: 'Organic Cold-Pressed Coconut Oil',
      subtitle: '100% pure edible grade (500ml)',
      price: 340,
      originalPrice: 420,
      quantity: 1,
      image: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=300&auto=format&fit=crop&q=80'
    }
  ]);

  // AI Dialog / Policy Copilot Modal State
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiChatInput, setAiChatInput] = useState('');
  const [aiMessages, setAiMessages] = useState([
    {
      sender: 'bot',
      text: 'Namaste Priya! I am Nova AI, your Indiranagar Flagship shopping copilot. Ask me about store stock, instant delivery windows, allergen labels, or return policies!'
    }
  ]);

  // Stores available in dropdown
  const stores = [
    { id: 1, name: 'Indiranagar Flagship', address: '100 Feet Rd, HAL 2nd Stage, Bengaluru 560038', stock: '98.4%' },
    { id: 2, name: 'Koramangala Hypermarket', address: '80 Feet Rd, 4th Block, Bengaluru 560034', stock: '96.2%' },
    { id: 3, name: 'Whitefield Tech Zone', address: 'ITPB Main Rd, Whitefield, Bengaluru 560066', stock: '94.8%' },
    { id: 4, name: 'HSR Layout Hub', address: '27th Main Rd, Sector 1, HSR, Bengaluru 560102', stock: '97.5%' }
  ];

  // Featured Categories
  const categories = [
    {
      id: 'cat-1',
      name: 'Fruits & Veggies',
      count: '420+ Farm Fresh items',
      badge: 'From ₹40',
      badgeClass: 'cyan',
      image: 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=400&auto=format&fit=crop&q=80'
    },
    {
      id: 'cat-2',
      name: 'Dairy, Bakery & Eggs',
      count: '210+ Breakfast Items',
      badge: 'Daily Fresh',
      badgeClass: 'green',
      image: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400&auto=format&fit=crop&q=80'
    },
    {
      id: 'cat-3',
      name: 'Electronics & Tech',
      count: '850+ Verified Gadgets',
      badge: 'Up to 40% Off',
      badgeClass: 'red',
      image: 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=400&auto=format&fit=crop&q=80'
    },
    {
      id: 'cat-4',
      name: 'Personal Care & Wellness',
      count: '640+ Derm-Approved',
      badge: 'Trending',
      badgeClass: 'amber',
      image: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=400&auto=format&fit=crop&q=80'
    },
    {
      id: 'cat-5',
      name: 'Snacks & Beverages',
      count: '520+ Gourmet Treats',
      badge: 'Buy 2 Get 1',
      badgeClass: 'blue',
      image: 'https://images.unsplash.com/photo-1599490659213-e2b9527bd087?w=400&auto=format&fit=crop&q=80'
    },
    {
      id: 'cat-6',
      name: 'Kitchen & Home',
      count: '380+ Sustainable Picks',
      badge: 'Eco Choice',
      badgeClass: 'emerald',
      image: 'https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=400&auto=format&fit=crop&q=80'
    }
  ];

  // Trending Products & Bestsellers
  const trendingProducts = [
    {
      id: 101,
      name: 'Farm-Fresh Alphonso...',
      fullName: 'Farm-Fresh Alphonso Mangoes (1 Dozen)',
      desc: 'Naturally ripened without carbide, GI-tagged Ratnagiri origin',
      price: 499,
      originalPrice: 650,
      saveAmount: 151,
      rating: '4.8 (1.2k)',
      badge: '23% OFF',
      badgeType: 'discount',
      stockStatus: 'In Stock (42 units at Indiranagar)',
      stockType: 'in-stock',
      image: 'https://images.unsplash.com/photo-1553279768-865429fa0078?w=500&auto=format&fit=crop&q=80'
    },
    {
      id: 102,
      name: 'AeroFit Wireless Earbuds ANC',
      fullName: 'AeroFit Wireless Earbuds ANC',
      desc: 'Active Noise Cancellation, 36hr battery & IPX5 splashproof',
      price: 2499,
      originalPrice: 3999,
      saveAmount: 1500,
      rating: '4.7 (890)',
      badge: '37% OFF',
      badgeType: 'discount',
      stockStatus: 'In Stock (18 units)',
      stockType: 'in-stock',
      image: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=500&auto=format&fit=crop&q=80'
    },
    {
      id: 103,
      name: 'Organic Cold-Pressed...',
      fullName: 'Organic Cold-Pressed Virgin Coconut Oil',
      desc: '100% pure edible grade, wood-pressed from Kerala coconuts',
      price: 340,
      originalPrice: 420,
      saveAmount: 80,
      rating: '4.9 (450)',
      badge: 'ORGANIC',
      badgeType: 'organic',
      stockStatus: 'In Stock (65 units)',
      stockType: 'in-stock',
      image: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=500&auto=format&fit=crop&q=80'
    },
    {
      id: 104,
      name: 'Artisan Sourdough Loaf...',
      fullName: 'Artisan Sourdough Loaf (400g)',
      desc: 'Wild fermented 36 hours, unbleached flour, no preservatives',
      price: 140,
      originalPrice: 160,
      saveAmount: 20,
      rating: '4.6 (310)',
      badge: 'BAKED TODAY',
      badgeType: 'baked',
      stockStatus: 'Only 4 left in store!',
      stockType: 'urgent',
      image: 'https://images.unsplash.com/photo-1586444248902-2f64eddc13df?w=500&auto=format&fit=crop&q=80'
    }
  ];

  // Recommended For You
  const recommendedProducts = [
    {
      id: 201,
      reason: 'Based on your healthy s...',
      name: 'NutriPure Roasted Californ...',
      fullName: 'NutriPure Roasted California Almonds (250g)',
      rating: '4.9',
      stock: 'In Stock at Indiranagar',
      price: 480,
      image: 'https://images.unsplash.com/photo-1508061252966-f72fb4029dd0?w=400&auto=format&fit=crop&q=80'
    },
    {
      id: 202,
      reason: 'Trending in Bengaluru E...',
      name: 'Smart Digital Air Fryer 4.5L',
      fullName: 'Smart Digital Air Fryer 4.5L Touchscreen',
      rating: '4.7',
      stock: 'In Stock at Indiranagar',
      price: 3799,
      originalPrice: 5499,
      image: 'https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?w=400&auto=format&fit=crop&q=80'
    },
    {
      id: 203,
      reason: 'Frequently bought with ...',
      name: 'HydraGlow Vitamin C Fac...',
      fullName: 'HydraGlow Vitamin C Face Serum (30ml)',
      rating: '4.8',
      stock: 'In Stock at Indiranagar',
      price: 599,
      image: 'https://images.unsplash.com/photo-1608248597359-59756b106200?w=400&auto=format&fit=crop&q=80'
    },
    {
      id: 204,
      reason: 'Reorder reminder (Purch...',
      name: 'EcoClean Plant-Based...',
      fullName: 'EcoClean Plant-Based Detergent Liquid (2L)',
      rating: '4.6',
      stock: 'In Stock at Indiranagar',
      price: 399,
      image: 'https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?w=400&auto=format&fit=crop&q=80'
    }
  ];

  // Cart operations
  const totalItemCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);
  const subtotal = cartItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
  // Gold Member Discount & Coupon applied
  const memberDiscount = subtotal > 1498 ? 350 : 0;
  const couponDiscount = appliedVoucher === 'NOVAFRESH' ? Math.round(subtotal * 0.15) : 0;
  const totalAmount = Math.max(0, subtotal - memberDiscount - couponDiscount);

  const handleAddToCart = (item) => {
    setCartItems(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, {
        id: item.id,
        name: item.fullName || item.name,
        subtitle: item.desc || item.stock || 'Fresh in store',
        price: item.price,
        originalPrice: item.originalPrice || item.price,
        quantity: 1,
        image: item.image
      }];
    });

    if (onTriggerToast) {
      onTriggerToast(`Added "${item.name}" to cart (₹${item.price.toLocaleString('en-IN')})`);
    }
  };

  const updateQuantity = (id, delta) => {
    setCartItems(prev => {
      return prev.map(item => {
        if (item.id === id) {
          const newQty = item.quantity + delta;
          return newQty > 0 ? { ...item, quantity: newQty } : null;
        }
        return item;
      }).filter(Boolean);
    });
  };

  const handleQuickPromptClick = (prompt) => {
    setSearchQuery(prompt);
    if (onTriggerToast) {
      onTriggerToast(`Filtered catalog for: "${prompt}"`);
    }
  };

  const handleCopyVoucher = () => {
    navigator.clipboard?.writeText('NOVAFRESH');
    setAppliedVoucher('NOVAFRESH');
    if (onTriggerToast) {
      onTriggerToast('Voucher code NOVAFRESH copied & applied to your cart!');
    }
  };

  const handleAiSearchSubmit = (e) => {
    if (e) e.preventDefault();
    if (!aiChatInput.trim()) return;

    const userText = aiChatInput;
    setAiMessages(prev => [...prev, { sender: 'user', text: userText }]);
    setAiChatInput('');

    setTimeout(() => {
      let reply = `Checking live stock at ${activeStore}... We have high availability with express 11-minute dispatch!`;
      const lower = userText.toLowerCase();
      if (lower.includes('shoe') || lower.includes('running')) {
        reply = 'Found 6 models of ergonomic running shoes under ₹3,000 at Indiranagar Flagship, including Nike Revolution 6 (₹2,799) and Puma Flyer Flex (₹2,499). Available in Aisle 4B!';
      } else if (lower.includes('protein') || lower.includes('snack')) {
        reply = 'Top high-protein snacks today: NutriPure California Almonds (₹480), Yoga Bar 20g Whey Protein Bars (₹120), and Organic Roasted Makhana (₹145). Direct harvest, 100% clean!';
      } else if (lower.includes('coffee') || lower.includes('arabica')) {
        reply = 'Blue Tokai Estate Arabica & Sleepy Owl Cold Brew beans are fresh roasted in Karnataka within the last 48 hours. Eligible for instant pickup Bay #4!';
      } else if (lower.includes('return') || lower.includes('policy')) {
        reply = 'NovaMart provides a No-Questions 7-Day Return Policy on all groceries and packaged essentials, with instant refunds to Nova Wallet or your original UPI/card!';
      }
      setAiMessages(prev => [...prev, { sender: 'bot', text: reply }]);
    }, 550);
  };

  return (
    <div className="storefront-wrapper">
      {/* --------------------------------------------------------------------
          TOP NAVBAR HEADER (Matching Screenshot Header)
          -------------------------------------------------------------------- */}
      <header className="novamart-header">
        <div className="header-left">
          {/* Logo Brand */}
          <div className="brand-badge" onClick={() => navigate('/')}>
            <div className="brand-logo-box">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
            </div>
            <span className="brand-name">NovaMart</span>
          </div>

          <div className="header-divider" />

          {/* Store Location Selector */}
          <div className="store-location-info">
            <div className="store-title-row">
              <span className="store-name">NovaMart Hypermarket — {activeStore}</span>
              <button
                type="button"
                className="switch-store-btn"
                onClick={() => setShowStoreModal(true)}
              >
                Switch Store <ChevronDown size={11} />
              </button>
            </div>
            <div className="store-address-row">
              <MapPin size={11} className="address-pin" />
              <span>100 Feet Rd, HAL 2nd Stage, Indiranagar, Bengaluru, Karnataka 560038</span>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="header-search-bar">
          <Search size={16} color="#94A3B8" />
          <input
            type="text"
            className="search-input-field"
            placeholder="Search products, brands, or categories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (onTriggerToast) onTriggerToast(`Searching for "${searchQuery}" across 15,000+ items`);
              }
            }}
          />
          <button
            type="button"
            className="search-submit-btn"
            onClick={() => {
              if (onTriggerToast) onTriggerToast(`Searching for "${searchQuery || 'fresh items'}"`);
            }}
          >
            Search
          </button>
          <button
            type="button"
            className="ai-search-btn"
            onClick={() => setIsAiModalOpen(true)}
          >
            <Sparkles size={13} />
            <span>AI Search</span>
          </button>
        </div>

        {/* Header Right (Cart Badge & Priya Sharma Profile) */}
        <div className="header-right">
          <button
            type="button"
            className="cart-icon-btn"
            onClick={() => setIsCartOpen(true)}
            title="Open Shopping Cart"
          >
            <ShoppingCart size={19} />
            <span className="cart-badge-count">{totalItemCount}</span>
          </button>

          <div className="user-profile-pill" onClick={() => setIsAiModalOpen(true)}>
            <div className="user-avatar-circle">
              <span style={{ fontSize: '12px', fontWeight: '800' }}>PS</span>
            </div>
            <div className="user-info-text">
              <span className="user-name">Priya Sharma</span>
              <span className="user-tier">
                Gold Member <ChevronDown size={10} />
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* --------------------------------------------------------------------
          BODY: Sidebar + Main Content Stream
          -------------------------------------------------------------------- */}
      <div className="storefront-body-layout">
        {/* LEFT SIDEBAR (Marketplace Nav) */}
        <aside className="marketplace-sidebar">
          <div>
            <div className="sidebar-section-title">MARKETPLACE</div>
            <ul className="sidebar-nav-list">
              <li>
                <button
                  type="button"
                  className={`sidebar-nav-item ${activeNav === 'home' ? 'active' : ''}`}
                  onClick={() => setActiveNav('home')}
                >
                  <Store size={16} />
                  <span>Home</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className={`sidebar-nav-item ${activeNav === 'categories' ? 'active' : ''}`}
                  onClick={() => setActiveNav('categories')}
                >
                  <LayoutGrid size={16} />
                  <span>Categories</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className={`sidebar-nav-item ${activeNav === 'brands' ? 'active' : ''}`}
                  onClick={() => setActiveNav('brands')}
                >
                  <CheckCircle2 size={16} />
                  <span>Brands</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className={`sidebar-nav-item ${activeNav === 'orders' ? 'active' : ''}`}
                  onClick={() => setActiveNav('orders')}
                >
                  <Package size={16} />
                  <span>My Orders</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className={`sidebar-nav-item ${activeNav === 'offers' ? 'active' : ''}`}
                  onClick={() => setActiveNav('offers')}
                >
                  <Tag size={16} />
                  <span>Offers</span>
                  <span className="badge-hot">HOT</span>
                </button>
              </li>
            </ul>
          </div>

          <div className="sidebar-bottom-panel">
            <button
              type="button"
              className="sidebar-nav-item"
              onClick={() => setIsAiModalOpen(true)}
            >
              <HelpCircle size={16} />
              <span>Help & Support</span>
            </button>

            {/* Operating Hours Card */}
            <div className="store-hours-card">
              <div className="hours-label">Store Operating Hours</div>
              <div className="hours-value">07:00 AM – 11:00 PM</div>
              <div className="hours-status">
                <span className="status-green-dot" />
                <span>Open Now</span>
              </div>
            </div>
          </div>
        </aside>

        {/* MAIN STREAM CONTENT */}
        <main className="storefront-main-stream">
          {/* 1. Realtime Status Ribbon */}
          <div className="realtime-status-ribbon">
            <div className="ribbon-left">
              <span className="live-indicator-dot" />
              <span>
                <strong className="ribbon-bold">Store #104</strong> • Indiranagar Flagship Realtime Floor Stock:{' '}
                <strong>98.4% Available</strong> • Instant Pickup Bay #4 Ready
              </span>
            </div>
            <div className="ribbon-right">
              <Zap size={14} color="#2563EB" />
              <span>Avg Express Dispatch: 11 mins</span>
            </div>
          </div>

          {/* 2. Hero Greeting & Quick Prompts */}
          <div className="hero-greeting-section">
            <div className="privilege-tier-pill">
              <Tag size={12} />
              <span>PRIYA • GOLD PRIVILEGE TIER ACTIVE</span>
            </div>
            <h1 className="greeting-headline">What are you shopping for today, Priya?</h1>
            <p className="greeting-subtext">
              Explore 15,000+ groceries, fresh essentials & tech with express 30-minute delivery from Indiranagar Flagship.
            </p>

            <div className="quick-prompts-row">
              <span className="prompts-label">QUICK PROMPTS:</span>
              <button
                type="button"
                className="quick-prompt-chip"
                onClick={() => handleQuickPromptClick('Running shoes under ₹3,000')}
              >
                🏃 Running shoes under ₹3,000
              </button>
              <button
                type="button"
                className="quick-prompt-chip"
                onClick={() => handleQuickPromptClick('Healthy high-protein snacks')}
              >
                🥗 Healthy high-protein snacks
              </button>
              <button
                type="button"
                className="quick-prompt-chip"
                onClick={() => handleQuickPromptClick('Arabica coffee beans')}
              >
                ☕ Arabica coffee beans
              </button>
              <button
                type="button"
                className="quick-prompt-chip"
                onClick={() => handleQuickPromptClick('Gentle sunscreen SPF 50+')}
              >
                🧴 Gentle sunscreen SPF 50+
              </button>
            </div>
          </div>

          {/* 3. Mega Promotion Banner (Weekend Super Saver) */}
          <div className="mega-promo-banner">
            <div className="banner-left">
              <div className="banner-tag-row">
                <span className="tag-weekend-saver">WEEKEND SUPER SAVER</span>
                <span className="tag-lightning-delivery">
                  <Zap size={12} /> Lightning Delivery in 24 mins to HAL 2nd Stage
                </span>
              </div>
              <h2 className="banner-title">
                Up to 45% OFF on Fresh Organics, Farm Greens & Daily Dairy
              </h2>
              <p className="banner-desc">
                Curated directly from verified local Karnataka estates. Guaranteed harvest within 18 hours, cold-chain preserved directly to your table.
              </p>
              <div className="banner-action-row">
                <button
                  type="button"
                  className="voucher-pill"
                  onClick={handleCopyVoucher}
                  title="Click to copy voucher code"
                >
                  <span>Use Voucher Code:</span>
                  <span className="voucher-code">NOVAFRESH</span>
                </button>
                <button
                  type="button"
                  className="shop-offers-btn"
                  onClick={() => {
                    if (onTriggerToast) onTriggerToast('Unlocked 45% weekend deals across Dairy & Produce!');
                  }}
                >
                  Shop Offers Now
                </button>
              </div>
            </div>

            <div className="banner-right-stats">
              <div className="promo-stat-card">
                <span className="stat-label">Fresh Batches Today</span>
                <span className="stat-value">420+</span>
                <span className="stat-footer">
                  <Check size={12} /> 100% Residue-Free
                </span>
              </div>
              <div className="promo-stat-card">
                <span className="stat-label">Instant Member Off</span>
                <span className="stat-value">₹350</span>
                <span className="stat-footer" style={{ color: '#E2E8F0' }}>
                  On cart &gt; ₹1,498
                </span>
              </div>
            </div>
          </div>

          {/* 4. Featured Categories (PRIYA'S PANTRY & LIFESTYLE) */}
          <section className="categories-section">
            <div className="section-header-row">
              <div>
                <div className="section-pre-title">PRIYA'S PANTRY & LIFESTYLE</div>
                <h3 className="section-main-title">Featured Categories</h3>
              </div>
              <div
                className="view-all-link"
                onClick={() => {
                  if (onTriggerToast) onTriggerToast('Browsing all 24 retail departments...');
                }}
              >
                <span>View all 24 departments</span>
                <ArrowRight size={14} />
              </div>
            </div>

            <div className="categories-grid">
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  className="category-card"
                  onClick={() => {
                    if (onTriggerToast) onTriggerToast(`Browsing category: ${cat.name}`);
                  }}
                >
                  <div className="category-image-wrap">
                    <img src={cat.image} alt={cat.name} className="category-img" />
                    <span className={`category-badge-pill ${cat.badgeClass}`}>{cat.badge}</span>
                  </div>
                  <div className="category-info">
                    <h4 className="category-name">{cat.name}</h4>
                    <span className="category-count">{cat.count}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 5. Trending Products & Bestsellers */}
          <section className="trending-section">
            <div className="section-header-row">
              <div>
                <h3 className="section-main-title">
                  <TrendingUp size={20} color="#2563EB" />
                  <span>Trending Products & Bestsellers</span>
                </h3>
                <p className="section-subtitle">
                  Most ordered by Indiranagar residents in the last 48 hours
                </p>
              </div>
            </div>

            <div className="products-grid-4">
              {trendingProducts.map((prod) => (
                <div key={prod.id} className="product-card">
                  <div className="product-card-top">
                    <img src={prod.image} alt={prod.fullName} className="product-photo" />
                    <span className={`product-tag-discount ${prod.badgeType}`}>
                      {prod.badge}
                    </span>
                    <span className="product-tag-rating">
                      ★ {prod.rating}
                    </span>
                  </div>
                  <div className="product-card-body">
                    <div className={`product-stock-status ${prod.stockType}`}>
                      {prod.stockType === 'urgent' ? '⏰ ' : '✔ '}
                      <span>{prod.stockStatus}</span>
                    </div>
                    <h4 className="product-title">{prod.name}</h4>
                    <p className="product-desc">{prod.desc}</p>
                    <div className="product-pricing-row">
                      <span className="price-current">₹{prod.price.toLocaleString('en-IN')}</span>
                      <span className="price-original">₹{prod.originalPrice.toLocaleString('en-IN')}</span>
                      <span className="price-saved">Save ₹{prod.saveAmount.toLocaleString('en-IN')}</span>
                    </div>
                    <button
                      type="button"
                      className="btn-add-cart"
                      onClick={() => handleAddToCart(prod)}
                    >
                      <ShoppingCart size={15} /> Add to Cart
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 6. Recommended for You (Powered by Nova AI) */}
          <section className="recommend-section">
            <div className="section-header-row">
              <div>
                <div className="flex-row items-center gap-2" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div className="brand-logo-box" style={{ width: '28px', height: '28px', borderRadius: '7px' }}>
                    <Sparkles size={15} />
                  </div>
                  <h3 className="section-main-title">
                    <span>Recommended for You</span>
                    <span className="nova-ai-pill">Powered by Nova AI</span>
                  </h3>
                </div>
                <p className="section-subtitle">
                  Neural recommendation model calibrated from your purchase history & Indiranagar micro-trends
                </p>
              </div>
              <div
                className="manage-pref-link"
                onClick={() => {
                  if (onTriggerToast) onTriggerToast('Opening AI Recommendation Preferences');
                }}
              >
                <span>Manage Preferences</span>
                <SlidersHorizontal size={13} />
              </div>
            </div>

            <div className="products-grid-4">
              {recommendedProducts.map((rec) => (
                <div key={rec.id} className="rec-card">
                  <div className="rec-image-box">
                    <img src={rec.image} alt={rec.fullName} className="rec-image" />
                    <span className="rec-reason-pill">{rec.reason}</span>
                    <span className="rec-rating-badge">★ {rec.rating}</span>
                  </div>
                  <div className="rec-body">
                    <h4 className="rec-title">{rec.name}</h4>
                    <div className="rec-stock-line">
                      <span>●</span> {rec.stock}
                    </div>
                    <div className="rec-footer-row">
                      <span className="rec-price">₹{rec.price.toLocaleString('en-IN')}</span>
                      <button
                        type="button"
                        className="rec-btn-add"
                        onClick={() => handleAddToCart(rec)}
                      >
                        + Add
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 7. Bottom Trust & Features Bar */}
          <div className="trust-features-strip">
            <div className="trust-item">
              <div className="trust-icon-box">
                <Zap size={20} />
              </div>
              <div>
                <h4 className="trust-title">Express 24-30 Min</h4>
                <p className="trust-desc">Dispatched from Indiranagar cold hub right to your door</p>
              </div>
            </div>

            <div className="trust-item">
              <div className="trust-icon-box">
                <ShieldCheck size={20} />
              </div>
              <div>
                <h4 className="trust-title">No-Questions 7-Day Return</h4>
                <p className="trust-desc">Instant refund to Nova Wallet or original payment mode</p>
              </div>
            </div>

            <div className="trust-item">
              <div className="trust-icon-box">
                <Snowflake size={20} />
              </div>
              <div>
                <h4 className="trust-title">Active Cold Chain</h4>
                <p className="trust-desc">Monitored 4°C chilled insulated bags for dairy & organics</p>
              </div>
            </div>

            <div className="trust-item">
              <div className="trust-icon-box">
                <QrCode size={20} />
              </div>
              <div>
                <h4 className="trust-title">Express Self-Pickup Bay</h4>
                <p className="trust-desc">Scan QR code at Bay #4 on 100 Feet Rd for zero-wait drive-thru</p>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* --------------------------------------------------------------------
          FLOATING ACTIONS (Ask Policy AI & Active Cart)
          -------------------------------------------------------------------- */}
      <div className="floating-actions-container">
        <button
          type="button"
          className="floating-policy-pill"
          onClick={() => setIsAiModalOpen(true)}
        >
          <Bot size={17} />
          <span>Ask Policy AI</span>
        </button>

        <button
          type="button"
          className="floating-cart-pill"
          onClick={() => setIsCartOpen(true)}
        >
          <ShoppingCart size={18} />
          <span>Cart ({totalItemCount} Items • ₹{totalAmount.toLocaleString('en-IN')})</span>
        </button>
      </div>

      {/* --------------------------------------------------------------------
          SLIDE-OVER CART DRAWER
          -------------------------------------------------------------------- */}
      {isCartOpen && (
        <div className="drawer-backdrop" onClick={() => setIsCartOpen(false)}>
          <div className="cart-drawer-panel" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <div className="drawer-title">
                <ShoppingCart size={19} color="#2563EB" />
                <span>Your Shopping Cart ({totalItemCount} items)</span>
              </div>
              <button
                type="button"
                className="drawer-close-btn"
                onClick={() => setIsCartOpen(false)}
              >
                <X size={17} />
              </button>
            </div>

            <div className="drawer-body-items">
              {cartItems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748B' }}>
                  <ShoppingCart size={40} style={{ opacity: 0.3, margin: '0 auto 12px' }} />
                  <p>Your cart is empty. Explore our featured categories!</p>
                </div>
              ) : (
                cartItems.map((item) => (
                  <div key={item.id} className="cart-drawer-item">
                    <img src={item.image} alt={item.name} className="cart-item-thumb" />
                    <div className="cart-item-details">
                      <div>
                        <div className="cart-item-name">{item.name}</div>
                        <div className="cart-item-sub">{item.subtitle}</div>
                      </div>
                      <div className="cart-item-qty-row">
                        <div className="qty-control">
                          <button
                            type="button"
                            className="qty-btn"
                            onClick={() => updateQuantity(item.id, -1)}
                          >
                            -
                          </button>
                          <span className="qty-count">{item.quantity}</span>
                          <button
                            type="button"
                            className="qty-btn"
                            onClick={() => updateQuantity(item.id, 1)}
                          >
                            +
                          </button>
                        </div>
                        <span className="cart-item-price">
                          ₹{(item.price * item.quantity).toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {cartItems.length > 0 && (
              <div className="drawer-footer-summary">
                <div className="summary-row">
                  <span>Subtotal</span>
                  <span>₹{subtotal.toLocaleString('en-IN')}</span>
                </div>
                {memberDiscount > 0 && (
                  <div className="summary-row discount">
                    <span>Gold Privilege Member Discount</span>
                    <span>-₹{memberDiscount.toLocaleString('en-IN')}</span>
                  </div>
                )}
                {couponDiscount > 0 && (
                  <div className="summary-row discount">
                    <span>Voucher ({appliedVoucher}) Applied</span>
                    <span>-₹{couponDiscount.toLocaleString('en-IN')}</span>
                  </div>
                )}
                <div className="summary-row">
                  <span>Delivery to HAL 2nd Stage</span>
                  <span style={{ color: '#059669', fontWeight: '700' }}>FREE (Express 24m)</span>
                </div>
                <div className="summary-row total">
                  <span>Total Payable</span>
                  <span style={{ color: '#1D4ED8' }}>₹{totalAmount.toLocaleString('en-IN')}</span>
                </div>

                <button
                  type="button"
                  className="drawer-checkout-btn"
                  onClick={() => {
                    if (onTriggerToast) {
                      onTriggerToast('Order placed! Express delivery assigned to Bay #4 dispatch.');
                    }
                    setIsCartOpen(false);
                  }}
                >
                  Proceed to Checkout • ₹{totalAmount.toLocaleString('en-IN')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------
          AI SEARCH & POLICY COPILOT MODAL
          -------------------------------------------------------------------- */}
      {isAiModalOpen && (
        <div className="modal-center-backdrop" onClick={() => setIsAiModalOpen(false)}>
          <div className="ai-dialog-box" onClick={(e) => e.stopPropagation()}>
            <div className="ai-dialog-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Sparkles size={18} />
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: '800' }}>Nova AI • Indiranagar Shopping Copilot</h3>
                  <div style={{ fontSize: '11px', opacity: 0.9 }}>
                    Grounding model active on Store #104 Inventory & Retail Policies
                  </div>
                </div>
              </div>
              <button
                type="button"
                style={{ background: 'transparent', border: 'none', color: '#FFFFFF', cursor: 'pointer' }}
                onClick={() => setIsAiModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="ai-dialog-chat-flow">
              {aiMessages.map((m, idx) => (
                <div key={idx} className={`chat-bubble-row ${m.sender}`}>
                  <div className="bubble-text">{m.text}</div>
                </div>
              ))}
            </div>

            <form onSubmit={handleAiSearchSubmit} className="ai-input-form">
              <input
                type="text"
                className="ai-text-input"
                placeholder="Ask about organic stock, shoe sizes, 7-day returns, or recipes..."
                value={aiChatInput}
                onChange={(e) => setAiChatInput(e.target.value)}
                autoFocus
              />
              <button type="submit" className="ai-send-btn">
                <Send size={15} />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------
          SWITCH STORE MODAL
          -------------------------------------------------------------------- */}
      {showStoreModal && (
        <div className="modal-center-backdrop" onClick={() => setShowStoreModal(false)}>
          <div className="ai-dialog-box" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
            <div className="ai-dialog-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Store size={18} />
                <h3 style={{ fontSize: '15px', fontWeight: '800' }}>Select Delivery Store</h3>
              </div>
              <button
                type="button"
                style={{ background: 'transparent', border: 'none', color: '#FFFFFF', cursor: 'pointer' }}
                onClick={() => setShowStoreModal(false)}
              >
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {stores.map((s) => (
                <div
                  key={s.id}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: activeStore === s.name ? '2px solid #2563EB' : '1px solid #E2E8F0',
                    background: activeStore === s.name ? '#EFF6FF' : '#FFFFFF',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                  onClick={() => {
                    setActiveStore(s.name);
                    setShowStoreModal(false);
                    if (onTriggerToast) onTriggerToast(`Switched store location to ${s.name}`);
                  }}
                >
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#0F172A' }}>{s.name}</div>
                    <div style={{ fontSize: '11px', color: '#64748B' }}>{s.address}</div>
                  </div>
                  <div style={{ fontSize: '11.5px', fontWeight: '700', color: '#059669', textAlign: 'right' }}>
                    {s.stock} Stock
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
