import React from 'react';
import InventorySection from './InventorySection';

export default function InventoryPage({ onTriggerToast }) {
  return (
    <div className="admin-page-content inventory-page">
      <InventorySection onTriggerToast={onTriggerToast} />
    </div>
  );
}
