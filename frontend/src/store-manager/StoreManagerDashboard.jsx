import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Store, 
  Users, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Boxes, 
  QrCode, 
  Calendar,
  Sparkles,
  ShieldCheck,
  ShoppingBag
} from 'lucide-react';
import logoImg from '../assets/logo.png';

export default function StoreManagerDashboard({ onTriggerToast }) {
  const navigate = useNavigate();
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
    <div className="store-manager-container" style={{ padding: '24px 32px', minHeight: '100vh', background: 'var(--bg-app)' }}>
      {/* Top Header Banner */}
      <div className="persona-banner">
        <div className="flex-row items-center gap-3">
          <div className="brand-logo-icon" style={{ width: '36px', height: '36px' }}>
            <img src={logoImg} alt="Fabulous 5" className="brand-img-logo" />
          </div>
          <div>
            <div className="persona-tag" style={{ fontSize: '15px' }}>Fabulous 5 · Store Manager Portal</div>
            <div style={{ fontSize: '11.5px', color: '#64748B' }}>Store #104 (Austin Flagship) · Live Floor Operations</div>
          </div>
        </div>

        <div className="flex-row items-center gap-2">
          <button 
            type="button" 
            className="back-to-admin-btn"
            onClick={() => navigate('/admin')}
            title="Go to Admin Portal"
          >
            <ShieldCheck size={15} />
            <span>Go to Admin (/admin)</span>
          </button>
          <button 
            type="button" 
            className="back-to-admin-btn"
            style={{ background: '#F1F5F9', borderColor: '#CBD5E1', color: '#334155' }}
            onClick={() => navigate('/')}
            title="Go to Customer Storefront"
          >
            <ShoppingBag size={15} />
            <span>Storefront (/)</span>
          </button>
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
