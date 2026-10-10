import React, { useState } from 'react';
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

export default function StoreManagerDashboard({ onTriggerToast }) {
  const navigate = useNavigate();

  // Current Authenticated User state
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('auth_user');
      return saved ? JSON.parse(saved) : { fullName: 'Alex Morgan', role: 'STORE_MANAGER', email: 'alex.morgan@novamart.com' };
    } catch {
      return { fullName: 'Alex Morgan', role: 'STORE_MANAGER', email: 'alex.morgan@novamart.com' };
    }
  });
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Active navigation states
  const [activeSidebarNav, setActiveSidebarNav] = useState('inventory');
  const [activeViewTab, setActiveViewTab] = useState('inventory');
  const [statusFilter, setStatusFilter] = useState('all');
  const [tableSearchQuery, setTableSearchQuery] = useState('');
  const [topSearchQuery, setTopSearchQuery] = useState('');

  // Modals state
  const [adjustingItem, setAdjustingItem] = useState(null);
  const [adjustQuantity, setAdjustQuantity] = useState('');
  const [showQuickRestockModal, setShowQuickRestockModal] = useState(false);
  const [showPolicyAiModal, setShowPolicyAiModal] = useState(false);

  // Policy AI Chat state
  const [aiChatInput, setAiChatInput] = useState('');
  const [aiMessages, setAiMessages] = useState([
    {
      sender: 'bot',
      text: 'Hello Alex! I am your Store #104 Operations Copilot. Ask me about store return guidelines, safety protocols, reorder thresholds, or shelf compliance.'
    }
  ]);

  // Inventory Table Data matching screenshot
  const [inventoryItems, setInventoryItems] = useState([
    {
      id: 1,
      name: 'AeroFit Wireless Earbuds',
      department: 'Consumer Tech & Audio',
      variant: 'Matte Onyx',
      sku: 'SKU-88421',
      location: 'Aisle E-04',
      units: 412,
      levelLabel: 'Healthy',
      levelType: 'healthy',
      progressPercent: 85,
      threshold: 100,
      status: 'in-stock',
      statusText: 'In Stock',
      iconType: 'blue',
      icon: <Headphones size={18} />,
      actionType: 'adjust',
      secondaryAction: 'transfer'
    },
    {
      id: 2,
      name: 'Fair-Trade Cold Brew 12pk',
      department: 'Beverage Chillers',
      variant: 'Nitro Steeped',
      sku: 'SKU-44189',
      location: 'Chiller C-02',
      units: 14,
      levelLabel: 'Low',
      levelType: 'low',
      progressPercent: 28,
      threshold: 30,
      status: 'low-stock',
      statusText: 'Low Stock',
      iconType: 'blue',
      icon: <Coffee size={18} />,
      actionType: 'adjust',
      secondaryAction: 'truck'
    },
    {
      id: 3,
      name: 'Nordic Mesh Desk Chair',
      department: 'Ergonomic Furniture',
      variant: 'Space Grey',
      sku: 'SKU-77312',
      location: 'Floor Display 03',
      units: 0,
      levelLabel: 'Depleted',
      levelType: 'depleted',
      progressPercent: 0,
      threshold: 15,
      status: 'out-of-stock',
      statusText: 'Out of Stock',
      iconType: 'red',
      icon: <Armchair size={18} />,
      actionType: 'expedite',
      secondaryAction: 'edit'
    },
    {
      id: 4,
      name: 'UltraGlow 4K Monitor 32"',
      department: 'Displays & Vision',
      variant: '144Hz IPS',
      sku: 'SKU-99042',
      location: 'Aisle E-01',
      units: 88,
      levelLabel: 'Optimal',
      levelType: 'optimal',
      progressPercent: 72,
      threshold: 25,
      status: 'in-stock',
      statusText: 'In Stock',
      iconType: 'blue',
      icon: <Tv size={18} />,
      actionType: 'adjust',
      secondaryAction: 'more'
    },
    {
      id: 5,
      name: 'Sourdough Artisan Loaf',
      department: 'In-Store Bakery',
      variant: 'Daily Baked',
      sku: 'SKU-31004',
      location: 'Bakery B-01',
      units: 165,
      levelLabel: 'Fresh',
      levelType: 'fresh',
      progressPercent: 88,
      threshold: 40,
      status: 'in-stock',
      statusText: 'In Stock',
      iconType: 'blue',
      icon: <Croissant size={18} />,
      actionType: 'adjust',
      secondaryAction: 'more'
    },
    {
      id: 6,
      name: 'EcoClean Plant Detergent',
      department: 'Household Essentials',
      variant: '64oz Eco-Pouch',
      sku: 'SKU-65290',
      location: 'Aisle H-05',
      units: 18,
      levelLabel: 'Low',
      levelType: 'low',
      progressPercent: 32,
      threshold: 50,
      status: 'low-stock',
      statusText: 'Low Stock',
      iconType: 'green',
      icon: <SprayCan size={18} />,
      actionType: 'adjust',
      secondaryAction: 'more'
    }
  ]);

  // Filter items
  const filteredItems = inventoryItems.filter((item) => {
    // Status filter
    if (statusFilter === 'in-stock' && item.status !== 'in-stock') return false;
    if (statusFilter === 'low-stock' && item.status !== 'low-stock') return false;
    if (statusFilter === 'out-of-stock' && item.status !== 'out-of-stock') return false;

    // Search query
    const q = tableSearchQuery.toLowerCase();
    if (q) {
      const matchName = item.name.toLowerCase().includes(q);
      const matchSku = item.sku.toLowerCase().includes(q);
      const matchDept = item.department.toLowerCase().includes(q);
      const matchLoc = item.location.toLowerCase().includes(q);
      if (!matchName && !matchSku && !matchDept && !matchLoc) return false;
    }
    return true;
  });

  // Expedite restock
  const handleExpedite = (item) => {
    setInventoryItems(prev => prev.map(i => {
      if (i.id === item.id) {
        return {
          ...i,
          units: 15,
          levelLabel: 'Optimal',
          levelType: 'optimal',
          progressPercent: 65,
          status: 'in-stock',
          statusText: 'In Stock',
          actionType: 'adjust'
        };
      }
      return i;
    }));
    if (onTriggerToast) {
      onTriggerToast(`Expedited emergency restock order dispatched for ${item.name} (SKU: ${item.sku}) from Dallas Hub!`);
    }
  };

  // Adjust stock count modal save
  const handleSaveStockAdjustment = () => {
    if (!adjustingItem) return;
    const newQty = parseInt(adjustQuantity, 10);
    if (isNaN(newQty) || newQty < 0) {
      if (onTriggerToast) onTriggerToast('Please enter a valid stock quantity.');
      return;
    }

    setInventoryItems(prev => prev.map(i => {
      if (i.id === adjustingItem.id) {
        let newStatus = 'in-stock';
        let newStatusText = 'In Stock';
        let newLabel = 'Optimal';
        let newType = 'optimal';

        if (newQty === 0) {
          newStatus = 'out-of-stock';
          newStatusText = 'Out of Stock';
          newLabel = 'Depleted';
          newType = 'depleted';
        } else if (newQty <= i.threshold) {
          newStatus = 'low-stock';
          newStatusText = 'Low Stock';
          newLabel = 'Low';
          newType = 'low';
        }

        return {
          ...i,
          units: newQty,
          status: newStatus,
          statusText: newStatusText,
          levelLabel: newLabel,
          levelType: newType,
          progressPercent: Math.min(100, Math.round((newQty / (i.threshold * 2)) * 100))
        };
      }
      return i;
    }));

    if (onTriggerToast) {
      onTriggerToast(`Adjusted floor inventory for ${adjustingItem.name} to ${newQty} units.`);
    }
    setAdjustingItem(null);
  };

  const handleExport = () => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + ["Product,SKU,Location,Stock,Threshold,Status"].join(",") + "\n"
      + inventoryItems.map(e => `"${e.name}",${e.sku},"${e.location}",${e.units},${e.threshold},"${e.statusText}"`).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "NovaMart_Store104_Inventory.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    if (onTriggerToast) {
      onTriggerToast("Inventory report exported to NovaMart_Store104_Inventory.csv");
    }
  };

  const handleAiMessageSubmit = (e) => {
    e.preventDefault();
    if (!aiChatInput.trim()) return;

    const userText = aiChatInput;
    setAiMessages(prev => [...prev, { sender: 'user', text: userText }]);
    setAiChatInput('');

    setTimeout(() => {
      let reply = "Based on Austin Flagship Store #104 standard operating procedures, shelf audits run at 06:00 AM and 02:00 PM daily.";
      const lower = userText.toLowerCase();
      if (lower.includes('return') || lower.includes('policy')) {
        reply = "Store #104 accepts 7-day grocery returns with automatic refund reconciliation. Defective electronics have an instant 14-day replacement window at Customer Service Bay #2.";
      } else if (lower.includes('cold brew') || lower.includes('chiller')) {
        reply = "Fair-Trade Cold Brew 12pk is flagged Low (14 units). Automatic restock PO-8921 is scheduled for 4:00 PM cold-chain cross-dock delivery.";
      } else if (lower.includes('restock') || lower.includes('reorder')) {
        reply = "Automated reorder triggers when stock falls below Reorder Threshold. Emergency expedited restocks route through the Dallas Regional Hub via express transit.";
      }
      setAiMessages(prev => [...prev, { sender: 'bot', text: reply }]);
    }, 550);
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
              <span>Store #104 — Austin Flagship</span>
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
                  <div className="user-name-title">{currentUser.fullName || 'Alex Morgan'}</div>
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
                    onClick={() => {
                      localStorage.removeItem('auth_user');
                      localStorage.removeItem('auth_token');
                      setShowUserMenu(false);
                      if (onTriggerToast) onTriggerToast('Signed out of Store Manager portal.');
                      navigate('/login');
                    }}
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
                <span>AUSTIN FLAGSHIP (#104)</span>
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
                    if (onTriggerToast) onTriggerToast('Viewing Sales tally');
                  }}
                >
                  <Receipt size={14} />
                  <span>Sales</span>
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
                  <span className="tab-badge-count">4</span>
                </button>
              </div>

              <div className="sub-action-buttons">
                <button
                  type="button"
                  className="icon-btn-square"
                  onClick={() => {
                    if (onTriggerToast) onTriggerToast('Refreshing live telemetry floor counts...');
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
                <h3 className="banner-heading">Inventory Management — Store #104</h3>
                <p className="banner-subheading">
                  Live warehouse floor tally with automated reorder intelligence
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
              <div className="kpi-tile-number">4,820</div>
              <div className="kpi-tile-footer green">
                <span>✔</span>
                <span>98.1% Floor Availability</span>
              </div>
            </div>

            <div className="kpi-tile-card">
              <div className="kpi-tile-top">
                <span className="kpi-tile-label">LOW STOCK WARN</span>
                <div className="kpi-tile-icon gray">
                  <AlertTriangle size={16} />
                </div>
              </div>
              <div className="kpi-tile-number">42</div>
              <div className="kpi-tile-footer">
                <span>!</span>
                <span>Reorder dispatch ready</span>
              </div>
            </div>

            <div className="kpi-tile-card">
              <div className="kpi-tile-top">
                <span className="kpi-tile-label depleted">DEPLETED / STOCKOUT</span>
                <div className="kpi-tile-icon red">
                  <ShoppingCart size={16} />
                </div>
              </div>
              <div className="kpi-tile-number">9</div>
              <div className="kpi-tile-footer">
                <Truck size={12} />
                <span>3 In-Transit from Dallas Hub</span>
              </div>
            </div>

            <div className="kpi-tile-card">
              <div className="kpi-tile-top">
                <span className="kpi-tile-label">WEEKLY TURNOVER</span>
                <div className="kpi-tile-icon green">
                  <TrendingUp size={16} />
                </div>
              </div>
              <div className="kpi-tile-number">4.2x</div>
              <div className="kpi-tile-footer green">
                <span>↗</span>
                <span>+0.4x vs regional avg</span>
              </div>
            </div>
          </div>

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
                            onClick={() => {
                              if (onTriggerToast) onTriggerToast(`Viewing audit history for ${item.sku}.`);
                            }}
                            title="More Options"
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
              <span>Showing records 1 to {filteredItems.length} of 4,820 items</span>
              <div className="pagination-cluster">
                <button type="button" className="pagination-btn">Prev</button>
                <button type="button" className="pagination-btn active">1</button>
                <button type="button" className="pagination-btn">2</button>
                <button type="button" className="pagination-btn">3</button>
                <button type="button" className="pagination-btn">Next</button>
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
                <label className="modal-field-label">Target Fulfillment Hub</label>
                <input
                  type="text"
                  className="modal-field-input"
                  defaultValue="Dallas Regional Distribution Center #02"
                  disabled
                />
              </div>
              <div>
                <label className="modal-field-label">Emergency Restock Items</label>
                <div style={{ fontSize: '12.5px', color: '#334155', background: '#F8FAFC', padding: '10px', borderRadius: '8px' }}>
                  • 42 Low-Stock items identified<br />
                  • 9 Out-of-Stock items flagged for immediate priority dispatch
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
                onClick={() => {
                  if (onTriggerToast) {
                    onTriggerToast('Batch quick-restock order PO-99120 submitted to Dallas Hub!');
                  }
                  setShowQuickRestockModal(false);
                }}
              >
                Confirm Dispatch
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
