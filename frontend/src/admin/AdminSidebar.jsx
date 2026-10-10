import React from 'react';
import { 
  LayoutDashboard, 
  BookOpen, 
  Package
} from 'lucide-react';

export default function AdminSidebar({ activeNav, setActiveNav }) {
  const mainNavItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'knowledge-base', label: 'Knowledge Base', icon: BookOpen },
    { id: 'inventory', label: 'Inventory', icon: Package },
  ];

  return (
    <aside className="sidebar-container">
      {/* Brand Header */}
      <div className="sidebar-brand">
        <div className="brand-logo-wrap">
          <div className="brand-logo-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L3 7L12 12L21 7L12 2Z" fill="#2563EB" />
              <path d="M3 17L12 22L21 17" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M3 12L12 17L21 12" stroke="#3B82F6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="brand-text-wrap">
            <h1 className="brand-title">NovaMart</h1>
            <span className="brand-subtitle">AI Retail Ops</span>
          </div>
        </div>
      </div>

      {/* Main Admin Navigation */}
      <nav className="sidebar-nav">
        <ul className="nav-list">
          {mainNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeNav === item.id;
            return (
              <li key={item.id} className="nav-item">
                <button
                  type="button"
                  className={`nav-button ${isActive ? 'active' : ''}`}
                  onClick={() => {
                    if (setActiveNav) setActiveNav(item.id);
                    const elem = document.getElementById(item.id);
                    if (elem) {
                      elem.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                  }}
                >
                  <Icon className="nav-icon" size={18} />
                  <span className="nav-label">{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Bottom AI Status Widget */}
      <div className="sidebar-footer">
        <div className="engine-status-card">
          <div className="engine-status-header">
            <div className="pulsing-dot-wrap">
              <span className="pulsing-dot-core"></span>
              <span className="pulsing-dot-wave"></span>
            </div>
            <span className="engine-title">AI Engine Online</span>
          </div>
          <div className="engine-meta">
            <span className="engine-subtext">Core System</span>
            <span className="engine-version">v2.4</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
