import React from 'react';
import InventorySection from './InventorySection';
import { adminApi } from '../api/client';

export default function InventoryPage({ stores, storeId, onStoreChange, onTriggerToast }) {
  return (
    <div className="admin-page-content inventory-page">
      <InventorySection
        client={adminApi}
        stores={stores}
        storeId={storeId}
        onStoreChange={onStoreChange}
        onTriggerToast={onTriggerToast}
      />
    </div>
  );
}
