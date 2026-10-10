import React from 'react';
import AnalyticsSection from './AnalyticsSection';
import RagSection from './RagSection';
import InventorySection from './InventorySection';

export default function AdminDashboard({ onTriggerToast }) {
  return (
    <div className="admin-dashboard-view">
      {/* 1. Store Analytics & Intelligence */}
      <AnalyticsSection onTriggerRestockToast={onTriggerToast} />

      {/* 2. RAG Knowledge Base & Document Index */}
      <RagSection onTriggerToast={onTriggerToast} />

      {/* 3. Live Inventory Overview */}
      <InventorySection onTriggerToast={onTriggerToast} />
    </div>
  );
}
