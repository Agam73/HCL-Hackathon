import React, { useCallback, useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AdminSidebar from './AdminSidebar';
import AdminNavbar from './AdminNavbar';
import DashboardPage from './DashboardPage';
import KnowledgeBasePage from './KnowledgeBasePage';
import InventoryPage from './InventoryPage';
import ProductsPage from './ProductsPage';
import StoresPage from './StoresPage';
import { adminApi } from '../api/client';
import './admin-extras.css';

export default function AdminLayout({ onTriggerToast }) {
  const [selectedStore, setSelectedStore] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Every store and warehouse, open or closed - GET /stores?activeOnly=false
  const [stores, setStores] = useState([]);
  const reloadStores = useCallback(
    () =>
      adminApi
        .get('/stores', { size: 100, activeOnly: 'false' })
        .then(setStores)
        .catch((err) => onTriggerToast?.(err.message)),
    [onTriggerToast]
  );
  useEffect(() => {
    reloadStores();
  }, [reloadStores]);

  // The inventory table is per store; "All Stores" falls back to the first one.
  const inventoryStoreId = selectedStore === 'all' ? stores[0]?.id : selectedStore;

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
          stores={stores}
        />

        {/* Scrollable Sub-Page Views */}
        <main className="main-content-scroll">
          <div className="content-container">
            <Routes>
              <Route path="/" element={<DashboardPage onTriggerToast={onTriggerToast} />} />
              <Route path="/dashboard" element={<DashboardPage onTriggerToast={onTriggerToast} />} />
              <Route path="/knowledge-base" element={<KnowledgeBasePage onTriggerToast={onTriggerToast} />} />
              <Route
                path="/inventory"
                element={
                  <InventoryPage
                    stores={stores}
                    storeId={inventoryStoreId}
                    onStoreChange={setSelectedStore}
                    onTriggerToast={onTriggerToast}
                  />
                }
              />
              <Route path="/products" element={<ProductsPage onTriggerToast={onTriggerToast} />} />
              <Route
                path="/stores"
                element={<StoresPage stores={stores} reloadStores={reloadStores} onTriggerToast={onTriggerToast} />}
              />
              <Route path="*" element={<Navigate to="/admin" replace />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
}
