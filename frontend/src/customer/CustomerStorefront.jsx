import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  ShoppingCart,
  ShoppingBag,
  MapPin,
  Sparkles,
  TrendingUp,
  Zap,
  ShieldCheck,
  Snowflake,
  Volume2,
  ChevronDown,
  ChevronLeft,
  X,
  Check,
  Send,
  LayoutGrid,
  CheckCircle2,
  Truck,
  Tag,
  Store,
  Home,
  SlidersHorizontal,
  ArrowRight,
  User,
  Headphones,
  LogIn,
  LogOut,
  UserPlus
} from 'lucide-react';
import './CustomerStorefront.css';
import { api, logout, saveUser, getStoredUser } from '../api/client';

export default function CustomerStorefront({ onTriggerToast }) {
  const navigate = useNavigate();

  const say = useCallback((message) => {
    if (onTriggerToast) onTriggerToast(message);
  }, [onTriggerToast]);

  // Signed-in customer (the route guard guarantees there is one)
  const [currentUser, setCurrentUser] = useState(() => getStoredUser() ?? {});
  const [showUserMenu, setShowUserMenu] = useState(false);
  const firstName = (currentUser.fullName || 'there').split(' ')[0];
  const tierName = currentUser.membershipTier || 'STANDARD';

  useEffect(() => {
    const handleAuthChange = () => setCurrentUser(getStoredUser() ?? {});
    window.addEventListener('auth-state-changed', handleAuthChange);
    return () => window.removeEventListener('auth-state-changed', handleAuthChange);
  }, []);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState(null); // { slug, name }
  const [activeNav, setActiveNav] = useState('home');
  const [showStoreModal, setShowStoreModal] = useState(false);

  // Stores - GET /stores. The chosen one is the customer's preferredStoreId.
  const [stores, setStores] = useState([]);
  useEffect(() => {
    let cancelled = false;
    api
      .get('/stores', { type: 'STORE', size: 100 })
      .then((list) => {
        if (cancelled) return;
        setStores(
          list.map((st) => ({
            id: st.id,
            name: st.name.replace('NovaMart ', ''),
            address: [st.address.line, st.address.city, st.address.state, st.address.postalCode].filter(Boolean).join(', '),
            stock: `${(st.unitsInStock ?? 0).toLocaleString('en-IN')} units`,
            hours: st.hours ? `${st.hours.opensAt.slice(0, 5)} – ${st.hours.closesAt.slice(0, 5)}` : null,
          }))
        );
      })
      .catch((err) => say(err.message));
    return () => {
      cancelled = true;
    };
  }, [say]);

  const activeStoreId = currentUser.preferredStoreId ?? stores[0]?.id ?? null;
  const activeStoreInfo = stores.find((st) => st.id === activeStoreId) ?? null;
  const activeStore = activeStoreInfo?.name ?? 'Choose a store';

  // Switching store saves it on the customer's profile - PATCH /auth/me
  const handleSwitchStore = async (store) => {
    setShowStoreModal(false);
    try {
      const user = await api.patch('/auth/me', { preferredStoreId: store.id });
      saveUser(user);
      say(`Switched store to ${store.name}`);
    } catch (err) {
      say(err.message);
    }
  };

  // Cart - lives on the backend (GET /cart), so it survives reloads and devices
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [cart, setCart] = useState(null);
  const reloadCart = useCallback(() => api.get('/cart').then(setCart).catch(() => setCart(null)), []);
  useEffect(() => {
    reloadCart();
  }, [reloadCart, activeStoreId]);

  const cartItems = (cart?.items ?? []).map((item) => ({
    id: item.productId,
    name: item.name,
    subtitle:
      item.availability?.status === 'OUT_OF_STOCK'
        ? 'Out of stock at your store'
        : item.availability?.status === 'LOW_STOCK'
          ? `${item.brandName} • only ${item.availability.quantityAvailable} left`
          : item.brandName,
    price: item.unitPrice,
    originalPrice: item.mrp ?? item.unitPrice,
    quantity: item.quantity,
    image: item.image,
  }));

  // Checkout options
  const [fulfillment, setFulfillment] = useState('IN_STORE_PICKUP');
  const [deliverySpeed, setDeliverySpeed] = useState('STANDARD');
  const [address, setAddress] = useState({ line: '', city: '', postalCode: '' });
  const [placingOrder, setPlacingOrder] = useState(false);
  // One key per checkout attempt, so a double click cannot place two orders.
  const checkoutKey = useRef(null);

  // Orders - GET /orders
  const [orders, setOrders] = useState([]);
  const reloadOrders = useCallback(
    () => api.get('/orders', { size: 20 }).then(setOrders).catch((err) => say(err.message)),
    [say]
  );
  useEffect(() => {
    if (activeNav === 'orders') reloadOrders();
  }, [activeNav, reloadOrders]);

  // AI Dialog / Policy Copilot Modal State
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiChatInput, setAiChatInput] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMessages, setAiMessages] = useState([
    {
      sender: 'bot',
      text: `Namaste ${firstName}! I am Nova AI. Ask me for product recommendations ("laptop for Java development under 1 lakh") or about returns, warranty and delivery policies.`
    }
  ]);

  // Featured Categories - GET /categories (pictures are decorative, picked by position)
  const CATEGORY_IMAGES = [
    'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=400&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=400&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=400&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=400&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1599490659213-e2b9527bd087?w=400&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400&auto=format&fit=crop&q=80',
  ];
  const BADGE_CLASSES = ['red', 'emerald', 'amber', 'cyan', 'blue', 'green'];
  const [categories, setCategories] = useState([]);
  useEffect(() => {
    let cancelled = false;
    api
      .get('/categories', { tree: true })
      .then((tree) => {
        if (cancelled) return;
        // Top-level departments first, then their sub-categories, six cards in all.
        const flat = [...tree, ...tree.flatMap((parent) => parent.children)];
        setCategories(
          flat.slice(0, 6).map((cat, index) => {
            const count = cat.children
              ? cat.children.reduce((n, child) => n + child.productCount, cat.productCount)
              : cat.productCount;
            return {
              id: cat.id,
              slug: cat.slug,
              name: cat.name,
              count: `${count} products`,
              badge: cat.children ? `${cat.children.length} sections` : 'Shop now',
              badgeClass: BADGE_CLASSES[index % BADGE_CLASSES.length],
              image: CATEGORY_IMAGES[index % CATEGORY_IMAGES.length],
            };
          })
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Brands - GET /brands
  const [brands, setBrands] = useState([]);
  useEffect(() => {
    let cancelled = false;
    api
      .get('/brands')
      .then((res) => {
        if (cancelled) return;
        const list = Array.isArray(res) ? res : res.data ?? [];
        if (list.length > 0) setBrands(list.slice(0, 14));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Product cards - GET /products, with stock at the chosen store
  const shorten = (text, max) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);
  const toCard = useCallback(
    (p) => {
      const stock = p.storeStock ?? p.stock;
      const qty = p.storeStock?.quantityAvailable;
      const where = activeStoreInfo?.name ?? 'your store';
      const ratings = p.ratingCount >= 1000 ? `${(p.ratingCount / 1000).toFixed(1)}k` : p.ratingCount;
      return {
        id: p.id,
        name: shorten(p.name, 30),
        fullName: p.name,
        desc: p.description ?? '',
        price: p.price,
        originalPrice: p.mrp ?? p.price,
        saveAmount: Math.max(0, (p.mrp ?? p.price) - p.price),
        rating: `${p.rating.toFixed(1)} (${ratings})`,
        badge: p.discountPercent > 0 ? `${p.discountPercent}% OFF` : p.brand.name.toUpperCase(),
        badgeType: p.discountPercent > 0 ? 'discount' : 'organic',
        stockStatus:
          stock.availability === 'OUT_OF_STOCK'
            ? `Out of stock at ${where}`
            : stock.availability === 'LOW_STOCK'
              ? `Only ${qty} left at ${where}`
              : qty != null
                ? `In Stock (${qty} units at ${where})`
                : 'In Stock',
        stockType: stock.availability === 'IN_STOCK' ? 'in-stock' : 'urgent',
        outOfStock: stock.availability === 'OUT_OF_STOCK',
        stock: stock.availability === 'OUT_OF_STOCK' ? `Out of stock at ${where}` : `In Stock at ${where}`,
        image: p.images?.[0],
      };
    },
    [activeStoreInfo]
  );

  const [trendingProducts, setTrendingProducts] = useState([]);
  const [productTotal, setProductTotal] = useState(0);
  const [productsLoading, setProductsLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    setProductsLoading(true);
    api
      .getPage(
        '/products',
        {
          q: appliedSearch,
          categorySlug: activeCategory?.slug,
          storeId: activeStoreId,
          sort: appliedSearch ? 'relevance' : 'rating_desc',
          size: appliedSearch || activeCategory ? 12 : 8,
        },
        { signal: controller.signal }
      )
      .then(({ items, meta }) => {
        setTrendingProducts(items.map(toCard));
        setProductTotal(meta.totalItems);
        setProductsLoading(false);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setProductsLoading(false);
        say(err.message);
      });
    return () => controller.abort();
  }, [appliedSearch, activeCategory, activeStoreId, toCard, say]);

  // Recommended For You - the customer's saved preferences applied to the catalogue
  const [recommendedProducts, setRecommendedProducts] = useState([]);
  useEffect(() => {
    let cancelled = false;
    const prefs = currentUser.preferences ?? {};
    const hasPrefs = prefs.categories?.length || prefs.brands?.length;
    const base = { storeId: activeStoreId, inStockOnly: true, sort: 'rating_desc', size: 4 };
    const personal = hasPrefs
      ? api.get('/products', { ...base, categoryId: prefs.categories, brandId: prefs.brands, maxPrice: prefs.budgetMax || undefined })
      : Promise.resolve([]);
    personal
      .then((items) => (items.length ? { items, reason: 'Matches your preferences' } : api.get('/products', { ...base, page: 2 }).then((top) => ({ items: top, reason: 'Top rated near you' }))))
      .then(({ items, reason }) => {
        if (cancelled) return;
        setRecommendedProducts(
          items.map((p) => {
            const card = toCard(p);
            return { ...card, reason, rating: p.rating.toFixed(1), originalPrice: p.mrp > p.price ? p.mrp : undefined };
          })
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [currentUser.preferences, activeStoreId, toCard]);

  const runSearch = (text) => {
    setActiveCategory(null);
    setAppliedSearch(text.trim());
    setActiveNav('home');
  };

  // Cart totals come from the backend, including the membership-tier delivery perks
  const summary = cart?.summary;
  const totalItemCount = summary?.itemCount ?? 0;
  const subtotal = summary?.subtotal ?? 0;
  const isDelivery = fulfillment === 'HOME_DELIVERY';
  const deliveryOption = isDelivery ? summary?.delivery?.[deliverySpeed === 'EXPRESS' ? 'express' : 'standard'] : null;
  const deliveryFee = deliveryOption?.fee ?? 0;
  const totalAmount = subtotal + deliveryFee;

  // POST /cart/items
  const handleAddToCart = async (item) => {
    try {
      setCart(await api.post('/cart/items', { productId: item.id, quantity: 1 }));
      say(`Added "${item.fullName || item.name}" to cart (₹${item.price.toLocaleString('en-IN')})`);
    } catch (err) {
      say(err.message);
    }
  };

  // PATCH /cart/items/:id, or DELETE when the quantity reaches zero
  const updateQuantity = async (id, delta) => {
    const line = cartItems.find((i) => i.id === id);
    if (!line) return;
    const quantity = line.quantity + delta;
    try {
      setCart(quantity > 0 ? await api.patch(`/cart/items/${id}`, { quantity }) : await api.delete(`/cart/items/${id}`));
    } catch (err) {
      say(err.details?.[0]?.message ?? err.message);
    }
  };

  // POST /orders - checks out the cart for pickup or delivery
  const handleCheckout = async () => {
    if (isDelivery && (!address.line.trim() || !address.city.trim() || !address.postalCode.trim())) {
      say('Please enter the delivery address, city and PIN code.');
      return;
    }
    checkoutKey.current ??= crypto.randomUUID();
    setPlacingOrder(true);
    try {
      const order = await api.post(
        '/orders',
        isDelivery
          ? { fulfillment, deliverySpeed, shippingAddress: { line: address.line.trim(), city: address.city.trim(), postalCode: address.postalCode.trim() } }
          : { fulfillment, storeId: activeStoreId },
        { headers: { 'Idempotency-Key': checkoutKey.current } }
      );
      checkoutKey.current = null;
      say(`Order ${order.orderNumber} placed • ₹${order.total.toLocaleString('en-IN')} • ${isDelivery ? 'home delivery' : `pickup at ${order.store?.name ?? 'your store'}`}`);
      setIsCartOpen(false);
      await reloadCart();
      setActiveNav('orders');
    } catch (err) {
      // A failed attempt may be retried with changes, so it gets a fresh key.
      checkoutKey.current = null;
      say(err.details?.length ? err.details.map((d) => d.message).join(' • ') : err.message);
    } finally {
      setPlacingOrder(false);
    }
  };

  // POST /orders/:id/cancel
  const handleCancelOrder = async (order) => {
    try {
      await api.post(`/orders/${order.id}/cancel`);
      say(`Order ${order.orderNumber} cancelled`);
      reloadOrders();
    } catch (err) {
      say(err.message);
    }
  };

  const handleQuickPromptClick = (prompt) => {
    setSearchQuery(prompt);
    runSearch(prompt);
  };

  const handleCopyVoucher = () => {
    navigator.clipboard?.writeText('NOVAFRESH');
    say('Voucher code NOVAFRESH copied.');
  };

  // Smooth scroll helper for section navigation
  const scrollToSection = (sectionId, navKey) => {
    if (navKey) setActiveNav(navKey);
    if (!sectionId) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setTimeout(() => {
      const el = document.getElementById(sectionId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 75);
  };

  // POST /assistant/chat - product recommendations or policy answers with sources
  const handleAiSearchSubmit = async (e) => {
    if (e) e.preventDefault();
    const userText = aiChatInput.trim();
    if (!userText || aiBusy) return;

    setAiMessages((prev) => [...prev, { sender: 'user', text: userText }]);
    setAiChatInput('');
    setAiBusy(true);
    try {
      const reply = await api.post('/assistant/chat', { message: userText, storeId: activeStoreId ?? undefined });
      if (reply.type === 'policy') {
        setAiMessages((prev) => [...prev, { sender: 'bot', text: reply.answer, sources: reply.sources }]);
      } else {
        const lines = [reply.interpretedRequirement];
        if (reply.clarifyingQuestion) lines.push(reply.clarifyingQuestion);
        setAiMessages((prev) => [...prev, { sender: 'bot', text: lines.join('\n\n'), products: reply.recommendations }]);
      }
    } catch (err) {
      setAiMessages((prev) => [...prev, { sender: 'bot', text: err.status === 503 ? `${err.message}. Product questions still work.` : err.message }]);
    } finally {
      setAiBusy(false);
    }
  };

  const handleSignOut = async () => {
    setShowUserMenu(false);
    await logout();
    say('Signed out of NovaMart.');
    navigate('/login');
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
              <span>{activeStoreInfo?.address ?? 'Pick the store you shop at'}</span>
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
              if (e.key === 'Enter') runSearch(searchQuery);
            }}
          />
          <button
            type="button"
            className="search-submit-btn"
            onClick={() => runSearch(searchQuery)}
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
            <ShoppingBag size={19} />
            <span className="cart-badge-count">{totalItemCount}</span>
          </button>

          <div className="user-profile-wrapper">
            <div className="user-profile-pill" onClick={() => setShowUserMenu(!showUserMenu)}>
              <div className="user-avatar-circle">
                <User size={16} />
              </div>
              <div className="user-info-text">
                <span className="user-name">{currentUser.fullName}</span>
                <span className="user-tier">
                  {`${tierName.charAt(0) + tierName.slice(1).toLowerCase()} Member`} <ChevronDown size={10} />
                </span>
              </div>
            </div>

            {showUserMenu && (
              <div className="user-profile-menu-dropdown">
                <div className="user-menu-header">
                  <div className="user-menu-name">{currentUser.fullName}</div>
                  <div className="user-menu-email">{currentUser.email}</div>
                  <div className="user-menu-badge">
                    {tierName} MEMBER
                  </div>
                </div>
                <div className="user-menu-divider" />
                <button
                  type="button"
                  className="user-menu-item"
                  onClick={() => {
                    setShowUserMenu(false);
                    navigate('/login');
                  }}
                >
                  <LogIn size={15} />
                  <span>Switch Account / Sign In</span>
                </button>
                <button
                  type="button"
                  className="user-menu-item"
                  onClick={() => {
                    setShowUserMenu(false);
                    navigate('/register');
                  }}
                >
                  <UserPlus size={15} />
                  <span>Register New Account</span>
                </button>
                <div className="user-menu-divider" />
                <button
                  type="button"
                  className="user-menu-item danger"
                  onClick={handleSignOut}
                >
                  <LogOut size={15} />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
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
                  onClick={() => scrollToSection(null, 'home')}
                >
                  <Home size={16} />
                  <span>Home</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className={`sidebar-nav-item ${activeNav === 'categories' ? 'active' : ''}`}
                  onClick={() => scrollToSection('categories-section', 'categories')}
                >
                  <LayoutGrid size={16} />
                  <span>Categories</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className={`sidebar-nav-item ${activeNav === 'brands' ? 'active' : ''}`}
                  onClick={() => scrollToSection('brands-section', 'brands')}
                >
                  <CheckCircle2 size={16} />
                  <span>Brands</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className={`sidebar-nav-item ${activeNav === 'orders' ? 'active' : ''}`}
                  onClick={() => scrollToSection('orders-section', 'orders')}
                >
                  <Truck size={16} />
                  <span>My Orders</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className={`sidebar-nav-item ${activeNav === 'offers' ? 'active' : ''}`}
                  onClick={() => scrollToSection('offers-section', 'offers')}
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
              <Headphones size={16} />
              <span>Help & Support</span>
            </button>

            {/* Operating Hours Card */}
            <div className="store-hours-card">
              <div className="hours-label">Store Operating Hours</div>
              <div className="hours-value">{activeStoreInfo?.hours ?? '10:00 – 22:00'}</div>
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
                <strong className="ribbon-bold">{activeStoreId ?? 'No store selected'}</strong> • {activeStore} live stock:{' '}
                <strong>{activeStoreInfo?.stock ?? '—'}</strong> • Pickup or home delivery
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
              <span>{firstName.toUpperCase()} • {tierName} MEMBER</span>
            </div>
            <h1 className="greeting-headline">What are you shopping for today, {firstName}?</h1>
            <p className="greeting-subtext">
              Explore electronics, appliances, fashion and groceries with live stock from {activeStore}.
            </p>

            <div className="quick-prompts-row">
              <span className="prompts-label">QUICK PROMPTS:</span>
              <button
                type="button"
                className="quick-prompt-chip"
                onClick={() => handleQuickPromptClick('running shoes')}
              >
                🏃 Running shoes
              </button>
              <button
                type="button"
                className="quick-prompt-chip"
                onClick={() => handleQuickPromptClick('almonds')}
              >
                🥗 Healthy snacks
              </button>
              <button
                type="button"
                className="quick-prompt-chip"
                onClick={() => handleQuickPromptClick('coffee')}
              >
                ☕ Coffee
              </button>
              <button
                type="button"
                className="quick-prompt-chip"
                onClick={() => handleQuickPromptClick('noise cancelling headphones')}
              >
                🎧 Noise cancelling headphones
              </button>
            </div>
          </div>

          {/* 3. Mega Promotion Banner (Weekend Super Saver) */}
          <div className="mega-promo-banner" id="offers-section" style={{ scrollMarginTop: '80px' }}>
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
                <span className="stat-value stat-value-cyan">₹350</span>
                <span className="stat-footer" style={{ color: '#E2E8F0' }}>
                  On cart &gt; ₹1,498
                </span>
              </div>
            </div>
          </div>

          {/* My Orders - GET /orders, with cancel while the order is still open */}
          {activeNav === 'orders' && (
            <section className="categories-section" id="orders-section" style={{ scrollMarginTop: '80px' }}>
              <div className="section-header-row">
                <div>
                  <div className="section-pre-title">YOUR ACCOUNT</div>
                  <h3 className="section-main-title">My Orders</h3>
                </div>
                <div className="view-all-link" onClick={() => setActiveNav('home')}>
                  <span>Back to shopping</span>
                  <ArrowRight size={14} />
                </div>
              </div>
              {orders.length === 0 ? (
                <p className="section-subtitle">You have not placed any orders yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {orders.map((order) => (
                    <div key={order.id} style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#0F172A' }}>
                          {order.orderNumber} • {order.status.replaceAll('_', ' ')}
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                          {order.items.map((i) => `${i.quantity} × ${i.name}`).join(', ')}
                        </div>
                        <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '2px' }}>
                          {order.fulfillment === 'HOME_DELIVERY' ? `Home delivery (${order.deliverySpeed?.toLowerCase()})` : `Pickup at ${order.store?.name ?? 'store'}`} • {new Date(order.placedAt).toLocaleString('en-IN')} • {order.paymentStatus.replaceAll('_', ' ').toLowerCase()}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <strong style={{ color: '#1D4ED8' }}>₹{order.total.toLocaleString('en-IN')}</strong>
                        {order.cancellableByCustomer && (
                          <button type="button" className="rec-btn-add" onClick={() => handleCancelOrder(order)}>
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* 4. Featured Categories - GET /categories */}
          <section className="categories-section" id="categories-section" style={{ scrollMarginTop: '80px' }}>
            <div className="section-header-row">
              <div>
                <div className="section-pre-title">{firstName.toUpperCase()}'S DEPARTMENTS</div>
                <h3 className="section-main-title">Featured Categories</h3>
              </div>
              <div
                className="view-all-link"
                onClick={() => {
                  setActiveCategory(null);
                  setAppliedSearch('');
                  setSearchQuery('');
                  scrollToSection('trending-section');
                }}
              >
                <span>View all products</span>
                <ArrowRight size={14} />
              </div>
            </div>

            <div className="categories-grid-wrapper">
              <div className="categories-grid">
                {categories.map((cat) => (
                  <div
                    key={cat.id}
                    className="category-card"
                    onClick={() => {
                      setAppliedSearch('');
                      setSearchQuery('');
                      setActiveCategory({ slug: cat.slug, name: cat.name });
                      scrollToSection('trending-section');
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
            </div>
          </section>

          {/* Featured Brands - GET /brands */}
          <section className="categories-section" id="brands-section" style={{ scrollMarginTop: '80px' }}>
            <div className="section-header-row">
              <div>
                <div className="section-pre-title">TOP TRUSTED LABELS</div>
                <h3 className="section-main-title">Featured Brands</h3>
              </div>
              <div
                className="view-all-link"
                onClick={() => {
                  setAppliedSearch('');
                  setSearchQuery('');
                  setActiveCategory(null);
                  scrollToSection('trending-section');
                }}
              >
                <span>Explore all items</span>
                <ArrowRight size={14} />
              </div>
            </div>

            <div className="brands-grid">
              {(brands.length > 0 ? brands : [
                { id: 'B02', name: 'Apple', productCount: 15 },
                { id: 'B01', name: 'Samsung', productCount: 31 },
                { id: 'B06', name: 'Sony', productCount: 14 },
                { id: 'B08', name: 'Nike', productCount: 15 },
                { id: 'B30', name: 'Puma', productCount: 8 },
                { id: 'B33', name: 'Tata', productCount: 15 },
                { id: 'B13', name: 'boAt', productCount: 10 },
                { id: 'B05', name: 'LG', productCount: 25 },
                { id: 'B12', name: 'Philips', productCount: 8 },
                { id: 'B10', name: 'OnePlus', productCount: 7 },
              ]).map((b) => (
                <button
                  key={b.id}
                  type="button"
                  className="brand-card-item"
                  onClick={() => {
                    setSearchQuery(b.name);
                    runSearch(b.name);
                    say(`Filtered catalog for: ${b.name}`);
                    scrollToSection('trending-section');
                  }}
                >
                  <span className="brand-card-name">{b.name}</span>
                  <span className="brand-card-sub">{b.productCount ? `${b.productCount} Products` : 'In Stock'}</span>
                </button>
              ))}
            </div>
          </section>

          {/* 5. Trending Products & Bestsellers */}
          <section className="trending-section" id="trending-section" style={{ scrollMarginTop: '80px' }}>
            <div className="section-header-row">
              <div>
                <h3 className="section-main-title">
                  <TrendingUp size={20} color="#2563EB" />
                  <span>
                    {appliedSearch ? `Results for “${appliedSearch}”` : activeCategory ? activeCategory.name : 'Trending Products & Bestsellers'}
                  </span>
                </h3>
                <p className="section-subtitle">
                  {productsLoading
                    ? 'Loading products…'
                    : appliedSearch || activeCategory
                      ? `${productTotal} product${productTotal === 1 ? '' : 's'} • stock shown for ${activeStore}`
                      : `Top rated across the catalogue • stock shown for ${activeStore}`}
                </p>
              </div>

              {/* Cart Pill Button aligned to right of section header */}
              <button
                type="button"
                className="trending-cart-pill-btn"
                onClick={() => setIsCartOpen(true)}
              >
                <ShoppingCart size={16} />
                <span>Cart ({totalItemCount} Items • ₹{subtotal.toLocaleString('en-IN')})</span>
              </button>
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
                      disabled={prod.outOfStock}
                    >
                      <ShoppingCart size={15} /> {prod.outOfStock ? 'Out of Stock' : 'Add to Cart'}
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
                  Picked from your saved preferences and what is in stock at {activeStore}
                </p>
              </div>
              <div
                className="manage-pref-link"
                onClick={() => setIsAiModalOpen(true)}
              >
                <span>Ask Nova AI</span>
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
                      <div className="rec-price-stack">
                        <span className="rec-price">₹{rec.price.toLocaleString('en-IN')}</span>
                        {rec.originalPrice && (
                          <span className="rec-price-original">₹{rec.originalPrice.toLocaleString('en-IN')}</span>
                        )}
                      </div>
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
                <Volume2 size={20} />
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
          FLOATING ASK POLICY AI BUTTON (FIXED IN BOTTOM-RIGHT CORNER)
          -------------------------------------------------------------------- */}
      {!isAiModalOpen && (
        <button
          type="button"
          className="floating-ask-policy-btn"
          onClick={() => setIsAiModalOpen(true)}
          aria-label="Ask Policy AI"
        >
          <Sparkles size={16} />
          <span>Ask Policy AI</span>
        </button>
      )}

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
                {summary?.productSavings > 0 && (
                  <div className="summary-row discount">
                    <span>You save on MRP</span>
                    <span>₹{summary.productSavings.toLocaleString('en-IN')}</span>
                  </div>
                )}

                {(cart?.issues ?? []).map((issue) => (
                  <div key={issue.productId} className="summary-row" style={{ color: '#B45309', fontSize: '12px' }}>
                    <span>{issue.message}</span>
                  </div>
                ))}

                {/* How the order is received - pickup or delivery */}
                <div style={{ display: 'flex', gap: '8px', margin: '8px 0' }}>
                  {[['IN_STORE_PICKUP', 'Store pickup'], ['HOME_DELIVERY', 'Home delivery']].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setFulfillment(value)}
                      style={{ flex: 1, padding: '8px', borderRadius: '8px', cursor: 'pointer', fontSize: '12.5px', fontWeight: 600, border: fulfillment === value ? '2px solid #2563EB' : '1px solid #CBD5E1', background: fulfillment === value ? '#EFF6FF' : '#FFFFFF', color: '#0F172A' }}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {isDelivery ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' }}>
                    <input className="search-input-field" style={{ border: '1px solid #CBD5E1', borderRadius: '8px', padding: '8px 10px' }} placeholder="Address line" value={address.line} onChange={(e) => setAddress({ ...address, line: e.target.value })} />
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <input className="search-input-field" style={{ border: '1px solid #CBD5E1', borderRadius: '8px', padding: '8px 10px', minWidth: 0 }} placeholder="City" value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} />
                      <input className="search-input-field" style={{ border: '1px solid #CBD5E1', borderRadius: '8px', padding: '8px 10px', minWidth: 0 }} placeholder="PIN code" value={address.postalCode} onChange={(e) => setAddress({ ...address, postalCode: e.target.value })} />
                    </div>
                    <select value={deliverySpeed} onChange={(e) => setDeliverySpeed(e.target.value)} style={{ border: '1px solid #CBD5E1', borderRadius: '8px', padding: '8px 10px', fontSize: '12.5px' }}>
                      <option value="STANDARD">Standard delivery</option>
                      <option value="EXPRESS">Express delivery</option>
                    </select>
                  </div>
                ) : null}

                <div className="summary-row">
                  <span>{isDelivery ? `${deliverySpeed === 'EXPRESS' ? 'Express' : 'Standard'} delivery` : `Pickup at ${activeStore}`}</span>
                  <span style={{ color: deliveryFee === 0 ? '#059669' : undefined, fontWeight: '700' }}>
                    {deliveryFee === 0 ? `FREE${deliveryOption?.tierPerk ? ` (${deliveryOption.tierPerk} perk)` : ''}` : `₹${deliveryFee.toLocaleString('en-IN')}`}
                  </span>
                </div>
                {cart?.membership && (
                  <div className="summary-row" style={{ fontSize: '12px', color: '#64748B' }}>
                    <span>{cart.membership.tier} member • earns {cart.membership.rewardPointsEarned} reward points</span>
                  </div>
                )}
                <div className="summary-row total">
                  <span>Total Payable</span>
                  <span style={{ color: '#1D4ED8' }}>₹{totalAmount.toLocaleString('en-IN')}</span>
                </div>

                <button
                  type="button"
                  className="drawer-checkout-btn"
                  onClick={handleCheckout}
                  disabled={placingOrder}
                >
                  {placingOrder ? 'Placing order…' : `Place Order • ₹${totalAmount.toLocaleString('en-IN')}`}
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
                  <h3 style={{ fontSize: '15px', fontWeight: '800' }}>Nova AI • {activeStore} Shopping Copilot</h3>
                  <div style={{ fontSize: '11px', opacity: 0.9 }}>
                    Answers come from the live catalogue and the policy knowledge base
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
              {aiBusy && (
                <div className="chat-bubble-row bot" style={{ order: 1 }}>
                  <div className="bubble-text">Thinking…</div>
                </div>
              )}
              {aiMessages.map((m, idx) => (
                <div key={idx} className={`chat-bubble-row ${m.sender}`}>
                  <div className="bubble-text" style={{ whiteSpace: 'pre-wrap' }}>
                    {m.text}
                    {m.products?.map((p) => (
                      <div key={p.productId} style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(148,163,184,0.4)' }}>
                        <strong>{p.name}</strong> • ₹{p.price.toLocaleString('en-IN')} • {p.availability.status.replaceAll('_', ' ').toLowerCase()}
                        <div style={{ fontSize: '12px', opacity: 0.9, margin: '3px 0 6px' }}>{p.reason}</div>
                        <button type="button" className="rec-btn-add" disabled={p.availability.status === 'OUT_OF_STOCK'} onClick={() => handleAddToCart({ id: p.productId, name: p.name, price: p.price })}>
                          + Add
                        </button>
                      </div>
                    ))}
                    {m.sources?.length > 0 && (
                      <div style={{ marginTop: '8px', fontSize: '11.5px', opacity: 0.85 }}>
                        Source{m.sources.length > 1 ? 's' : ''}: {m.sources.map((src) => `${src.document} — ${src.section} (v${src.version})`).join('; ')}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={handleAiSearchSubmit} className="ai-input-form">
              <input
                type="text"
                className="ai-text-input"
                placeholder="Ask for a product, or about returns, warranty, delivery..."
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
                    border: activeStoreId === s.id ? '2px solid #2563EB' : '1px solid #E2E8F0',
                    background: activeStoreId === s.id ? '#EFF6FF' : '#FFFFFF',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                  onClick={() => handleSwitchStore(s)}
                >
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#0F172A' }}>{s.name}</div>
                    <div style={{ fontSize: '11px', color: '#64748B' }}>{s.address}</div>
                  </div>
                  <div style={{ fontSize: '11.5px', fontWeight: '700', color: '#059669', textAlign: 'right' }}>
                    {s.stock}
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
