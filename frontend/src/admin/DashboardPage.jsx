import React from 'react';
import AnalyticsSection from './AnalyticsSection';

export default function DashboardPage({ onTriggerToast }) {
  return (
    <div className="admin-page-content dashboard-page">
      <AnalyticsSection onTriggerRestockToast={onTriggerToast} />
    </div>
  );
}
