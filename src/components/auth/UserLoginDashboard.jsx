import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';

export default function UserLoginDashboard({ isMobileComandera = false }) {
  const {
    users,
    switchUser,
    theme,
    toggleTheme,
    activeShift,
    tables,
    orders,
    setIsQrModalOpen
  } = useApp();

  const [selectedUser, setSelectedUser] = useState(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [roleFilter, setRoleFilter] = useState('todos');

  const roleLabels = {
    admin: 'Encargado / Admin',
    cajero: 'Cajero',
    mozo: 'Mozo de salón'
  };

  const getRoleIcon = (u) => {
    if (u.avatar?.startsWith('fa-')) return u.avatar;
    if (u.role === 'admin') return 'fa-solid fa-user-shield';
    if (u.role === 'cajero') return 'fa-solid fa-cash-register';
    return 'fa-solid fa-user-tie';
  };

  const verifyPin = useCallback(async (inputPin) => {
    const cleanPin = String(inputPin || '').trim();
    const matched = (users || []).find(u => String(u.pin).trim() === cleanPin);

    if (selectedUser && matched && matched.id !== selectedUser.id) {
      setError(`Ese PIN no corresponde a ${selectedUser.name}.`);
      setPin('');
      return;
    }

    if (matched) {
      setPin('');
      switchUser(matched);
      return;
    }

    try {
      const res = await api.loginWithPin(cleanPin);
      if (res?.user) {
        if (selectedUser && res.user.id !== selectedUser.id) {
          setError(`Ese PIN no corresponde a ${selectedUser.name}.`);
          setPin('');
          return;
        }
        setPin('');
        switchUser(res.user);
      }
    } catch {
      setError('Ese PIN no coincide con ningún operador registrado.');
      setPin('');
    }
  }, [users, selectedUser, switchUser]);

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
    const onKeyDown = (e) => {
      // Do not intercept keys if QR modal is open
      if (document.querySelector('[role="dialog"]')) return;
      if (/^[0-9]$/.test(e.key)) {
        handleKeyPress(e.key);
      } else if (e.key === 'Backspace') {
        handleDelete();
      } else if (e.key === 'Escape') {
        setPin('');
        setSelectedUser(null);
        setError('');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleKeyPress, handleDelete]);

  const filteredUsers = (users || []).filter(u => {
    if (isMobileComandera && roleFilter === 'todos') return true;
    if (roleFilter === 'todos') return true;
    return u.role === roleFilter;
  });

  const openTablesCount = (tables || []).filter(t => t.status !== 'libre').length;
  const activeOrdersCount = (orders || []).filter(o => o.status === 'abierto' || o.status === 'cuenta_pedida').length;

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      {/* Header */}
      <header className="bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] sticky top-0 z-30">
        <nav
          aria-label="Barra de acceso al sistema"
          className="max-w-6xl mx-auto px-3 sm:px-6 py-3 flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-8 h-8 rounded bg-[var(--accent-brand-bg)] border border-[var(--accent-brand-border)] text-[var(--accent-brand)] font-display font-extrabold text-sm flex items-center justify-center shrink-0">
              GP
            </span>
            <div className="min-w-0">
              <h1 className="font-display font-bold text-base sm:text-lg text-[var(--text-primary)] truncate leading-tight">
                {isMobileComandera ? 'Comandera Móvil · Acceso' : 'Acceso de operadores'}
              </h1>
              <p className="text-xs text-[var(--text-secondary)] hidden sm:block">
                {isMobileComandera
                  ? 'Terminal de salón sincronizada con caja central'
                  : 'Seleccioná tu perfil o ingresá tu clave PIN de 4 dígitos para iniciar turno'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!isMobileComandera && (
              <button
                type="button"
                onClick={() => setIsQrModalOpen(true)}
                aria-label="Vincular comandera móvil por QR"
                className="pos-btn-secondary px-3"
              >
                <i className="fa-solid fa-qrcode text-sm text-[var(--accent-brand)]" aria-hidden="true"></i>
                <span className="text-xs font-semibold">Comandera QR</span>
              </button>
            )}

            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'graphite' ? 'Cambiar a tema Papel claro' : 'Cambiar a tema Grafito oscuro'}
              className="pos-btn-secondary px-3"
            >
              <i
                className={`fa-solid ${theme === 'graphite' ? 'fa-sun' : 'fa-moon'} text-sm text-[var(--text-secondary)]`}
                aria-hidden="true"
              ></i>
              <span className="hidden sm:inline text-xs font-semibold">
                {theme === 'graphite' ? 'Claro' : 'Grafito'}
              </span>
            </button>
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-3 sm:px-6 py-5 sm:py-8 flex flex-col justify-center">
        {/* Operational Strip */}
        <div className="mb-5 pos-panel px-4 py-3 flex flex-wrap items-center justify-between gap-3 bg-[var(--bg-surface)]">
          <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm">
            <span className={`pos-badge ${activeShift ? 'pos-badge-open' : 'pos-badge-danger'}`}>
              <span
                className={`w-2 h-2 rounded-full ${
                  activeShift ? 'bg-[var(--status-open-bar)]' : 'bg-[var(--status-danger-bar)]'
                }`}
                aria-hidden="true"
              ></span>
              <span className="font-mono">
                {activeShift ? `Turno #${activeShift.shiftNumber} abierto` : 'Caja cerrada'}
              </span>
            </span>
            <span className="text-[var(--text-secondary)] font-mono">
              {openTablesCount} mesas ocupadas · {activeOrdersCount} comandas en curso
            </span>
          </div>

          <div className="text-xs text-[var(--text-muted)] font-mono">
            Sincronización multicanal activa
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Column: Operator Profiles */}
          <div className="lg:col-span-7 space-y-4">
            <div className="pos-panel overflow-hidden">
              <div className="px-4 py-3.5 border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="font-display font-bold text-base text-[var(--text-primary)]">
                    Perfiles activos ({filteredUsers.length})
                  </h2>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Elegí tu usuario y digitá tu PIN para entrar a tu puesto
                  </p>
                </div>

                <div className="pos-segment-group self-start sm:self-auto" role="group" aria-label="Filtrar por puesto">
                  {[
                    { id: 'todos', label: 'Todos' },
                    { id: 'mozo', label: 'Mozos' },
                    { id: 'cajero', label: 'Caja' },
                    { id: 'admin', label: 'Admin' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      aria-pressed={roleFilter === tab.id}
                      onClick={() => setRoleFilter(tab.id)}
                      className="pos-segment-btn text-xs px-2.5"
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="divide-y divide-[var(--border-subtle)]">
                {filteredUsers.map(u => {
                  const isSelected = selectedUser?.id === u.id;
                  return (
                    <div
                      key={u.id}
                      className={`p-3.5 sm:px-4 transition-colors flex flex-wrap items-center justify-between gap-3 ${
                        isSelected
                          ? 'bg-[var(--bg-elevated)] border-l-4 border-l-[var(--accent-brand)]'
                          : 'hover:bg-[var(--bg-hover)]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedUser(isSelected ? null : u);
                          setPin('');
                          setError('');
                        }}
                        className="flex items-center gap-3 text-left min-h-[44px] flex-1 min-w-[180px]"
                      >
                        <span className="w-10 h-10 rounded bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--accent-brand)] flex items-center justify-center text-sm shrink-0">
                          <i className={getRoleIcon(u)} aria-hidden="true"></i>
                        </span>
                        <div className="min-w-0">
                          <div className="font-bold text-sm text-[var(--text-primary)] truncate">
                            {u.name}
                          </div>
                          <div className="text-xs text-[var(--text-secondary)] flex items-center gap-2">
                            <span>{roleLabels[u.role] || u.role}</span>
                            <span>·</span>
                            <span className="font-mono text-[var(--text-muted)]">PIN {u.pin}</span>
                          </div>
                        </div>
                      </button>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => switchUser(u)}
                          className="pos-btn-secondary text-xs px-3"
                        >
                          <i className="fa-solid fa-arrow-right-to-bracket text-xs text-[var(--accent-brand)]" aria-hidden="true"></i>
                          <span>Entrar</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {!isMobileComandera && (
              <div className="pos-panel p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-l-4 border-l-[var(--accent-brand)]">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <i className="fa-solid fa-mobile-screen-button text-sm text-[var(--accent-brand)]" aria-hidden="true"></i>
                    <h2 className="font-display font-bold text-sm text-[var(--text-primary)]">
                      Comandera móvil independiente para salón
                    </h2>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Los mozos pueden escanear el código QR con su teléfono para cargar mesas en movilidad y sincronizar con esta terminal.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsQrModalOpen(true)}
                    className="pos-btn-secondary text-xs px-3"
                  >
                    <i className="fa-solid fa-qrcode text-xs text-[var(--accent-brand)]" aria-hidden="true"></i>
                    <span>Ver QR</span>
                  </button>
                  <a
                    href="/?mode=comandera"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="pos-btn-primary text-xs px-3"
                  >
                    <i className="fa-solid fa-up-right-from-square text-xs" aria-hidden="true"></i>
                    <span>Abrir móvil</span>
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: PIN Keypad */}
          <div className="lg:col-span-5 pos-panel p-4 sm:p-5 space-y-4">
            <div className="border-b border-[var(--border-subtle)] pb-3 flex items-center justify-between gap-2">
              <div>
                <h2 className="font-display font-bold text-base text-[var(--text-primary)]">
                  Ingreso con PIN
                </h2>
                <p className="text-xs text-[var(--text-secondary)]">
                  {selectedUser
                    ? `Clave de 4 dígitos para ${selectedUser.name}`
                    : 'Digitá tu código de 4 números en el teclado'}
                </p>
              </div>
              {selectedUser && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedUser(null);
                    setPin('');
                    setError('');
                  }}
                  className="pos-btn-ghost text-xs px-2.5"
                >
                  Todos
                </button>
              )}
            </div>

            {/* 4-Digit Indicator */}
            <div className="space-y-2">
              <div className="flex justify-center gap-3" aria-label={`PIN ingresado: ${pin.length} de 4 dígitos`}>
                {[0, 1, 2, 3].map(i => {
                  const filled = pin.length > i;
                  return (
                    <div
                      key={i}
                      className={`w-12 h-12 rounded flex items-center justify-center text-lg font-mono font-bold border transition-colors ${
                        filled
                          ? 'border-[var(--accent-brand)] bg-[var(--accent-brand-bg)] text-[var(--text-primary)]'
                          : 'border-[var(--border-strong)] bg-[var(--bg-subtle)] text-[var(--text-muted)]'
                      }`}
                    >
                      {filled ? '*' : ''}
                    </div>
                  );
                })}
              </div>

              {error ? (
                <p role="alert" className="text-center text-xs font-semibold text-[var(--status-danger-fg)]">
                  {error}
                </p>
              ) : (
                <p className="text-center text-xs text-[var(--text-secondary)]">
                  También podés usar el teclado numérico físico
                </p>
              )}
            </div>

            {/* Keypad Grid */}
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleKeyPress(num)}
                  className="pos-btn-secondary min-h-[48px] text-base font-mono font-bold"
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
                className="pos-btn-secondary min-h-[48px] text-xs font-semibold text-[var(--status-danger-fg)]"
              >
                Limpiar
              </button>

              <button
                type="button"
                onClick={() => handleKeyPress(0)}
                className="pos-btn-secondary min-h-[48px] text-base font-mono font-bold"
              >
                0
              </button>

              <button
                type="button"
                onClick={handleDelete}
                aria-label="Borrar último dígito"
                className="pos-btn-secondary min-h-[48px] text-sm"
              >
                <i className="fa-solid fa-delete-left" aria-hidden="true"></i>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 sm:px-6 py-2.5 text-xs text-[var(--text-secondary)]">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-display font-bold text-[var(--text-primary)]">GastroPOS</span>
            <span>·</span>
            <span>Operador: <strong className="text-[var(--text-primary)]">Sin sesión iniciada</strong></span>
          </div>
          <div className="flex items-center gap-3 font-mono">
            <span>{activeShift ? `Turno #${activeShift.shiftNumber} abierto` : 'Caja cerrada'}</span>
            <span>·</span>
            <span>Tema: {theme === 'graphite' ? 'Grafito Táctil' : 'Papel Técnico'}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
