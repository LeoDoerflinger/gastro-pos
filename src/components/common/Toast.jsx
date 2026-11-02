import React from 'react';
import { useApp } from '../../context/AppContext';

export default function Toast() {
  const { toast } = useApp();

  if (!toast) return null;

  const icons = {
    success: <i className="fa-solid fa-check text-emerald-400 shrink-0 text-xs" aria-hidden="true"></i>,
    error: <i className="fa-solid fa-triangle-exclamation text-rose-400 shrink-0 text-xs" aria-hidden="true"></i>,
    info: <i className="fa-solid fa-circle-info text-sky-400 shrink-0 text-xs" aria-hidden="true"></i>
  };

  const borders = {
    success: 'border-l-2 border-l-emerald-500 border-[#27272a] bg-[#121215]',
    error: 'border-l-2 border-l-rose-500 border-[#27272a] bg-[#121215]',
    info: 'border-l-2 border-l-sky-500 border-[#27272a] bg-[#121215]'
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm">
      <div className={`flex items-center gap-2.5 px-3 py-2 rounded border shadow-xl ${borders[toast.type] || borders.info}`}>
        {icons[toast.type] || icons.info}
        <p className="text-xs font-mono text-zinc-200">{toast.message}</p>
      </div>
    </div>
  );
}
