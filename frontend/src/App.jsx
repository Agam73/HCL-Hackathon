import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';

// Route-based portal components
import AdminLayout from './admin/AdminLayout';
import StoreManagerDashboard from './store-manager/StoreManagerDashboard';
import StoreManagerDashboardClassic from './store-manager/StoreManagerDashboardClassic';
import CustomerStorefront from './customer/CustomerStorefront';
import CustomerStorefrontClassic from './customer/CustomerStorefrontClassic';
import LandingPage from './landing/LandingPage';
import AuthPage from './auth/AuthPage';
import ToastContainer from './shared/ToastContainer';
import RequireRole, { AdminGate } from './api/RequireRole';

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
        {/* 1. Customer Shopping Page at '/' - signed-in customers only; everyone else lands on /login */}
        <Route
          path="/"
          element={
            <RequireRole roles={['CUSTOMER']}>
              <CustomerStorefront onTriggerToast={addToast} />
            </RequireRole>
          }
        />
        <Route path="/customer-classic" element={<CustomerStorefrontClassic onTriggerToast={addToast} />} />

        {/* 2. Authentication: Login & Register */}
        <Route path="/login" element={<AuthPage mode="login" onTriggerToast={addToast} />} />
        <Route path="/register" element={<AuthPage mode="register" onTriggerToast={addToast} />} />

        {/* 3. Public Marketing Landing Page at '/landing' */}
        <Route path="/landing" element={<LandingPage onTriggerToast={addToast} />} />

        {/* 4. Store Manager at '/storemanager' - signed-in store managers only */}
        <Route
          path="/storemanager"
          element={
            <RequireRole roles={['STORE_MANAGER']}>
              <StoreManagerDashboard onTriggerToast={addToast} />
            </RequireRole>
          }
        />
        <Route path="/storemanager-classic" element={<StoreManagerDashboardClassic onTriggerToast={addToast} />} />

        {/* 5. Admin Portal at '/admin' - no login; opens only on an authorised admin PC */}
        <Route
          path="/admin/*"
          element={
            <AdminGate>
              <AdminLayout onTriggerToast={addToast} />
            </AdminGate>
          }
        />

        {/* Fallback to Customer Storefront */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Shared Floating Toasts */}
      <ToastContainer toasts={toasts} />
    </BrowserRouter>
  );
}
