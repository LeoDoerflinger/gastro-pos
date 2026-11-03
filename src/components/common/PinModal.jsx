import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';

export default function PinModal() {
  const { isPinModalOpen, setIsPinModalOpen, switchUser, currentUser, users, refreshData } = useApp();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const verifyPin = useCallback(async (inputPin) => {
    const cleanPin = String(inputPin || '').trim();
    const matched = (users || []).find(u => String(u.pin).trim() === cleanPin);
    if (matched) {
      setPin('');
      switchUser(matched);
      setIsPinModalOpen(false);
      return;
    }
    try {
      const res = await api.loginWithPin(cleanPin);
      if (res.user) {
        setPin('');
        switchUser(res.user);
        setIsPinModalOpen(false);
      }
    } catch (err) {
      setError('Ese PIN no coincide con ningún usuario registrado.');
      setPin('');
    }
  }, [users, switchUser, setIsPinModalOpen]);

  const handleKeyPress = useCallback((num) => {
    setError('');
    setPin(prev => {
      if (prev.length >= 4) return prev;
      const nextPin = prev + String(num);
      if (nextPin.length === 4) {
        setTimeout(() => verifyPin(nextPin), 0);
      }
      return nextPin;
    });
  }, [verifyPin]);

  const handleDelete = useCallback(() => {
    setPin(prev => prev.slice(0, -1));
    setError('');
  }, []);

  useEffect(() => {
    if (isPinModalOpen) {
      setPin('');
      setError('');
      refreshData();
    }
  }, [isPinModalOpen, refreshData]);

  useEffect(() => {
    if (!isPinModalOpen) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsPinModalOpen(false);
      } else if (/^[0-9]$/.test(e.key)) {
        handleKeyPress(e.key);
      } else if (e.key === 'Backspace') {
        handleDelete();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isPinModalOpen, setIsPinModalOpen, handleKeyPress, handleDelete]);

  if (!isPinModalOpen) return null;

  const handleDirectSelect = (user) => {
    switchUser(user);
    setIsPinModalOpen(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--backdrop-overlay)] p-3"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pin-modal-title"
    >
      <div className="pos-panel w-full max-w-md overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-4 py-3 border-b border-[var(--border-subtle)] flex items-center justify-between bg-[var(--bg-subtle)]">
          <div className="flex items-center gap-2.5">
            <i className="fa-solid fa-key text-[var(--accent-brand)] text-sm" aria-hidden="true"></i>
            <h2 id="pin-modal-title" className="font-display font-bold text-base text-[var(--text-primary)]">
              Cambiar usuario
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setIsPinModalOpen(false)}
            aria-label="Cerrar ventana de cambio de usuario"
            className="pos-btn-ghost"
          >
            <i className="fa-solid fa-xmark text-base" aria-hidden="true"></i>
          </button>
        </div>

        {/* Quick staff select list */}
        <div className="p-4 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]">
          <p className="text-xs font-semibold text-[var(--text-secondary)] mb-2.5">
            Acceso rápido de turno (o ingresá tu PIN abajo):
          </p>
          <div className="grid grid-cols-2 gap-2">
            {users.map(u => {
              const uIcon = u.avatar?.startsWith('fa-')
                ? u.avatar
                : (u.role === 'admin'
                  ? 'fa-solid fa-user-shield'
                  : u.role === 'cajero'
                  ? 'fa-solid fa-cash-register'
                  : 'fa-solid fa-user-tie');
              const isCurrent = currentUser.id === u.id;
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => handleDirectSelect(u)}
                  className={`min-h-[52px] flex items-center gap-2.5 px-3 py-2 rounded border text-left transition-colors ${
                    isCurrent
                      ? 'bg-[var(--bg-elevated)] border-[var(--border-strong)] border-l-4 border-l-[var(--accent-brand)] text-[var(--text-primary)]'
                      : 'bg-[var(--bg-subtle)] border-[var(--border-subtle)] hover:border-[var(--border-strong)] text-[var(--text-primary)]'
                  }`}
                >
                  <span className="w-7 h-7 flex items-center justify-center bg-[var(--bg-surface)] text-[var(--accent-brand)] rounded border border-[var(--border-subtle)] text-xs shrink-0">
                    <i className={uIcon} aria-hidden="true"></i>
                  </span>
                  <div className="overflow-hidden">
                    <div className="text-sm font-bold truncate leading-tight">{u.name}</div>
                    <div className="text-xs text-[var(--text-secondary)] font-mono">
                      PIN {u.pin}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* PIN input & tactile keypad */}
        <div className="p-5 flex flex-col items-center justify-center bg-[var(--bg-subtle)]">
          <p className="text-sm font-medium text-[var(--text-secondary)] mb-3">
            Marcá tu clave de 4 dígitos
          </p>

          <div className="flex items-center gap-3 mb-3" aria-label={`Dígitos ingresados: ${pin.length} de 4`}>
            {[0, 1, 2, 3].map(idx => (
              <div
                key={idx}
                className={`w-4 h-4 rounded border-2 transition-colors ${
                  pin.length > idx
                    ? 'bg-[var(--accent-brand)] border-[var(--accent-brand)]'
                    : 'border-[var(--border-strong)] bg-[var(--bg-surface)]'
                }`}
              />
            ))}
          </div>

          {error && (
            <p className="text-xs text-[var(--status-danger-fg)] bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] px-3 py-1.5 rounded flex items-center gap-2 mb-2" role="alert">
              <i className="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
              <span>{error}</span>
            </p>
          )}

          <div className="grid grid-cols-3 gap-2 w-full max-w-[256px] mt-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
              <button
                key={num}
                type="button"
                onClick={() => handleKeyPress(num)}
                className="pos-btn-secondary min-h-[52px] font-mono font-bold text-lg"
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setPin('');
                setError('');
              }}
              aria-label="Limpiar PIN"
              className="pos-btn-secondary min-h-[52px] text-xs font-bold"
            >
              Limpiar
            </button>
            <button
              type="button"
              onClick={() => handleKeyPress(0)}
              className="pos-btn-secondary min-h-[52px] font-mono font-bold text-lg"
            >
              0
            </button>
            <button
              type="button"
              onClick={handleDelete}
              aria-label="Borrar último dígito"
              className="pos-btn-secondary min-h-[52px]"
            >
              <i className="fa-solid fa-delete-left text-base" aria-hidden="true"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
