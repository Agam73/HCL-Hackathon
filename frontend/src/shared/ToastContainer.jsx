import React from 'react';
import { Sparkles } from 'lucide-react';

export default function ToastContainer({ toasts }) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className="toast-pill">
          <Sparkles size={16} className="toast-icon" />
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
