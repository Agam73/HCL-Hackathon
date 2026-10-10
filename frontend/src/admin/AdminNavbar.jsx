import React, { useState } from 'react';
import { 
  Search, 
  ChevronDown, 
  Bell, 
  Store, 
  CheckCircle2, 
  AlertTriangle, 
  Sparkles, 
  ShieldCheck,
  X
} from 'lucide-react';

export default function AdminNavbar({ 
  selectedStore, 
  setSelectedStore, 
  searchQuery, 
  setSearchQuery,
  stores: storeList = []
}) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showStoreDropdown, setShowStoreDropdown] = useState(false);

  // Real stores from the backend (loaded by AdminLayout), plus the "all" option
  const stores = [
    { id: 'all', name: 'All Stores (Global)', code: 'GLOBAL' },
    ...storeList.map((s) => ({ id: s.id, name: `${s.name}${s.isActive ? '' : ' (closed)'}`, code: s.id })),
  ];

  const notifications = [
    {
      id: 1,
      type: 'warning',
      title: 'SKU-8842 Stockout Risk',
      time: '12m ago',
      desc: 'Depletion projected in under 48h at Store #104. Automated RPO-4401 generated.'
    },
    {
      id: 2,
      type: 'ai',
      title: 'RAG Knowledge Embeddings Refreshed',
      time: '45m ago',
      desc: '1,420 chunks synchronized for Store 104 Promotional Policies.'
    },
    {
      id: 3,
      type: 'success',
      title: 'Saturday Peak Volume Target Reached',
      time: '2h ago',
      desc: 'Revenue actualized at $198.4k across all omni-channel POS nodes.'
    }
  ];

  return (
    <header className="top-navbar">
      {/* Search Input */}
      <div className="navbar-search-wrapper">
        <Search className="search-icon" size={17} />
        <input
          type="text"
          className="navbar-search-input"
          placeholder="Search stores, SKUs, documents..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <div className="search-shortcut">
          <kbd>⌘K</kbd>
        </div>
      </div>

      {/* Right Controls */}
      <div className="navbar-right-controls">
        {/* Store Selector Dropdown */}
        <div className="store-selector-wrapper">
          <button
            type="button"
            className="store-selector-btn"
            onClick={() => setShowStoreDropdown(!showStoreDropdown)}
          >
            <Store size={15} className="store-icon" />
            <span className="store-selected-name">
              {stores.find(s => s.id === selectedStore)?.name || 'All Stores (Global)'}
            </span>
            <ChevronDown size={14} className={`chevron-icon ${showStoreDropdown ? 'rotate-180' : ''}`} />
          </button>

          {showStoreDropdown && (
            <div className="dropdown-menu store-dropdown">
              <div className="dropdown-header">Filter Active Location</div>
              {stores.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`dropdown-item ${selectedStore === s.id ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedStore(s.id);
                    setShowStoreDropdown(false);
                  }}
                >
                  <span className="store-item-name">{s.name}</span>
                  <span className="store-badge-code">{s.code}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Notifications Icon */}
        <div className="notification-wrapper">
          <button
            type="button"
            className="notification-btn"
            onClick={() => setShowNotifications(!showNotifications)}
            aria-label="Notifications"
          >
            <Bell size={18} />
            <span className="notification-badge-dot"></span>
          </button>

          {showNotifications && (
            <div className="dropdown-menu notifications-dropdown">
              <div className="notifications-header">
                <div className="flex-row items-center gap-2">
                  <span className="notifications-title">Notifications</span>
                  <span className="notif-count-pill">3 New</span>
                </div>
                <button 
                  type="button" 
                  className="close-dropdown-btn"
                  onClick={() => setShowNotifications(false)}
                >
                  <X size={15} />
                </button>
              </div>

              <div className="notifications-list">
                {notifications.map((n) => (
                  <div key={n.id} className="notification-item">
                    <div className="notif-icon-wrap">
                      {n.type === 'warning' && <AlertTriangle size={15} className="text-warning" />}
                      {n.type === 'ai' && <Sparkles size={15} className="text-primary" />}
                      {n.type === 'success' && <CheckCircle2 size={15} className="text-success" />}
                    </div>
                    <div className="notif-content">
                      <div className="notif-top">
                        <span className="notif-title">{n.title}</span>
                        <span className="notif-time">{n.time}</span>
                      </div>
                      <p className="notif-desc">{n.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Admin Identity Widget (Replaces Sarah Jenkins) */}
        <div className="user-profile-widget">
          <div className="admin-avatar-pill-icon">
            <ShieldCheck size={18} />
          </div>
          <div className="user-meta-wrap">
            <div className="user-name">Fabulous 5</div>
            <div className="user-role">HCL Hackathon Admin</div>
          </div>
        </div>
      </div>
    </header>
  );
}
