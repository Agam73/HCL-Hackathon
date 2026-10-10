import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';

// Route-based portal components
import AdminLayout from './admin/AdminLayout';
import StoreManagerDashboard from './store-manager/StoreManagerDashboard';
import CustomerStorefront from './customer/CustomerStorefront';
import ToastContainer from './shared/ToastContainer';

export default function App() {
  const [toasts, setToasts] = useState([]);

  const addToast = (message) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  };

  return (
    <BrowserRouter>
      <Routes>
        {/* 1. Customer Shopping Page at '/' */}
        <Route path="/" element={<CustomerStorefront onTriggerToast={addToast} />} />

        {/* 2. Store Manager at '/storemanager' */}
        <Route path="/storemanager" element={<StoreManagerDashboard onTriggerToast={addToast} />} />

        {/* 3. Admin Portal at '/admin' and its dedicated sub-pages */}
        <Route path="/admin/*" element={<AdminLayout onTriggerToast={addToast} />} />

        {/* Fallback to Customer Storefront */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Shared Floating Toasts */}
      <ToastContainer toasts={toasts} />
    </BrowserRouter>
  );
}
