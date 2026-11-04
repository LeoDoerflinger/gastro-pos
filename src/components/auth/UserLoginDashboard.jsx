import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import { formatUserRoleDisplay } from '../../utils/userRoleHelper';

export default function UserLoginDashboard({ isMobileComandera = false }) {
  const {
    users,
    switchUser,
    theme,
    toggleTheme,
    activeShift,
    tables,
    orders,
    setIsQrModalOpen,
    activeTenant,
    activeTenantId,
    tenantsList,
    switchTenant,
    businessConfig,
    showToast
  } = useApp();

  const [loginMode, setLoginMode] = useState('selector'); // 'selector' | 'corporate' | 'register'
  const [corporateEmail, setCorporateEmail] = useState('admin@prueba1.gp.com');
  const [corporatePassword, setCorporatePassword] = useState('admin123');
  const [corporateError, setCorporateError] = useState('');
  const [submittingCorp, setSubmittingCorp] = useState(false);

  // Registro de nuevo local / empresa
  const [regName, setRegName] = useState('');
  const [regSlug, setRegSlug] = useState('');
  const [regCuit, setRegCuit] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regAddress, setRegAddress] = useState('');
  const [regContactEmail, setRegContactEmail] = useState('');
  const [regPassword, setRegPassword] = useState('admin123');
  const [regPin, setRegPin] = useState('1234');
  const [submittingReg, setSubmittingReg] = useState(false);
  const [welcomeModalData, setWelcomeModalData] = useState(null);

  // PIN login
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

  const handleCorporateLogin = async (e) => {
    e?.preventDefault();
    setCorporateError('');
    if (!corporateEmail.trim()) {
      setCorporateError('Ingresá tu correo corporativo.');
      return;
    }
    setSubmittingCorp(true);
    try {
      const res = await api.loginCorporate({
        email: corporateEmail.trim(),
        password: corporatePassword.trim()
      });
      if (res?.user && res?.tenant) {
        await switchTenant(res.tenant.id, res.user);
        showToast(`Bienvenido a ${res.tenant.name}, ${res.user.name}`);
      }
    } catch (err) {
      setCorporateError(err.message || 'Credenciales corporativas inválidas');
    } finally {
      setSubmittingCorp(false);
    }
  };

  const handleRegisterBusiness = async (e) => {
    e.preventDefault();
    if (!regName.trim()) {
      showToast('Ingresá el nombre de tu local o negocio', 'error');
      return;
    }
    setSubmittingReg(true);
    try {
      const cleanSlug = (regSlug.trim() || regName.trim().toLowerCase().replace(/[^a-z0-9]/g, '')).slice(0, 20);
      const res = await api.registerTenant({
        name: regName.trim(),
        slug: cleanSlug,
        cuit: regCuit.trim(),
        phone: regPhone.trim(),
        address: regAddress.trim(),
        contactEmail: regContactEmail.trim(),
        adminPassword: regPassword.trim() || 'admin123',
        adminPin: regPin.trim() || '1234'
      });

      if (res?.success) {
        setWelcomeModalData(res);
      }
    } catch (err) {
      showToast(err.message || 'No se pudo registrar el negocio', 'error');
    } finally {
      setSubmittingReg(false);
    }
  };

  const handleEnterWithNewBusiness = async () => {
    if (!welcomeModalData) return;
    const { tenant, adminUser } = welcomeModalData;
    await switchTenant(tenant.id, adminUser);
    setWelcomeModalData(null);
    showToast(`Sesión iniciada como Administrador de ${tenant.name}`);
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
      setError('Ese PIN no coincide con ningún usuario de este local.');
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
    if (loginMode !== 'selector') return;
    const onKeyDown = (e) => {
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
  }, [loginMode, handleKeyPress, handleDelete]);

  const filteredUsers = (users || []).filter(u => {
    if (roleFilter === 'todos') return true;
    return u.role === roleFilter;
  });

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] flex flex-col justify-between p-4 sm:p-6 select-none">
      {/* Top Bar */}
      <header className="w-full max-w-5xl mx-auto flex items-center justify-between py-2 border-b border-[var(--border-subtle)] pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--accent-brand)] font-display font-extrabold text-base">
            GP
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display font-extrabold text-base sm:text-lg text-[var(--text-primary)] leading-tight">
                GastroPOS Multi-Local
              </h1>
              <span className="pos-badge pos-badge-brand text-[10px] font-mono">SaaS Córdoba</span>
            </div>
            <p className="text-xs text-[var(--text-secondary)]">
              Plataforma para bares, restaurantes y cafeterías
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isMobileComandera && (
            <button
              type="button"
              onClick={() => setIsQrModalOpen(true)}
              className="pos-btn-secondary text-xs px-3 min-h-[38px]"
              title="Vincular teléfono de mozo con QR"
            >
              <i className="fa-solid fa-qrcode text-xs text-[var(--accent-brand)]" aria-hidden="true"></i>
              <span className="hidden sm:inline">Vincular celular</span>
            </button>
          )}

          <button
            type="button"
            onClick={toggleTheme}
            className="pos-btn-secondary min-h-[38px] px-2.5"
            aria-label="Cambiar tema"
          >
            <i className={`fa-solid ${theme === 'paper' ? 'fa-moon' : 'fa-sun'} text-xs`} aria-hidden="true"></i>
          </button>
        </div>
      </header>

      {/* Main Tabs Selection */}
      <main className="w-full max-w-5xl mx-auto my-auto py-6 space-y-6">
        <div className="flex justify-center">
          <div className="pos-segment-group p-1" role="tablist" aria-label="Modalidad de ingreso">
            <button
              type="button"
              role="tab"
              aria-selected={loginMode === 'selector'}
              onClick={() => { setLoginMode('selector'); setError(''); }}
              className={`pos-segment-btn text-xs sm:text-sm px-4 py-2 font-semibold ${loginMode === 'selector' ? 'bg-[var(--btn-primary-bg)] text-[var(--btn-primary-fg)]' : ''}`}
            >
              <i className="fa-solid fa-store text-xs mr-1.5" aria-hidden="true"></i>
              <span>Establecimientos y Personal</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={loginMode === 'corporate'}
              onClick={() => { setLoginMode('corporate'); setCorporateError(''); }}
              className={`pos-segment-btn text-xs sm:text-sm px-4 py-2 font-semibold ${loginMode === 'corporate' ? 'bg-[var(--btn-primary-bg)] text-[var(--btn-primary-fg)]' : ''}`}
            >
              <i className="fa-solid fa-envelope text-xs mr-1.5" aria-hidden="true"></i>
              <span>Ingreso Corporativo</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={loginMode === 'register'}
              onClick={() => setLoginMode('register')}
              className={`pos-segment-btn text-xs sm:text-sm px-4 py-2 font-semibold ${loginMode === 'register' ? 'bg-[var(--btn-primary-bg)] text-[var(--btn-primary-fg)]' : ''}`}
            >
              <i className="fa-solid fa-plus text-xs mr-1.5" aria-hidden="true"></i>
              <span>Registrar Local</span>
            </button>
          </div>
        </div>

        {/* 1. INGRESO CORPORATIVO (EMAIL + CONTRASEÑA O PIN) */}
        {loginMode === 'corporate' && (
          <div className="pos-panel max-w-md mx-auto p-6 sm:p-7 space-y-5 shadow-2xl border-t-4 border-t-[var(--accent-brand)]">
            <div className="space-y-1 text-center">
              <h2 className="font-display font-extrabold text-lg text-[var(--text-primary)]">
                Acceso Corporativo al Local
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Ingresá con tu usuario corporativo <code className="font-mono text-[var(--text-primary)]">@local.gp.com</code>
              </p>
            </div>

            {/* Quick Test Chips */}
            <div className="space-y-1.5 bg-[var(--bg-subtle)] p-3 rounded border border-[var(--border-subtle)]">
              <span className="text-[11px] font-semibold text-[var(--text-secondary)] block">
                Acceso preconfigurado para prueba inmediata:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: 'Local 1 (admin)', email: 'admin@prueba1.gp.com', pass: 'admin123' }
                ].map(demo => (
                  <button
                    key={demo.email}
                    type="button"
                    onClick={() => {
                      setCorporateEmail(demo.email);
                      setCorporatePassword(demo.pass);
                      setCorporateError('');
                    }}
                    className="text-[11px] font-mono px-2 py-1 rounded bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] transition-colors"
                  >
                    {demo.label}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleCorporateLogin} className="space-y-3.5">
              <div>
                <label htmlFor="corp-email" className="pos-label">Correo corporativo:</label>
                <input
                  id="corp-email"
                  type="email"
                  required
                  placeholder="ej. admin@prueba1.gp.com"
                  value={corporateEmail}
                  onChange={(e) => setCorporateEmail(e.target.value)}
                  className="pos-input font-mono text-sm"
                />
              </div>

              <div>
                <label htmlFor="corp-pass" className="pos-label">Contraseña o clave de acceso:</label>
                <input
                  id="corp-pass"
                  type="password"
                  required
                  placeholder="Contraseña del usuario"
                  value={corporatePassword}
                  onChange={(e) => setCorporatePassword(e.target.value)}
                  className="pos-input font-mono text-sm"
                />
                <span className="text-[11px] text-[var(--text-muted)] mt-1 block">
                  Contraseña predeterminada: <strong className="font-mono text-[var(--text-primary)]">admin123</strong>
                </span>
              </div>

              {corporateError && (
                <div className="p-2.5 rounded bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] text-xs text-[var(--status-danger-fg)] font-semibold flex items-center gap-2">
                  <i className="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
                  <span>{corporateError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={submittingCorp}
                className="pos-btn-primary w-full py-2.5 mt-2"
              >
                <i className="fa-solid fa-arrow-right-to-bracket text-xs" aria-hidden="true"></i>
                <span>{submittingCorp ? 'Iniciando sesión...' : 'Ingresar al sistema'}</span>
              </button>
            </form>
          </div>
        )}

        {/* 2. SELECTOR DE LOCALES DEMO & PIN TÁCTIL */}
        {loginMode === 'selector' && (
          <div className="space-y-5">
            {/* Venue Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {(tenantsList && tenantsList.length > 0 ? tenantsList : [
                {
                  id: 'prueba1',
                  name: 'Local 1',
                  zone: 'Sucursal 1',
                  specialty: 'Bar, tapas y salón principal',
                  adminEmail: 'admin@prueba1.gp.com',
                  icon: 'fa-store'
                }
              ]).map(venue => {
                const isActive = activeTenantId === venue.id;
                const venueIcon = venue.icon || 'fa-store';
                const adminEmail = venue.adminEmail || `admin@${venue.slug || venue.id}.gp.com`;
                const subtitle = venue.specialty
                  ? `${venue.zone ? venue.zone + ' · ' : ''}${venue.specialty}`
                  : (venue.address || 'Córdoba Capital');
                return (
                  <button
                    key={venue.id}
                    type="button"
                    onClick={() => {
                      switchTenant(venue.id);
                      setSelectedUser(null);
                      setPin('');
                      setError('');
                    }}
                    className={`pos-panel p-4 text-left transition-all border-2 flex flex-col justify-between ${
                      isActive
                        ? 'border-[var(--accent-brand)] shadow-lg bg-[var(--bg-elevated)]'
                        : 'border-[var(--border-subtle)] hover:border-[var(--border-strong)]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between pb-2">
                        <span className={`w-8 h-8 rounded flex items-center justify-center text-xs ${isActive ? 'bg-[var(--accent-brand)] text-white' : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)]'}`}>
                          <i className={`fa-solid ${venueIcon}`} aria-hidden="true"></i>
                        </span>
                        {isActive && (
                          <span className="pos-badge pos-badge-brand text-[10px]">Activo</span>
                        )}
                      </div>
                      <h3 className="font-display font-bold text-sm text-[var(--text-primary)]">{venue.name}</h3>
                      <p className="text-xs text-[var(--text-secondary)]">{subtitle}</p>
                    </div>
                    <div className="pt-2 mt-2 border-t border-[var(--border-subtle)] text-[11px] font-mono text-[var(--text-muted)] truncate">
                      {adminEmail}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Quick action bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded bg-[var(--bg-subtle)] border border-[var(--border-subtle)]">
              <div className="flex items-center gap-2">
                <i className="fa-solid fa-circle-check text-[var(--accent-brand)] text-sm" aria-hidden="true"></i>
                <span className="text-xs text-[var(--text-secondary)]">
                  Establecimiento activo: <strong className="text-[var(--text-primary)]">{businessConfig?.name || 'Local 1'}</strong> ({businessConfig?.domain || 'prueba1.gp.com'})
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const adminUser = (users || []).find(u => u.role === 'admin') || users?.[0];
                  if (adminUser) {
                    switchUser(adminUser);
                  }
                }}
                className="pos-btn-primary text-xs px-3 py-1.5 min-h-[34px] w-full sm:w-auto"
              >
                <i className="fa-solid fa-right-to-bracket text-xs mr-1.5" aria-hidden="true"></i>
                <span>Ingresar como Admin en {businessConfig?.name || 'este local'}</span>
              </button>
            </div>

            {/* PIN Keypad & Staff Selection inside the chosen venue */}
            <div className="pos-panel p-5 grid grid-cols-1 md:grid-cols-12 gap-5">
              {/* Left Column: Staff Cards */}
              <div className="md:col-span-6 space-y-3">
                <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2.5">
                  <div>
                    <h3 className="font-display font-bold text-sm text-[var(--text-primary)]">
                      Personal de {businessConfig?.name || 'Local'}
                    </h3>
                    <p className="text-[11px] text-[var(--text-secondary)]">
                      Hacé clic en tu perfil o ingresá tu PIN de 4 dígitos
                    </p>
                  </div>
                  <span className="pos-badge pos-badge-open text-[11px] font-mono">
                    PIN demo: 1234
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto pr-1">
                  {filteredUsers.map(u => {
                    const isSelected = selectedUser?.id === u.id;
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          setSelectedUser(u);
                          setError('');
                        }}
                        className={`p-3 rounded border text-left transition-all flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'bg-[var(--btn-primary-bg)] text-[var(--btn-primary-fg)] border-[var(--btn-primary-border)] shadow-sm'
                            : 'bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] border-[var(--border-subtle)]'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className={`w-8 h-8 rounded flex items-center justify-center text-xs shrink-0 ${isSelected ? 'bg-white/20' : 'bg-[var(--bg-elevated)] text-[var(--accent-brand)]'}`}>
                            <i className={getRoleIcon(u)} aria-hidden="true"></i>
                          </span>
                          <div className="min-w-0">
                            <span className="font-bold text-sm block truncate">{u.name}</span>
                            <span className="text-xs opacity-80 block truncate">
                              {roleLabels[u.role] || u.role} · PIN: {u.pin}
                            </span>
                          </div>
                        </div>
                        {isSelected && (
                          <i className="fa-solid fa-check text-xs" aria-hidden="true"></i>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Keypad */}
              <div className="md:col-span-6 flex flex-col items-center justify-center space-y-3 p-2 bg-[var(--bg-subtle)] rounded border border-[var(--border-subtle)]">
                <div className="text-center space-y-1">
                  <span className="text-xs font-semibold text-[var(--text-secondary)]">
                    {selectedUser ? `Ingresá el PIN de ${selectedUser.name}` : 'Ingresá tu PIN táctil de 4 dígitos'}
                  </span>
                  <div className="flex justify-center gap-2">
                    {[0, 1, 2, 3].map(i => (
                      <div
                        key={i}
                        className={`w-3.5 h-3.5 rounded-full border transition-all ${
                          pin.length > i
                            ? 'bg-[var(--accent-brand)] border-[var(--accent-brand)] scale-110'
                            : 'bg-[var(--bg-surface)] border-[var(--border-strong)]'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {error && (
                  <span className="text-xs font-semibold text-[var(--status-danger-fg)] text-center px-2">
                    {error}
                  </span>
                )}

                <div className="grid grid-cols-3 gap-2 w-full max-w-[240px]">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handleKeyPress(num)}
                      className="min-h-[48px] rounded bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] font-mono font-bold text-lg text-[var(--text-primary)] shadow-sm active:scale-95 transition-all"
                    >
                      {num}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => { setPin(''); setError(''); }}
                    className="min-h-[48px] rounded bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-secondary)] active:scale-95 transition-all"
                  >
                    Borrar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleKeyPress(0)}
                    className="min-h-[48px] rounded bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] font-mono font-bold text-lg text-[var(--text-primary)] shadow-sm active:scale-95 transition-all"
                  >
                    0
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="min-h-[48px] rounded bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--status-danger-fg)] active:scale-95 transition-all"
                  >
                    <i className="fa-solid fa-delete-left" aria-hidden="true"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3. REGISTRAR NUEVO LOCAL / EMPRESA */}
        {loginMode === 'register' && (
          <div className="pos-panel max-w-2xl mx-auto p-6 sm:p-7 space-y-5 shadow-2xl border-t-4 border-t-emerald-500">
            <div className="space-y-1">
              <h2 className="font-display font-extrabold text-lg text-[var(--text-primary)]">
                Dar de alta un Nuevo Establecimiento Gastronómico
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Validamos los datos de tu empresa y te creamos automáticamente una cuenta corporativa con subdominio propio.
              </p>
            </div>

            <form onSubmit={handleRegisterBusiness} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="reg-name" className="pos-label">Nombre del local o marca:</label>
                  <input
                    id="reg-name"
                    type="text"
                    required
                    placeholder="Ej. La Trattoria Gourmet"
                    value={regName}
                    onChange={(e) => {
                      setRegName(e.target.value);
                      if (!regSlug) {
                        setRegSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''));
                      }
                    }}
                    className="pos-input font-bold"
                  />
                </div>

                <div>
                  <label htmlFor="reg-slug" className="pos-label">Subdominio deseado (sin espacios):</label>
                  <div className="flex items-center">
                    <input
                      id="reg-slug"
                      type="text"
                      required
                      placeholder="latrattoria"
                      value={regSlug}
                      onChange={(e) => setRegSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
                      className="pos-input rounded-r-none font-mono text-right"
                    />
                    <span className="px-3 min-h-[44px] bg-[var(--bg-elevated)] border border-l-0 border-[var(--border-subtle)] rounded-r text-xs text-[var(--text-secondary)] font-mono flex items-center shrink-0">
                      .gp.com
                    </span>
                  </div>
                  <span className="text-[11px] text-[var(--text-muted)] mt-1 block">
                    Tu acceso será: admin@{regSlug || 'local'}.gp.com
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="reg-cuit" className="pos-label">CUIT / DNI Titular:</label>
                  <input
                    id="reg-cuit"
                    type="text"
                    required
                    placeholder="Ej. 30-71889900-4"
                    value={regCuit}
                    onChange={(e) => setRegCuit(e.target.value)}
                    className="pos-input font-mono"
                  />
                </div>

                <div>
                  <label htmlFor="reg-phone" className="pos-label">Teléfono comercial:</label>
                  <input
                    id="reg-phone"
                    type="text"
                    required
                    placeholder="Ej. (0351) 450-8800"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    className="pos-input font-mono"
                  />
                </div>

                <div>
                  <label htmlFor="reg-contact" className="pos-label">Email de contacto titular:</label>
                  <input
                    id="reg-contact"
                    type="email"
                    required
                    placeholder="propietario@email.com"
                    value={regContactEmail}
                    onChange={(e) => setRegContactEmail(e.target.value)}
                    className="pos-input"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="reg-address" className="pos-label">Dirección comercial del establecimiento:</label>
                <input
                  id="reg-address"
                  type="text"
                  required
                  placeholder="Ej. Av. Colón 1500, Alberdi, Córdoba Capital"
                  value={regAddress}
                  onChange={(e) => setRegAddress(e.target.value)}
                  className="pos-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[var(--border-subtle)]">
                <div>
                  <label htmlFor="reg-pass" className="pos-label">Contraseña inicial admin:</label>
                  <input
                    id="reg-pass"
                    type="text"
                    required
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className="pos-input font-mono text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="reg-pin" className="pos-label">PIN táctil para salón (4 dígitos):</label>
                  <input
                    id="reg-pin"
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    value={regPin}
                    onChange={(e) => setRegPin(e.target.value.replace(/\D/g, ''))}
                    className="pos-input font-mono font-bold text-center tracking-widest text-base"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submittingReg}
                className="pos-btn-primary w-full py-2.5 mt-2"
              >
                <i className="fa-solid fa-cloud-arrow-up text-xs" aria-hidden="true"></i>
                <span>{submittingReg ? 'Registrando establecimiento...' : 'Registrar local y activar cuenta'}</span>
              </button>
            </form>
          </div>
        )}
      </main>

      {/* Simulated Verification & Welcome Email Modal */}
      {welcomeModalData && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--backdrop-overlay)] p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="pos-panel w-full max-w-lg p-6 space-y-4 shadow-2xl border-t-4 border-t-emerald-500">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 flex items-center justify-center text-lg">
                <i className="fa-solid fa-check" aria-hidden="true"></i>
              </span>
              <div>
                <h3 className="font-display font-extrabold text-base text-[var(--text-primary)]">
                  ¡Local Registrado con Éxito!
                </h3>
                <p className="text-xs text-[var(--text-secondary)]">
                  Simulación de correo de bienvenida y verificación enviado a {welcomeModalData.verificationSentTo}
                </p>
              </div>
            </div>

            <div className="p-4 rounded bg-[var(--bg-subtle)] border border-[var(--border-subtle)] space-y-3 font-mono text-xs">
              <div className="border-b border-[var(--border-subtle)] pb-2 text-[var(--text-secondary)]">
                <div>De: <strong>soporte@gastropos.com</strong></div>
                <div>Para: <strong>{welcomeModalData.verificationSentTo}</strong></div>
                <div>Asunto: <strong>Bienvenido a GastroPOS · Credenciales de {welcomeModalData.tenant.name}</strong></div>
              </div>

              <div className="space-y-1.5 text-[var(--text-primary)]">
                <p>Hola. Tu establecimiento <strong>{welcomeModalData.tenant.name}</strong> ha sido verificado.</p>
                <p>Te asignamos la siguiente cuenta corporativa para administrar tu local:</p>
                <div className="p-2.5 bg-[var(--bg-elevated)] rounded border border-[var(--border-subtle)] space-y-1">
                  <div>· Usuario corporativo: <strong className="text-emerald-500">{welcomeModalData.adminUser.email}</strong></div>
                  <div>· Contraseña inicial: <strong className="text-[var(--text-primary)]">{welcomeModalData.adminUser.password}</strong></div>
                  <div>· PIN táctil para comandera: <strong className="text-[var(--text-primary)]">{welcomeModalData.adminUser.pin}</strong></div>
                  <div>· Dominio asignado: <strong className="text-[var(--accent-brand)]">@{welcomeModalData.tenant.domain}</strong></div>
                </div>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Podés modificar la carta, empleados y mesas desde tu panel de administrador una vez ingreses.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={handleEnterWithNewBusiness}
                className="pos-btn-primary w-full py-2.5"
              >
                <i className="fa-solid fa-right-to-bracket text-xs" aria-hidden="true"></i>
                <span>Ingresar directamente como Administrador</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="w-full max-w-5xl mx-auto text-center text-xs text-[var(--text-muted)] py-3 border-t border-[var(--border-subtle)] flex flex-col sm:flex-row items-center justify-between gap-2">
        <span>GastroPOS v3.0 · Software Gastronómico Multi-Inquilino</span>
        <span className="font-mono text-[11px]">Sede central: Córdoba Capital · Argentina</span>
      </footer>
    </div>
  );
}
