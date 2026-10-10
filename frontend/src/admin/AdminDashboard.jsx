import React from 'react';
import DashboardPage from './DashboardPage';
import KnowledgeBasePage from './KnowledgeBasePage';
import InventoryPage from './InventoryPage';

export default function AdminDashboard({ activeNav, onTriggerToast }) {
  return (
    <div className="admin-page-router">
      {activeNav === 'dashboard' && (
        <DashboardPage onTriggerToast={onTriggerToast} />
      )}

      {activeNav === 'knowledge-base' && (
        <KnowledgeBasePage onTriggerToast={onTriggerToast} />
      )}

      {activeNav === 'inventory' && (
        <InventoryPage onTriggerToast={onTriggerToast} />
      )}
    </div>
  );
}
