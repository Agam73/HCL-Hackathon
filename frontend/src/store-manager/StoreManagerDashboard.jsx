import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  MapPin,
  Bell,
  User,
  Boxes,
  CreditCard,
  Receipt,
  HelpCircle,
  RefreshCw,
  ShieldCheck,
  BarChart3,
  ScanBarcode,
  Building2,
  ArrowLeftRight,
  SprayCan,
  Plus,
  LayoutGrid,
  AlertTriangle,
  ShoppingCart,
  TrendingUp,
  Download,
  Headphones,
  Coffee,
  Armchair,
  Tv,
  Croissant,
  Sparkles,
  Repeat,
  Truck,
  Edit2,
  MoreVertical,
  X,
  Send,
  LogIn,
  LogOut,
  UserPlus
} from 'lucide-react';
import './StoreManagerDashboard.css';
import { api, logout, getStoredUser } from '../api/client';

export default function StoreManagerDashboard({ onTriggerToast }) {
  const navigate = useNavigate();

  const say = useCallback((message) => {
    if (onTriggerToast) onTriggerToast(message);
  }, [onTriggerToast]);

  // Signed-in store manager (the route guard guarantees there is one)
  const [currentUser] = useState(() => getStoredUser() ?? {});
  const storeId = currentUser.managedStoreId;
  const firstName = (currentUser.fullName || 'there').split(' ')[0];
  const [showUserMenu, setShowUserMenu] = useState(false);

  // The manager's store - GET /stores/:storeId
  const [store, setStore] = useState(null);
  const storeName = store?.name ?? storeId ?? 'your store';
  useEffect(() => {
    if (!storeId) return;
    api.get(`/stores/${storeId}`).then(setStore).catch((err) => say(err.message));
  }, [storeId, say]);

  // Active navigation states
  const [activeSidebarNav, setActiveSidebarNav] = useState('inventory');
  const [activeViewTab, setActiveViewTab] = useState('inventory');
  const [statusFilter, setStatusFilter] = useState('all');
  const [tableSearchQuery, setTableSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [topSearchQuery, setTopSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const refresh = () => setReloadKey((k) => k + 1);

  // Modals state
  const [adjustingItem, setAdjustingItem] = useState(null);
  const [adjustQuantity, setAdjustQuantity] = useState('');
  const [showQuickRestockModal, setShowQuickRestockModal] = useState(false);
  const [showPolicyAiModal, setShowPolicyAiModal] = useState(false);

  // Policy AI Chat state
  const [aiChatInput, setAiChatInput] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMessages, setAiMessages] = useState([
    {
      sender: 'bot',
      text: `Hello ${firstName}! I am your store operations copilot. Ask me about return guidelines, warranty terms, delivery rules or replenishment procedures.`
    }
  ]);

  // Inventory table - GET /stores/:storeId/inventory (filtered and paged by the backend)
  const PAGE_SIZE = 10;
  const STATUS_PARAM = { 'in-stock': 'IN_STOCK', 'low-stock': 'LOW_STOCK', 'out-of-stock': 'OUT_OF_STOCK' };
  const LEVELS = {
    IN_STOCK: { levelLabel: 'Healthy', levelType: 'healthy', status: 'in-stock', statusText: 'In Stock', iconType: 'blue' },
    LOW_STOCK: { levelLabel: 'Low', levelType: 'low', status: 'low-stock', statusText: 'Low Stock', iconType: 'green' },
    OUT_OF_STOCK: { levelLabel: 'Depleted', levelType: 'depleted', status: 'out-of-stock', statusText: 'Out of Stock', iconType: 'red' },
  };
  const toRow = (r) => ({
    id: r.product.id,
    name: r.product.name,
    department: r.product.categoryName,
    variant: r.product.brandName,
    sku: r.product.id,
    location: r.storeId,
    units: r.quantityAvailable,
    progressPercent: Math.min(100, Math.round((r.quantityAvailable / Math.max(1, r.reorderLevel * 4)) * 100)),
    threshold: r.reorderLevel,
    icon: <Boxes size={18} />,
    // Out-of-stock rows offer a one-click restock; the rest open the count dialog.
    actionType: r.availability === 'OUT_OF_STOCK' ? 'expedite' : 'adjust',
    secondaryAction: 'more',
    ...LEVELS[r.availability],
  });

  const [inventoryItems, setInventoryItems] = useState([]);
  const [inventoryTotal, setInventoryTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [kpis, setKpis] = useState({ skus: 0, low: 0, out: 0, openOrders: 0 });

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(tableSearchQuery.trim()), 300);
    return () => clearTimeout(timer);
  }, [tableSearchQuery]);
  useEffect(() => setPage(1), [debouncedSearch, statusFilter]);

  useEffect(() => {
    if (!storeId) return undefined;
    const controller = new AbortController();
    api
      .getPage(
        `/stores/${storeId}/inventory`,
        { q: debouncedSearch, status: STATUS_PARAM[statusFilter], page, size: PAGE_SIZE },
        { signal: controller.signal }
      )
      .then(({ items, meta }) => {
        setInventoryItems(items.map(toRow));
        setInventoryTotal(meta.totalItems);
        setTotalPages(Math.max(1, meta.totalPages));
      })
      .catch((err) => err.name !== 'AbortError' && say(err.message));
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, debouncedSearch, statusFilter, page, reloadKey]);

  // KPI tiles - counts straight from the backend
  useEffect(() => {
    if (!storeId) return;
    const count = (path, params) => api.getPage(path, { ...params, size: 1 }).then((r) => r.meta.totalItems);
    Promise.all([
      count(`/stores/${storeId}/inventory`),
      count(`/stores/${storeId}/inventory`, { status: 'LOW_STOCK' }),
      count(`/stores/${storeId}/inventory`, { status: 'OUT_OF_STOCK' }),
      count(`/stores/${storeId}/orders`, { status: 'CONFIRMED' }),
    ])
      .then(([skus, low, out, openOrders]) => setKpis({ skus, low, out, openOrders }))
      .catch(() => {});
  }, [storeId, reloadKey]);

  // The backend already applied the search and status filter.
  const filteredItems = inventoryItems;

  // Order queue - GET /stores/:storeId/orders
  const [orders, setOrders] = useState([]);
  useEffect(() => {
    if (!storeId || activeViewTab !== 'sales') return;
    api.get(`/stores/${storeId}/orders`, { size: 20 }).then(setOrders).catch((err) => say(err.message));
  }, [storeId, activeViewTab, reloadKey, say]);

  // PATCH /orders/:id/status - only the steps the backend lists in nextStatuses
  const handleOrderStatus = async (order, status) => {
    try {
      await api.patch(`/orders/${order.id}/status`, { status });
      say(`Order ${order.orderNumber} is now ${status.replaceAll('_', ' ').toLowerCase()}`);
      refresh();
    } catch (err) {
      say(err.message);
    }
  };

  // PATCH /stores/:storeId/inventory/:productId
  const changeStock = async (item, body, done) => {
    try {
      const result = await api.patch(`/stores/${storeId}/inventory/${item.id}`, body);
      say(done(result));
      refresh();
      return true;
    } catch (err) {
      say(err.details?.[0]?.message ?? err.message);
      return false;
    }
  };

  // Expedite restock: brings a depleted product back to twice its reorder level
  const handleExpedite = (item) =>
    changeStock(
      item,
      { delta: Math.max(10, item.threshold * 2), reason: 'Expedited restock from the manager dashboard' },
      (r) => `Restocked ${item.name}: now ${r.quantityAvailable} units.`
    );

  // Adjust stock count modal save
  const handleSaveStockAdjustment = async () => {
    if (!adjustingItem) return;
    const newQty = parseInt(adjustQuantity, 10);
    if (isNaN(newQty) || newQty < 0) {
      say('Please enter a valid stock quantity.');
      return;
    }
    const saved = await changeStock(
      adjustingItem,
      { quantityAvailable: newQty, reason: 'Verified count from the manager dashboard' },
      () => `Adjusted ${adjustingItem.name} to ${newQty} units.`
    );
    if (saved) setAdjustingItem(null);
  };

  // Stock history for one product - GET /stores/:storeId/inventory/movements
  const handleShowHistory = async (item) => {
    try {
      const rows = await api.get(`/stores/${storeId}/inventory/movements`, { productId: item.id, size: 3 });
      say(
        rows.length
          ? `${item.sku} history: ` + rows.map((m) => `${m.type} ${m.quantityDelta > 0 ? '+' : ''}${m.quantityDelta} → ${m.quantityAfter}`).join(' • ')
          : `No stock movements recorded yet for ${item.sku}.`
      );
    } catch (err) {
      say(err.message);
    }
  };

  // Quick Restock: every out-of-stock product at this store goes back to twice its reorder level
  const [restocking, setRestocking] = useState(false);
  const handleQuickRestock = async () => {
    setRestocking(true);
    try {
      const depleted = await api.get(`/stores/${storeId}/inventory`, { status: 'OUT_OF_STOCK', size: 100 });
      let done = 0;
      for (const row of depleted) {
        await api.patch(`/stores/${storeId}/inventory/${row.product.id}`, {
          delta: Math.max(10, row.reorderLevel * 2),
          reason: 'Quick restock from the manager dashboard',
        });
        done += 1;
      }
      say(done ? `Restocked ${done} out-of-stock product${done === 1 ? '' : 's'}.` : 'Nothing is out of stock.');
      setShowQuickRestockModal(false);
      refresh();
    } catch (err) {
      say(err.message);
      refresh();
    } finally {
      setRestocking(false);
    }
  };

  const handleExport = () => {
    const csvContent = "data:text/csv;charset=utf-8,"
      + ["Product,SKU,Location,Stock,Threshold,Status"].join(",") + "\n"
      + inventoryItems.map(e => `"${e.name}",${e.sku},"${e.location}",${e.units},${e.threshold},"${e.statusText}"`).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `NovaMart_${storeId}_Inventory.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    say(`Inventory page exported to NovaMart_${storeId}_Inventory.csv`);
  };

  // POST /assistant/chat - answered from the policy knowledge base with sources
  const handleAiMessageSubmit = async (e) => {
    e.preventDefault();
    const userText = aiChatInput.trim();
    if (!userText || aiBusy) return;

    setAiMessages(prev => [...prev, { sender: 'user', text: userText }]);
    setAiChatInput('');
    setAiBusy(true);
    try {
      const reply = await api.post('/assistant/chat', { message: userText, storeId });
      const text =
        reply.type === 'policy'
          ? reply.answer + (reply.sources?.length ? `\n\nSource: ${reply.sources.map((src) => `${src.document} — ${src.section}`).join('; ')}` : '')
          : [reply.interpretedRequirement, ...reply.recommendations.map((r) => `• ${r.name} (₹${r.price.toLocaleString('en-IN')}, ${r.availability.status.replaceAll('_', ' ').toLowerCase()})`), reply.clarifyingQuestion].filter(Boolean).join('\n');
      setAiMessages(prev => [...prev, { sender: 'bot', text }]);
    } catch (err) {
      setAiMessages(prev => [...prev, { sender: 'bot', text: err.message }]);
    } finally {
      setAiBusy(false);
    }
  };

  const handleSignOut = async () => {
    setShowUserMenu(false);
    await logout();
    say('Signed out of Store Manager portal.');
    navigate('/login');
  };

  return (
    <div className="store-manager-root">
      {/* --------------------------------------------------------------------
          LEFT SIDEBAR (NovaMart STORE OPERATIONS)
          -------------------------------------------------------------------- */}
      <aside className="manager-sidebar">
        <div className="manager-brand-header" onClick={() => navigate('/storemanager')}>
          <div className="manager-brand-logo-box">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
          </div>
          <div>
            <div className="manager-brand-title">NovaMart</div>
            <div className="manager-brand-sub">STORE OPERATIONS</div>
          </div>
        </div>

        <nav className="manager-sidebar-nav">
          <button
            type="button"
            className={`manager-nav-item ${activeSidebarNav === 'inventory' ? 'active' : ''}`}
            onClick={() => setActiveSidebarNav('inventory')}
          >
            <Boxes size={17} />
            <span>Inventory</span>
          </button>
          <button
            type="button"
            className={`manager-nav-item ${activeSidebarNav === 'payments' ? 'active' : ''}`}
            onClick={() => {
              setActiveSidebarNav('payments');
              if (onTriggerToast) onTriggerToast('Switching to Payments Received view');
            }}
          >
            <CreditCard size={17} />
            <span>Payments Received</span>
          </button>
          <button
            type="button"
            className={`manager-nav-item ${activeSidebarNav === 'sales' ? 'active' : ''}`}
            onClick={() => {
              setActiveSidebarNav('sales');
              if (onTriggerToast) onTriggerToast('Switching to Sales Analytics view');
            }}
          >
            <Receipt size={17} />
            <span>Sales</span>
          </button>
          <button
            type="button"
            className={`manager-nav-item ${activeSidebarNav === 'queries' ? 'active' : ''}`}
            onClick={() => {
              setActiveSidebarNav('queries');
              setShowPolicyAiModal(true);
            }}
          >
            <HelpCircle size={17} />
            <span>Queries</span>
          </button>
        </nav>

        <div className="manager-sidebar-bottom">
          <div className="terminal-status-card">
            <div className="terminal-status-title">
              <span className="terminal-status-dot" />
              <span>STORE TERMINAL ONLINE</span>
            </div>
            <div className="terminal-status-desc">POS Sync v3.1</div>
          </div>
        </div>
      </aside>

      {/* --------------------------------------------------------------------
          MAIN VIEWPORT
          -------------------------------------------------------------------- */}
      <div className="manager-main-viewport">
        {/* TOPBAR */}
        <header className="manager-topbar">
          <div className="topbar-search-store">
            <div className="topbar-search-box">
              <Search size={15} color="#94A3B8" />
              <input
                type="text"
                className="topbar-search-input"
                placeholder="Search products, transactions, queries..."
                value={topSearchQuery}
                onChange={(e) => setTopSearchQuery(e.target.value)}
              />
            </div>
            <div className="topbar-store-pill">
              <MapPin size={12} />
              <span>{storeId} — {storeName}</span>
            </div>
          </div>

          <div className="topbar-right-controls">
            <button
              type="button"
              className="topbar-bell-btn"
              onClick={() => {
                if (onTriggerToast) onTriggerToast('All floor alerts acknowledged.');
              }}
              title="Notifications"
            >
              <Bell size={18} />
              <span className="topbar-bell-badge" />
            </button>

            <div className="user-profile-wrapper">
              <div className="topbar-user-profile" onClick={() => setShowUserMenu(!showUserMenu)}>
                <div className="user-text-info">
                  <div className="user-name-title">{currentUser.fullName}</div>
                  <div className="user-role-title">Store Manager</div>
                </div>
                <div className="user-avatar-navy">
                  <User size={18} />
                </div>
              </div>

              {showUserMenu && (
                <div className="user-profile-menu-dropdown">
                  <div className="user-menu-header">
                    <div className="user-menu-name">{currentUser.fullName || 'Alex Morgan'}</div>
                    <div className="user-menu-email">{currentUser.email || 'manager@novamart.com'}</div>
                    <div className="user-menu-badge">STORE MANAGER • AUTHENTICATED</div>
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

        {/* CONTENT SCROLL */}
        <main className="manager-content-scroll">
          {/* Breadcrumbs & Header Actions */}
          <div className="manager-header-row">
            <div>
              <div className="breadcrumbs-trail">
                <span>STORE OPERATIONS</span>
                <span>&gt;</span>
                <span>{storeName.toUpperCase()} ({storeId})</span>
                <span>&gt;</span>
                <span className="active">INVENTORY MANAGEMENT</span>
              </div>
              <h1 className="page-big-title">Inventory Overview</h1>
            </div>

            <div className="header-action-cluster">
              <div className="tab-nav-pill-group">
                <button
                  type="button"
                  className={`tab-pill-btn ${activeViewTab === 'inventory' ? 'active' : ''}`}
                  onClick={() => setActiveViewTab('inventory')}
                >
                  <Boxes size={14} />
                  <span>Inventory</span>
                </button>
                <button
                  type="button"
                  className={`tab-pill-btn ${activeViewTab === 'payments' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveViewTab('payments');
                    if (onTriggerToast) onTriggerToast('Viewing Payments log');
                  }}
                >
                  <CreditCard size={14} />
                  <span>Payments</span>
                </button>
                <button
                  type="button"
                  className={`tab-pill-btn ${activeViewTab === 'sales' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveViewTab('sales');
                  }}
                >
                  <Receipt size={14} />
                  <span>Orders</span>
                  {kpis.openOrders > 0 && <span className="tab-badge-count">{kpis.openOrders}</span>}
                </button>
                <button
                  type="button"
                  className={`tab-pill-btn ${activeViewTab === 'queries' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveViewTab('queries');
                    setShowPolicyAiModal(true);
                  }}
                >
                  <HelpCircle size={14} />
                  <span>Queries</span>
                </button>
              </div>

              <div className="sub-action-buttons">
                <button
                  type="button"
                  className="icon-btn-square"
                  onClick={() => {
                    refresh();
                    say('Inventory refreshed from the database.');
                  }}
                  title="Refresh Inventory"
                >
                  <RefreshCw size={14} />
                </button>
                <button
                  type="button"
                  className="policy-check-btn"
                  onClick={() => setShowPolicyAiModal(true)}
                >
                  <ShieldCheck size={14} color="#2563EB" />
                  <span>Policy Quick-Check</span>
                </button>
              </div>
            </div>
          </div>

          {/* Banner Card */}
          <div className="inventory-banner-card">
            <div className="banner-card-left">
              <div className="banner-icon-box">
                <Building2 size={20} />
              </div>
              <div>
                <h3 className="banner-heading">Inventory Management — {storeName}</h3>
                <p className="banner-subheading">
                  Live stock for {storeId}{store ? ` • ${store.address.city}` : ''} • every change is recorded in the stock ledger
                </p>
              </div>
            </div>

            <div className="banner-card-right">
              <button
                type="button"
                className="btn-stock-count"
                onClick={() => {
                  if (onTriggerToast) onTriggerToast('Physical stock barcode audit mode ready on Handheld #3.');
                }}
              >
                <ScanBarcode size={15} />
                <span>Stock Count</span>
              </button>
              <button
                type="button"
                className="btn-quick-restock"
                onClick={() => setShowQuickRestockModal(true)}
              >
                <Plus size={15} />
                <span>Quick Restock</span>
              </button>
            </div>
          </div>

          {/* 4 KPI Metric Cards */}
          <div className="manager-kpis-grid">
            <div className="kpi-tile-card">
              <div className="kpi-tile-top">
                <span className="kpi-tile-label">ACTIVE SKU CATALOG</span>
                <div className="kpi-tile-icon blue">
                  <LayoutGrid size={16} />
                </div>
              </div>
              <div className="kpi-tile-number">{kpis.skus.toLocaleString('en-IN')}</div>
              <div className="kpi-tile-footer green">
                <span>✔</span>
                <span>{kpis.skus ? (((kpis.skus - kpis.out) / kpis.skus) * 100).toFixed(1) : '0'}% in stock</span>
              </div>
            </div>

            <div className="kpi-tile-card">
              <div className="kpi-tile-top">
                <span className="kpi-tile-label">LOW STOCK WARN</span>
                <div className="kpi-tile-icon gray">
                  <AlertTriangle size={16} />
                </div>
              </div>
              <div className="kpi-tile-number">{kpis.low}</div>
              <div className="kpi-tile-footer">
                <span>!</span>
                <span>At or below reorder level</span>
              </div>
            </div>

            <div className="kpi-tile-card">
              <div className="kpi-tile-top">
                <span className="kpi-tile-label depleted">DEPLETED / STOCKOUT</span>
                <div className="kpi-tile-icon red">
                  <ShoppingCart size={16} />
                </div>
              </div>
              <div className="kpi-tile-number">{kpis.out}</div>
              <div className="kpi-tile-footer">
                <Truck size={12} />
                <span>Use Expedite to restock</span>
              </div>
            </div>

            <div className="kpi-tile-card">
              <div className="kpi-tile-top">
                <span className="kpi-tile-label">OPEN ORDERS</span>
                <div className="kpi-tile-icon green">
                  <TrendingUp size={16} />
                </div>
              </div>
              <div className="kpi-tile-number">{kpis.openOrders}</div>
              <div className="kpi-tile-footer green">
                <span>↗</span>
                <span>Confirmed, waiting to be packed</span>
              </div>
            </div>
          </div>

          {/* Order queue - GET /stores/:storeId/orders, moved along with PATCH /orders/:id/status */}
          {activeViewTab === 'sales' && (
            <div className="inventory-table-card" style={{ marginBottom: '16px' }}>
              <table className="inventory-table">
                <thead>
                  <tr>
                    <th>ORDER</th>
                    <th>CUSTOMER</th>
                    <th>ITEMS</th>
                    <th>FULFILMENT</th>
                    <th>TOTAL</th>
                    <th>STATUS</th>
                    <th>NEXT STEP</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '20px', color: '#64748B' }}>No orders for this store yet.</td>
                    </tr>
                  )}
                  {orders.map((order) => (
                    <tr key={order.id}>
                      <td><span className="sku-mono">{order.orderNumber}</span></td>
                      <td>{order.customer.name}</td>
                      <td>{order.items.map((i) => `${i.quantity} × ${i.name}`).join(', ')}</td>
                      <td>{order.fulfillment === 'HOME_DELIVERY' ? `Delivery (${order.deliverySpeed?.toLowerCase()})` : 'Store pickup'}</td>
                      <td>₹{order.total.toLocaleString('en-IN')}</td>
                      <td>{order.status.replaceAll('_', ' ')}</td>
                      <td>
                        <div className="row-actions-cell">
                          {order.nextStatuses.length === 0 && <span style={{ color: '#94A3B8' }}>—</span>}
                          {order.nextStatuses.map((next) => (
                            <button
                              key={next}
                              type="button"
                              className={next === 'CANCELLED' ? 'btn-row-expedite' : 'btn-row-adjust'}
                              onClick={() => handleOrderStatus(order, next)}
                            >
                              {next.replaceAll('_', ' ').toLowerCase()}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Filter & Action Bar */}
          <div className="inventory-filter-bar">
            <div className="filter-left-controls">
              <div className="filter-search-box">
                <Search size={14} color="#94A3B8" />
                <input
                  type="text"
                  className="filter-search-input"
                  placeholder="Filter by product name, SKU, or department..."
                  value={tableSearchQuery}
                  onChange={(e) => setTableSearchQuery(e.target.value)}
                />
              </div>

              <div className="filter-pills-row">
                <button
                  type="button"
                  className={`filter-status-pill ${statusFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setStatusFilter('all')}
                >
                  All
                </button>
                <button
                  type="button"
                  className={`filter-status-pill ${statusFilter === 'in-stock' ? 'active' : ''}`}
                  onClick={() => setStatusFilter('in-stock')}
                >
                  In Stock
                </button>
                <button
                  type="button"
                  className={`filter-status-pill ${statusFilter === 'low-stock' ? 'active' : ''}`}
                  onClick={() => setStatusFilter('low-stock')}
                >
                  Low Stock
                </button>
                <button
                  type="button"
                  className={`filter-status-pill ${statusFilter === 'out-of-stock' ? 'active' : ''}`}
                  onClick={() => setStatusFilter('out-of-stock')}
                >
                  Out of Stock
                </button>
              </div>
            </div>

            <div className="filter-right-controls">
              <span className="showing-sku-count">
                Showing <strong>{filteredItems.length}</strong> SKU items
              </span>
              <button
                type="button"
                className="btn-export"
                onClick={handleExport}
              >
                <Download size={13} />
                <span>Export</span>
              </button>
            </div>
          </div>

          {/* Inventory Data Table */}
          <div className="inventory-table-card">
            <table className="inventory-table">
              <thead>
                <tr>
                  <th>PRODUCT DETAILS</th>
                  <th>SKU</th>
                  <th>LOCATION / AISLE</th>
                  <th>STOCK LEVEL</th>
                  <th>REORDER THRESHOLD</th>
                  <th>STATUS</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr key={item.id}>
                    {/* Product Details */}
                    <td>
                      <div className="product-cell-wrap">
                        <div className={`product-icon-avatar ${item.iconType}`}>
                          {item.icon}
                        </div>
                        <div>
                          <div className="product-title-text">{item.name}</div>
                          <div className="product-sub-text">
                            {item.department} • {item.variant}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* SKU */}
                    <td>
                      <span className="sku-code-text">{item.sku}</span>
                    </td>

                    {/* Location / Aisle */}
                    <td>
                      {item.location === 'Chiller C-02' ? (
                        <span className="aisle-chip blue multiline">
                          <span>Chiller C-</span>
                          <span>02</span>
                        </span>
                      ) : item.location === 'Floor Display 03' ? (
                        <span className="aisle-chip multiline">
                          <span>Floor</span>
                          <span>Display 03</span>
                        </span>
                      ) : item.location === 'Bakery B-01' ? (
                        <span className="aisle-chip multiline">
                          <span>Bakery B-</span>
                          <span>01</span>
                        </span>
                      ) : (
                        <span className="aisle-chip">
                          {item.location}
                        </span>
                      )}
                    </td>

                    {/* Stock Level with Progress Bar */}
                    <td>
                      <div className="stock-level-cell">
                        <div className="stock-count-header">
                          <span className={`stock-units-num ${item.levelType === 'depleted' ? 'red' : ''}`}>
                            {item.units} units
                          </span>
                          <span className={`stock-status-label ${item.levelType}`}>
                            {item.levelLabel}
                          </span>
                        </div>
                        <div className="stock-progress-track">
                          <div
                            className={`stock-progress-bar ${item.levelType}`}
                            style={{ width: `${item.progressPercent}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Reorder Threshold */}
                    <td>
                      <span className="threshold-text">{item.threshold} units</span>
                    </td>

                    {/* Status Pill Badge */}
                    <td>
                      {item.status === 'low-stock' ? (
                        <span className="status-pill-badge low-stock">
                          <span className="status-dot">●</span>
                          <span className="status-stacked-text">
                            <span>Low</span>
                            <span>Stock</span>
                          </span>
                        </span>
                      ) : item.status === 'out-of-stock' ? (
                        <span className="status-pill-badge out-of-stock">
                          <span className="status-dot">●</span>
                          <span className="status-stacked-text">
                            <span>Out of</span>
                            <span>Stock</span>
                          </span>
                        </span>
                      ) : (
                        <span className="status-pill-badge in-stock">
                          <span className="status-dot">●</span>
                          <span>In Stock</span>
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td>
                      <div className="row-actions-cell">
                        {item.actionType === 'adjust' ? (
                          <button
                            type="button"
                            className="btn-row-adjust"
                            onClick={() => {
                              setAdjustingItem(item);
                              setAdjustQuantity(String(item.units));
                            }}
                          >
                            Adjust
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn-row-expedite"
                            onClick={() => handleExpedite(item)}
                          >
                            Expedite
                          </button>
                        )}

                        {item.secondaryAction === 'transfer' && (
                          <button
                            type="button"
                            className="btn-row-icon"
                            onClick={() => {
                              if (onTriggerToast) onTriggerToast(`Inter-aisle inventory balancing triggered for ${item.sku}.`);
                            }}
                            title="Aisle Transfer"
                          >
                            <ArrowLeftRight size={14} />
                          </button>
                        )}

                        {item.secondaryAction === 'truck' && (
                          <button
                            type="button"
                            className="btn-row-icon"
                            onClick={() => {
                              if (onTriggerToast) onTriggerToast(`Inbound truck shipment PO-4482 tracking opened.`);
                            }}
                            title="Track Delivery"
                          >
                            <Truck size={14} />
                          </button>
                        )}

                        {item.secondaryAction === 'edit' && (
                          <button
                            type="button"
                            className="btn-row-icon"
                            onClick={() => {
                              setAdjustingItem(item);
                              setAdjustQuantity('0');
                            }}
                            title="Edit Listing"
                          >
                            <Edit2 size={14} />
                          </button>
                        )}

                        {item.secondaryAction === 'more' && (
                          <button
                            type="button"
                            className="btn-row-icon"
                            onClick={() => handleShowHistory(item)}
                            title="Stock history"
                          >
                            <MoreVertical size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Table Footer / Pagination */}
            <div className="inventory-table-footer">
              <span>
                Showing records {inventoryTotal === 0 ? 0 : (page - 1) * PAGE_SIZE + 1} to {(page - 1) * PAGE_SIZE + filteredItems.length} of {inventoryTotal.toLocaleString('en-IN')} items
              </span>
              <div className="pagination-cluster">
                <button type="button" className="pagination-btn" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</button>
                <button type="button" className="pagination-btn active">{page} / {totalPages}</button>
                <button type="button" className="pagination-btn" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</button>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* --------------------------------------------------------------------
          FLOATING ASK POLICY AI BUTTON
          -------------------------------------------------------------------- */}
      <button
        type="button"
        className="floating-ask-policy-btn"
        onClick={() => setShowPolicyAiModal(true)}
      >
        <Sparkles size={16} />
        <span>Ask Policy AI</span>
      </button>

      {/* --------------------------------------------------------------------
          MODAL: ADJUST STOCK COUNT
          -------------------------------------------------------------------- */}
      {adjustingItem && (
        <div className="manager-modal-backdrop" onClick={() => setAdjustingItem(null)}>
          <div className="manager-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="manager-modal-header">
              <h3 className="manager-modal-title">Adjust Stock Level — {adjustingItem.name}</h3>
              <button
                type="button"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}
                onClick={() => setAdjustingItem(null)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="manager-modal-body">
              <div>
                <label className="modal-field-label">SKU Code</label>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#0F172A' }}>
                  {adjustingItem.sku} • {adjustingItem.location}
                </div>
              </div>
              <div>
                <label className="modal-field-label">Current Floor Stock</label>
                <div style={{ fontSize: '13px', color: '#64748B' }}>
                  {adjustingItem.units} units (Threshold: {adjustingItem.threshold} units)
                </div>
              </div>
              <div>
                <label className="modal-field-label">New Verified Unit Count</label>
                <input
                  type="number"
                  className="modal-field-input"
                  value={adjustQuantity}
                  onChange={(e) => setAdjustQuantity(e.target.value)}
                  min="0"
                  autoFocus
                />
              </div>
            </div>
            <div className="manager-modal-footer">
              <button
                type="button"
                className="modal-cancel-btn"
                onClick={() => setAdjustingItem(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="modal-submit-btn"
                onClick={handleSaveStockAdjustment}
              >
                Save Adjustment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------
          MODAL: QUICK RESTOCK
          -------------------------------------------------------------------- */}
      {showQuickRestockModal && (
        <div className="manager-modal-backdrop" onClick={() => setShowQuickRestockModal(false)}>
          <div className="manager-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="manager-modal-header">
              <h3 className="manager-modal-title">Quick Restock Dispatch</h3>
              <button
                type="button"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}
                onClick={() => setShowQuickRestockModal(false)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="manager-modal-body">
              <div>
                <label className="modal-field-label">Store</label>
                <input
                  type="text"
                  className="modal-field-input"
                  value={`${storeName} (${storeId})`}
                  readOnly
                  disabled
                />
              </div>
              <div>
                <label className="modal-field-label">Emergency Restock Items</label>
                <div style={{ fontSize: '12.5px', color: '#334155', background: '#F8FAFC', padding: '10px', borderRadius: '8px' }}>
                  • {kpis.low} low-stock products (not changed by this action)<br />
                  • {kpis.out} out-of-stock products will be restocked to twice their reorder level
                </div>
              </div>
            </div>
            <div className="manager-modal-footer">
              <button
                type="button"
                className="modal-cancel-btn"
                onClick={() => setShowQuickRestockModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="modal-submit-btn"
                onClick={handleQuickRestock}
                disabled={restocking || kpis.out === 0}
              >
                {restocking ? 'Restocking…' : 'Confirm Restock'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------
          MODAL: POLICY AI COPILOT
          -------------------------------------------------------------------- */}
      {showPolicyAiModal && (
        <div className="manager-modal-backdrop" onClick={() => setShowPolicyAiModal(false)}>
          <div className="manager-modal-box" style={{ width: '540px' }} onClick={(e) => e.stopPropagation()}>
            <div className="manager-modal-header" style={{ background: '#1D4ED8', color: '#FFFFFF' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={18} />
                <h3 className="manager-modal-title" style={{ color: '#FFFFFF' }}>NovaMart Policy & Ops AI Copilot</h3>
              </div>
              <button
                type="button"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#FFFFFF' }}
                onClick={() => setShowPolicyAiModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ maxHeight: '320px', overflowY: 'auto', padding: '16px', background: '#F8FAFC', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {aiMessages.map((m, idx) => (
                <div
                  key={idx}
                  style={{
                    alignSelf: m.sender === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '85%',
                    padding: '8px 12px',
                    borderRadius: '10px',
                    fontSize: '12.5px',
                    lineHeight: '1.4',
                    background: m.sender === 'user' ? '#1D4ED8' : '#FFFFFF',
                    color: m.sender === 'user' ? '#FFFFFF' : '#0F172A',
                    border: m.sender === 'user' ? 'none' : '1px solid #E2E8F0'
                  }}
                >
                  {m.text}
                </div>
              ))}
            </div>

            <form onSubmit={handleAiMessageSubmit} style={{ display: 'flex', padding: '12px 16px', borderTop: '1px solid #E2E8F0', gap: '8px' }}>
              <input
                type="text"
                className="modal-field-input"
                placeholder="Ask about store restock rules, return guidelines..."
                value={aiChatInput}
                onChange={(e) => setAiChatInput(e.target.value)}
                autoFocus
              />
              <button
                type="submit"
                style={{ background: '#1D4ED8', color: '#FFFFFF', border: 'none', borderRadius: '8px', padding: '0 14px', cursor: 'pointer' }}
              >
                <Send size={15} />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
