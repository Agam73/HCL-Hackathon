import React, { useState } from 'react';
import { 
  Store, 
  Users, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Boxes, 
  QrCode, 
  ArrowLeft,
  Calendar,
  Sparkles
} from 'lucide-react';

export default function StoreManagerView({ onBackToAdmin, onTriggerToast }) {
  const [tasks, setTasks] = useState([
    { id: 1, title: 'Restock Aisle 4 Organic Cold Brew', urgency: 'High', completed: false, assignedTo: 'Marcus K.' },
    { id: 2, title: 'POS Terminal #3 Firmware Sync & Receipt Paper Refill', urgency: 'Medium', completed: true, assignedTo: 'Elena V.' },
    { id: 3, title: 'Verify Fresh Bakery morning batch expiration tags', urgency: 'High', completed: false, assignedTo: 'David L.' },
    { id: 4, title: 'Receive shipment dock pallet #B-409 (Supplier PO-4401)', urgency: 'Critical', completed: false, assignedTo: 'Marcus K.' },
  ]);

  const toggleTask = (id) => {
    setTasks(prev => prev.map(t => {
      if (t.id === id) {
        const nextState = !t.completed;
        if (onTriggerToast && nextState) {
          onTriggerToast(`Task marked resolved: "${t.title}"`);
        }
        return { ...t, completed: nextState };
      }
      return t;
    }));
  };

  return (
    <div className="store-manager-container">
      {/* Header Banner */}
      <div className="persona-banner">
        <div className="flex-row items-center gap-3">
          <button 
            type="button" 
            className="back-to-admin-btn"
            onClick={onBackToAdmin}
          >
            <ArrowLeft size={16} />
            <span>Return to Admin View</span>
          </button>
          <div className="persona-tag">Persona: Store Floor Manager</div>
        </div>
        <div className="store-location-badge">
          <Store size={15} />
          <span>Store #104 (Austin Flagship)</span>
        </div>
      </div>

      <div className="manager-grid-layout">
        {/* Active Shift Overview */}
        <div className="manager-kpi-card">
          <div className="manager-kpi-title">Active Floor Staff</div>
          <div className="manager-kpi-number">14 / 16</div>
          <div className="manager-kpi-sub text-success">All critical zones covered</div>
        </div>

        <div className="manager-kpi-card">
          <div className="manager-kpi-title">Peak Foot Traffic ETA</div>
          <div className="manager-kpi-number">2:30 PM</div>
          <div className="manager-kpi-sub text-primary">+28% estimated weekend rush</div>
        </div>

        <div className="manager-kpi-card">
          <div className="manager-kpi-title">Unresolved Restock Tasks</div>
          <div className="manager-kpi-number">{tasks.filter(t => !t.completed).length}</div>
          <div className="manager-kpi-sub text-warning">2 critical shelf tasks</div>
        </div>
      </div>

      {/* Task Queue Card */}
      <div className="manager-task-card">
        <div className="task-card-header">
          <div className="flex-row items-center gap-2">
            <span className="section-blue-bullet"></span>
            <h3 className="card-title">Real-time Floor Operations & Restock Queue</h3>
          </div>
          <span className="badge-tag">AI Dispatched via Store Copilot</span>
        </div>

        <div className="task-items-list">
          {tasks.map((task) => (
            <div 
              key={task.id} 
              className={`manager-task-item ${task.completed ? 'completed' : ''}`}
              onClick={() => toggleTask(task.id)}
            >
              <div className="task-checkbox-wrap">
                <input 
                  type="checkbox" 
                  checked={task.completed} 
                  onChange={() => {}} 
                  className="task-checkbox"
                />
              </div>
              <div className="task-info">
                <span className="task-title-text">{task.title}</span>
                <span className="task-meta-text">Assigned: {task.assignedTo} · Urgency: <strong>{task.urgency}</strong></span>
              </div>
              <div className="task-status-chip">
                {task.completed ? 'Completed' : 'Action Needed'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
