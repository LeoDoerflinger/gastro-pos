import React from 'react';
import { useApp } from '../../context/AppContext';

export default function Toast() {
  const { toast } = useApp();

  if (!toast) return null;

  const variants = {
    success: {
      icon: 'fa-solid fa-circle-check text-[var(--status-open-fg)]',
      bar: 'border-l-4 border-l-[var(--status-open-bar)]'
    },
    error: {
      icon: 'fa-solid fa-triangle-exclamation text-[var(--status-danger-fg)]',
      bar: 'border-l-4 border-l-[var(--status-danger-bar)]'
    },
    info: {
      icon: 'fa-solid fa-circle-info text-[var(--accent-brand)]',
      bar: 'border-l-4 border-l-[var(--accent-brand)]'
    }
  };

  const current = variants[toast.type] || variants.info;

  return (
    <div
      className="fixed bottom-4 right-4 left-4 sm:left-auto z-50 sm:max-w-sm pointer-events-none"
      role="status"
      aria-live="polite"
    >
      <div className={`pos-elevated px-4 py-3 flex items-center gap-3 shadow-xl pointer-events-auto ${current.bar}`}>
        <i className={`${current.icon} text-sm shrink-0`} aria-hidden="true"></i>
        <p className="text-sm font-medium text-[var(--text-primary)]">{toast.message}</p>
      </div>
    </div>
  );
}
