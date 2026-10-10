import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  BookOpen, 
  Package,
  Tags,
  Store
} from 'lucide-react';
import logoImg from '../assets/logo.png';

export default function AdminSidebar() {
  const location = useLocation();
  const navigate = useNavigate();

  const isKB = location.pathname.includes('/knowledge-base');
  const isInventory = location.pathname.includes('/inventory');
  const isProducts = location.pathname.includes('/products');
  const isStores = location.pathname.includes('/stores');
  const isDashboard = !isKB && !isInventory && !isProducts && !isStores;

  const mainNavItems = [
    { 
      id: 'dashboard', 
      label: 'Dashboard', 
      icon: LayoutDashboard,
      path: '/admin',
      active: isDashboard
    },
    { 
      id: 'knowledge-base', 
      label: 'Knowledge Base', 
      icon: BookOpen,
      path: '/admin/knowledge-base',
      active: isKB
    },
    { 
      id: 'inventory', 
      label: 'Inventory', 
      icon: Package,
      path: '/admin/inventory',
      active: isInventory
    },
    {
      id: 'products',
      label: 'Products',
      icon: Tags,
      path: '/admin/products',
      active: isProducts
    },
    {
      id: 'stores',
      label: 'Stores',
      icon: Store,
      path: '/admin/stores',
      active: isStores
    },
  ];

  const handleNavClick = (path) => {
    navigate(path);
    const scrollArea = document.querySelector('.main-content-scroll');
    if (scrollArea) {
      scrollArea.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <aside className="sidebar-container">
      {/* Brand Header */}
      <div className="sidebar-brand">
        <div className="brand-logo-wrap">
          <div className="brand-logo-icon">
            <img src={logoImg} alt="Fabulous 5" className="brand-img-logo" />
          </div>
          <div className="brand-text-wrap">
            <h1 className="brand-title">Fabulous 5</h1>
            <span className="brand-subtitle">HCL Hackathon Admin</span>
          </div>
        </div>
      </div>

      {/* Main Admin Navigation */}
      <nav className="sidebar-nav">
        <ul className="nav-list">
          {mainNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.id} className="nav-item">
                <button
                  type="button"
                  className={`nav-button ${item.active ? 'active' : ''}`}
                  onClick={() => handleNavClick(item.path)}
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
