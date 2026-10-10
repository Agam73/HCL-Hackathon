import React, { useState } from 'react';
import './App.css';

// Admin portal components
import AdminSidebar from './admin/AdminSidebar';
import AdminNavbar from './admin/AdminNavbar';
import AdminDashboard from './admin/AdminDashboard';
import ToastContainer from './shared/ToastContainer';

export default function App() {
  const [activeNav, setActiveNav] = useState('dashboard');
  const [selectedStore, setSelectedStore] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [toasts, setToasts] = useState([]);

  const addToast = (message) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  };

  return (
    <div className="app-layout">
      {/* Admin Sidebar */}
      <AdminSidebar
        activeNav={activeNav}
        setActiveNav={setActiveNav}
      />

      {/* Main Admin Viewport */}
      <div className="main-wrapper">
        <AdminNavbar
          selectedStore={selectedStore}
          setSelectedStore={setSelectedStore}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
        />

        {/* Admin Dashboard Page */}
        <main className="main-content-scroll">
          <div className="content-container">
            <AdminDashboard onTriggerToast={addToast} />
          </div>
        </main>
      </div>

      {/* Shared Floating Toasts */}
      <ToastContainer toasts={toasts} />
    </div>
  );
}
