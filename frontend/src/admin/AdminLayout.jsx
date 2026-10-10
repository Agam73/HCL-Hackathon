import React, { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AdminSidebar from './AdminSidebar';
import AdminNavbar from './AdminNavbar';
import DashboardPage from './DashboardPage';
import KnowledgeBasePage from './KnowledgeBasePage';
import InventoryPage from './InventoryPage';

export default function AdminLayout({ onTriggerToast }) {
  const [selectedStore, setSelectedStore] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="app-layout">
      {/* Fixed Admin Sidebar */}
      <AdminSidebar />

      {/* Main Admin Viewport */}
      <div className="main-wrapper">
        <AdminNavbar
          selectedStore={selectedStore}
          setSelectedStore={setSelectedStore}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
        />

        {/* Scrollable Sub-Page Views */}
        <main className="main-content-scroll">
          <div className="content-container">
            <Routes>
              <Route path="/" element={<DashboardPage onTriggerToast={onTriggerToast} />} />
              <Route path="/dashboard" element={<DashboardPage onTriggerToast={onTriggerToast} />} />
              <Route path="/knowledge-base" element={<KnowledgeBasePage onTriggerToast={onTriggerToast} />} />
              <Route path="/inventory" element={<InventoryPage onTriggerToast={onTriggerToast} />} />
              <Route path="*" element={<Navigate to="/admin" replace />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
}
