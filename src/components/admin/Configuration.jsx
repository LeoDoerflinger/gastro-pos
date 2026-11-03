import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import { getTableCode } from '../mozo/MozoSalonView';

export default function Configuration() {
  const {
    tables,
    users: userList,
    currentUser,
    showToast,
    refreshData,
    businessConfig,
    updateBusinessConfig,
    activeTenant
  } = useApp();

  const [configSubtab, setConfigSubtab] = useState('business');
  const [submitting, setSubmitting] = useState(false);

  // Datos del Local
  const [bizName, setBizName] = useState(businessConfig?.name || '');
  const [bizLegal, setBizLegal] = useState(businessConfig?.legalName || '');
  const [bizCuit, setBizCuit] = useState(businessConfig?.cuit || '');
  const [bizPhone, setBizPhone] = useState(businessConfig?.phone || '');
  const [bizEmail, setBizEmail] = useState(businessConfig?.email || '');
  const [bizAddress, setBizAddress] = useState(businessConfig?.address || '');
  const [bizCity, setBizCity] = useState(businessConfig?.city || 'Córdoba Capital');
  const [bizFooter, setBizFooter] = useState(businessConfig?.receiptFooter || '');

  useEffect(() => {
    if (businessConfig) {
      setBizName(businessConfig.name || '');
      setBizLegal(businessConfig.legalName || '');
      setBizCuit(businessConfig.cuit || '');
      setBizPhone(businessConfig.phone || '');
      setBizEmail(businessConfig.email || '');
      setBizAddress(businessConfig.address || '');
      setBizCity(businessConfig.city || 'Córdoba Capital');
      setBizFooter(businessConfig.receiptFooter || '');
    }
  }, [businessConfig]);

  // Mesas
  const [tableNumber, setTableNumber] = useState('');
  const [tableSector, setTableSector] = useState('Salón Principal');
  const [tableCapacity, setTableCapacity] = useState('4');

  // Personal / Usuarios
  const [userRole, setUserRole] = useState('mozo');
  const [userPin, setUserPin] = useState('');
  const [userName, setUserName] = useState('');
  const [userPassword, setUserPassword] = useState('gastro123');
  const [userUsername, setUserUsername] = useState('');

  // Edición de usuario
  const [editingUser, setEditingUser] = useState(null);
  const [editName, setEditName] = useState('');
  const [editPin, setEditPin] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState('mozo');

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setEditingUser(null);
      }
    };
    if (editingUser) {
      window.addEventListener('keydown', onKeyDown);
      return () => window.removeEventListener('keydown', onKeyDown);
    }
  }, [editingUser]);

  const handleSaveBusiness = async (e) => {
    e.preventDefault();
    if (!bizName.trim()) {
      showToast('El nombre del local es obligatorio', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await updateBusinessConfig({
        name: bizName.trim(),
        legalName: bizLegal.trim() || bizName.trim(),
        cuit: bizCuit.trim(),
        phone: bizPhone.trim(),
        email: bizEmail.trim(),
        address: bizAddress.trim(),
        city: bizCity.trim(),
        receiptFooter: bizFooter.trim()
      });
    } catch {
      // Error toast already displayed by context
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEditUser = (u) => {
    setEditingUser(u);
    setEditName(u.name || '');
    setEditPin(u.pin || '');
    setEditPassword(u.password || '');
    setEditEmail(u.email || '');
    setEditRole(u.role || 'mozo');
  };

  const handleSaveEditUser = async (e) => {
    e.preventDefault();
    if (editPin.length !== 4) {
      showToast('Ingresá un PIN numérico de 4 cifras', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await api.updateUser(editingUser.id, {
        name: editName.trim(),
        pin: editPin.trim(),
        password: editPassword.trim() || undefined,
        email: editEmail.trim(),
        role: editRole
      });
      await refreshData();
      showToast(`Datos de ${editName} actualizados`);
      setEditingUser(null);
    } catch (err) {
      showToast(err.message || 'No se pudo actualizar el usuario', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddTable = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.createTable({
        number: Number(tableNumber) || (tables.length + 1),
        sector: tableSector,
        capacity: Number(tableCapacity)
      });
      showToast('Mesa incorporada al plano');
      setTableNumber('');
      await refreshData();
    } catch (err) {
      showToast(err.message || 'No se pudo agregar la mesa', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTable = async (id, num) => {
    if (window.confirm(`¿Querés quitar la Mesa #${num} del plano?`)) {
      try {
        await api.deleteTable(id);
        showToast(`Mesa #${num} eliminada`);
        await refreshData();
      } catch (err) {
        showToast('No se pudo eliminar la mesa', 'error');
      }
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (userPin.length !== 4) {
      showToast('Ingresá un PIN numérico de 4 cifras', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const avatarIcon =
        userRole === 'admin'
          ? 'fa-solid fa-user-shield'
          : userRole === 'cajero'
          ? 'fa-solid fa-cash-register'
          : 'fa-solid fa-user-tie';

      const domain = businessConfig?.domain || activeTenant?.domain || 'local.gp.com';
      const cleanPrefix = userUsername.trim().toLowerCase().replace(/[^a-z0-9.]/g, '') ||
                          (userName.trim().toLowerCase().replace(/[^a-z0-9]/g, '') || userRole);
      const generatedEmail = `${cleanPrefix}@${domain}`;

      const created = await api.createUser({
        role: userRole,
        pin: userPin.trim(),
        password: userPassword.trim() || 'gastro123',
        name: userName.trim() || undefined,
        email: generatedEmail,
        avatar: avatarIcon
      });
      await refreshData();
      showToast(`Usuario ${created.name} (${generatedEmail}) habilitado`);
      setUserPin('');
      setUserName('');
      setUserUsername('');
      setUserPassword('gastro123');
    } catch (err) {
      showToast(err.message || 'No se pudo registrar el usuario', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async (id, name) => {
    if (id === currentUser.id) {
      showToast('No podés dar de baja el usuario con sesión abierta', 'error');
      return;
    }
    if (window.confirm(`¿Dar de baja a ${name}?`)) {
      try {
        await api.deleteUser(id);
        await refreshData();
        showToast(`Usuario ${name} dado de baja`);
      } catch (err) {
        showToast('No se pudo eliminar el usuario', 'error');
      }
    }
  };

  const currentDomain = businessConfig?.domain || activeTenant?.domain || 'local.gp.com';

  return (
    <section className="space-y-5" aria-label="Configuración de negocio, salón y personal">
      {/* Header */}
      <div className="pb-4 border-b border-[var(--border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display font-bold text-lg text-[var(--text-primary)]">
              Configuración del Establecimiento
            </h2>
            <span className="pos-badge pos-badge-brand text-xs font-mono">
              @{currentDomain}
            </span>
          </div>
          <p className="text-sm text-[var(--text-secondary)]">
            Personalizá los datos fiscales de tu negocio, la distribución del salón y el personal con correo corporativo.
          </p>
        </div>

        <div className="pos-segment-group self-start sm:self-auto" role="group" aria-label="Secciones de configuración">
          <button
            type="button"
            aria-pressed={configSubtab === 'business'}
            onClick={() => setConfigSubtab('business')}
            className="pos-segment-btn"
          >
            <i className="fa-solid fa-store text-xs" aria-hidden="true"></i>
            <span>Datos del Local</span>
          </button>

          <button
            type="button"
            aria-pressed={configSubtab === 'tables'}
            onClick={() => setConfigSubtab('tables')}
            className="pos-segment-btn"
          >
            <i className="fa-solid fa-chair text-xs" aria-hidden="true"></i>
            <span>Mesas ({tables.length})</span>
          </button>

          <button
            type="button"
            aria-pressed={configSubtab === 'users'}
            onClick={() => setConfigSubtab('users')}
            className="pos-segment-btn"
          >
            <i className="fa-solid fa-users text-xs" aria-hidden="true"></i>
            <span>Personal ({userList.length})</span>
          </button>
        </div>
      </div>

      {/* 1. Datos del Local */}
      {configSubtab === 'business' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-8 pos-panel p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
              <div>
                <h3 className="font-display font-bold text-base text-[var(--text-primary)]">
                  Personalización del Nombre y Datos del Local
                </h3>
                <p className="text-xs text-[var(--text-secondary)]">
                  Esta información impacta en el encabezado del sistema, comandas, facturas y comprobantes impresos.
                </p>
              </div>
              <span className="pos-badge pos-badge-brand font-mono text-xs">
                Dominio: {currentDomain}
              </span>
            </div>

            <form onSubmit={handleSaveBusiness} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="biz-name" className="pos-label">Nombre comercial del local:</label>
                  <input
                    id="biz-name"
                    type="text"
                    required
                    placeholder="Ej. Qué Pi Bar & Tapas"
                    value={bizName}
                    onChange={(e) => setBizName(e.target.value)}
                    className="pos-input font-bold"
                  />
                  <span className="text-[11px] text-[var(--text-muted)] mt-1 block">
                    Se visualiza en la barra superior y comandera.
                  </span>
                </div>

                <div>
                  <label htmlFor="biz-legal" className="pos-label">Razón social / Titular:</label>
                  <input
                    id="biz-legal"
                    type="text"
                    placeholder="Ej. Qué Pi Bar Gastronomía SRL"
                    value={bizLegal}
                    onChange={(e) => setBizLegal(e.target.value)}
                    className="pos-input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="biz-cuit" className="pos-label">CUIT / DNI:</label>
                  <input
                    id="biz-cuit"
                    type="text"
                    placeholder="Ej. 30-71458921-3"
                    value={bizCuit}
                    onChange={(e) => setBizCuit(e.target.value)}
                    className="pos-input font-mono"
                  />
                </div>

                <div>
                  <label htmlFor="biz-phone" className="pos-label">Teléfono / WhatsApp:</label>
                  <input
                    id="biz-phone"
                    type="text"
                    placeholder="Ej. (0351) 460-2211"
                    value={bizPhone}
                    onChange={(e) => setBizPhone(e.target.value)}
                    className="pos-input font-mono"
                  />
                </div>

                <div>
                  <label htmlFor="biz-email" className="pos-label">Email corporativo central:</label>
                  <input
                    id="biz-email"
                    type="email"
                    placeholder={`admin@${currentDomain}`}
                    value={bizEmail}
                    onChange={(e) => setBizEmail(e.target.value)}
                    className="pos-input font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label htmlFor="biz-address" className="pos-label">Dirección comercial:</label>
                  <input
                    id="biz-address"
                    type="text"
                    placeholder="Ej. Belgrano 740, Barrio Güemes"
                    value={bizAddress}
                    onChange={(e) => setBizAddress(e.target.value)}
                    className="pos-input"
                  />
                </div>

                <div>
                  <label htmlFor="biz-city" className="pos-label">Ciudad / Provincia:</label>
                  <input
                    id="biz-city"
                    type="text"
                    placeholder="Córdoba Capital"
                    value={bizCity}
                    onChange={(e) => setBizCity(e.target.value)}
                    className="pos-input"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="biz-footer" className="pos-label">Leyenda / Pie de Comprobante:</label>
                <input
                  id="biz-footer"
                  type="text"
                  placeholder="Ej. ¡Gracias por visitarnos en Barrio Güemes!"
                  value={bizFooter}
                  onChange={(e) => setBizFooter(e.target.value)}
                  className="pos-input"
                />
                <span className="text-[11px] text-[var(--text-muted)] mt-1 block">
                  Aparece al final de los tickets térmicos y precuentas de mesa.
                </span>
              </div>

              <div className="pt-2 border-t border-[var(--border-subtle)] flex justify-end">
                <button
                  type="submit"
                  disabled={submitting}
                  className="pos-btn-primary px-6"
                >
                  <i className="fa-solid fa-floppy-disk text-xs" aria-hidden="true"></i>
                  <span>{submitting ? 'Guardando...' : 'Guardar datos del local'}</span>
                </button>
              </div>
            </form>
          </div>

          <div className="lg:col-span-4 pos-panel p-5 space-y-4 bg-[var(--bg-subtle)]">
            <h4 className="font-display font-bold text-sm text-[var(--text-primary)] pb-2 border-b border-[var(--border-subtle)]">
              Vista previa del Ticket Fiscal
            </h4>

            <div className="p-4 bg-[#faf8f2] text-[#18191b] rounded border border-[#cfc9be] font-mono text-xs shadow-sm space-y-2 select-none">
              <div className="text-center pb-2 border-b border-dashed border-[#8c867a]">
                <div className="font-bold text-sm">{bizName || 'NOMBRE DEL LOCAL'}</div>
                <div className="text-[11px] text-[#43464c]">{bizAddress || 'Dirección Comercial'}</div>
                <div className="text-[11px] text-[#43464c]">{bizCity || 'Córdoba Capital'} · Tel: {bizPhone || '351...'}</div>
                <div className="text-[11px] text-[#43464c]">CUIT {bizCuit || '30-XXXXXXXX-X'} · IVA Resp. Inscripto</div>
              </div>
              <div className="py-2 text-[11px] space-y-1">
                <div className="flex justify-between font-bold">
                  <span>TICKET #0001-0105</span>
                  <span>MESA S2</span>
                </div>
                <div className="flex justify-between text-[#43464c]">
                  <span>1x Lomito Completo</span>
                  <span>$15.800</span>
                </div>
              </div>
              <div className="text-center pt-2 border-t border-dashed border-[#8c867a] text-[11px] italic text-[#43464c]">
                {bizFooter || '¡Gracias por visitarnos!'}
              </div>
            </div>

            <div className="text-xs text-[var(--text-secondary)] space-y-1 pt-2">
              <strong className="text-[var(--text-primary)] block">Gestión Multi-Inquilino:</strong>
              <p>Cada local cuenta con su propia base de datos aislada, cartas, empleados, comanderas y arqueos de caja independientes.</p>
            </div>
          </div>
        </div>
      )}

      {/* 2. Tables Management */}
      {configSubtab === 'tables' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-5 pos-panel p-5">
            <h3 className="font-display font-bold text-base text-[var(--text-primary)] pb-3 mb-4 border-b border-[var(--border-subtle)]">
              Agregar mesa al plano
            </h3>

            <form onSubmit={handleAddTable} className="space-y-3.5">
              <div>
                <label htmlFor="cfg-table-num" className="pos-label">Número de mesa:</label>
                <input
                  id="cfg-table-num"
                  type="number"
                  placeholder="Ej. 12"
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                  className="pos-input font-mono"
                />
              </div>

              <div>
                <label htmlFor="cfg-table-sector" className="pos-label">Sector (define la inicial del código):</label>
                <select
                  id="cfg-table-sector"
                  value={tableSector}
                  onChange={(e) => setTableSector(e.target.value)}
                  className="pos-input"
                >
                  <option value="Salón Principal">Salón Principal (S)</option>
                  <option value="Galería">Galería (G)</option>
                  <option value="Terraza">Terraza (T)</option>
                  <option value="Vereda">Vereda (V)</option>
                  <option value="Barra">Barra (B)</option>
                </select>
              </div>

              <div>
                <label htmlFor="cfg-table-cap" className="pos-label">Capacidad de cubiertos:</label>
                <input
                  id="cfg-table-cap"
                  type="number"
                  min="1"
                  max="20"
                  value={tableCapacity}
                  onChange={(e) => setTableCapacity(e.target.value)}
                  className="pos-input font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="pos-btn-primary w-full mt-2"
              >
                <i className="fa-solid fa-plus text-xs" aria-hidden="true"></i>
                <span>Sumar mesa</span>
              </button>
            </form>
          </div>

          <div className="lg:col-span-7 pos-panel overflow-hidden flex flex-col">
            <div className="px-4 py-3 bg-[var(--bg-subtle)] border-b border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-secondary)]">
              Mesas activas en el plano ({tables.length})
            </div>

            <div className="divide-y divide-[var(--border-subtle)] max-h-[520px] overflow-y-auto">
              {tables.map(table => (
                <div key={table.id} className="px-4 py-3 hover:bg-[var(--bg-hover)] flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="w-10 h-10 rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] font-mono font-bold text-sm flex items-center justify-center">
                      {getTableCode(table)}
                    </span>
                    <div>
                      <div className="font-semibold text-sm text-[var(--text-primary)]">
                        {table.sector} · Mesa {table.number}
                      </div>
                      <div className="text-xs text-[var(--text-muted)] font-mono">
                        Hasta {table.capacity} cubiertos
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`pos-badge ${table.status === 'libre' ? 'pos-badge-neutral' : 'pos-badge-open'} capitalize`}>
                      {table.status === 'libre' ? 'Cerrada' : table.status.replace('_', ' ')}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteTable(table.id, table.number)}
                      className="pos-btn-ghost text-[var(--text-muted)] hover:text-[var(--status-danger-fg)]"
                      aria-label={`Eliminar mesa ${table.number}`}
                    >
                      <i className="fa-solid fa-trash-can text-sm" aria-hidden="true"></i>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 3. Staff & Corporate Users Management */}
      {configSubtab === 'users' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-5 pos-panel p-5 space-y-4">
            <div className="pb-3 border-b border-[var(--border-subtle)]">
              <h3 className="font-display font-bold text-base text-[var(--text-primary)]">
                Crear empleado / usuario
              </h3>
              <p className="text-xs text-[var(--text-secondary)]">
                Exclusivo panel administrador: creá los empleados con rol, PIN y contraseña.
              </p>
            </div>

            <form onSubmit={handleAddUser} className="space-y-3.5">
              <div>
                <label htmlFor="cfg-user-role" className="pos-label">Puesto / Rol asignado:</label>
                <select
                  id="cfg-user-role"
                  value={userRole}
                  onChange={(e) => setUserRole(e.target.value)}
                  className="pos-input"
                >
                  <option value="mozo">Mozo de salón</option>
                  <option value="cajero">Cajero</option>
                  <option value="admin">Encargado / Administrador</option>
                </select>
              </div>

              <div>
                <label htmlFor="cfg-user-name" className="pos-label">Nombre y apellido del empleado:</label>
                <input
                  id="cfg-user-name"
                  type="text"
                  required
                  placeholder="Ej. Lucas Álvarez"
                  value={userName}
                  onChange={(e) => {
                    setUserName(e.target.value);
                    if (!userUsername) {
                      setUserUsername(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''));
                    }
                  }}
                  className="pos-input"
                />
              </div>

              <div>
                <label htmlFor="cfg-user-username" className="pos-label">Casilla corporativa del local:</label>
                <div className="flex items-center">
                  <input
                    id="cfg-user-username"
                    type="text"
                    placeholder="lucas"
                    value={userUsername}
                    onChange={(e) => setUserUsername(e.target.value)}
                    className="pos-input rounded-r-none font-mono text-right"
                  />
                  <span className="px-3 min-h-[44px] bg-[var(--bg-elevated)] border border-l-0 border-[var(--border-subtle)] rounded-r text-xs text-[var(--text-secondary)] font-mono flex items-center shrink-0">
                    @{currentDomain}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="cfg-user-pass" className="pos-label">Contraseña de acceso:</label>
                  <input
                    id="cfg-user-pass"
                    type="text"
                    required
                    placeholder="gastro123"
                    value={userPassword}
                    onChange={(e) => setUserPassword(e.target.value)}
                    className="pos-input font-mono text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="cfg-user-pin" className="pos-label">PIN táctil (4 dígitos):</label>
                  <input
                    id="cfg-user-pin"
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="Ej. 1234"
                    value={userPin}
                    onChange={(e) => setUserPin(e.target.value.replace(/\D/g, ''))}
                    className="pos-input font-mono font-bold text-center tracking-widest text-base"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="pos-btn-primary w-full mt-2"
              >
                <i className="fa-solid fa-user-plus text-xs" aria-hidden="true"></i>
                <span>Crear usuario en {currentDomain}</span>
              </button>
            </form>
          </div>

          <div className="lg:col-span-7 pos-panel overflow-hidden flex flex-col">
            <div className="px-4 py-3 bg-[var(--bg-subtle)] border-b border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-secondary)] flex justify-between items-center">
              <span>Personal activo de {businessConfig?.name || 'Local'} ({userList.length})</span>
              <span className="font-mono text-[11px] text-[var(--accent-brand)]">Dominio: @{currentDomain}</span>
            </div>

            <div className="divide-y divide-[var(--border-subtle)] max-h-[520px] overflow-y-auto">
              {userList.map(u => {
                const isFaIcon = typeof u.avatar === 'string' && u.avatar.includes('fa-');
                return (
                  <div key={u.id} className="px-4 py-3.5 hover:bg-[var(--bg-hover)] flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--accent-brand)] shrink-0">
                        <i className={isFaIcon ? u.avatar : 'fa-solid fa-user'} aria-hidden="true"></i>
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-sm text-[var(--text-primary)] truncate">{u.name}</div>
                        <div className="text-xs text-[var(--text-secondary)] font-mono truncate">
                          <span className="capitalize font-semibold">{u.role}</span> · PIN <strong className="text-[var(--text-primary)]">{u.pin}</strong>
                        </div>
                        <div className="text-[11px] text-[var(--text-muted)] font-mono truncate">
                          {u.email || `${u.name.toLowerCase()}@${currentDomain}`}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {u.id === currentUser.id && (
                        <span className="pos-badge pos-badge-open mr-1">En uso</span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleOpenEditUser(u)}
                        className="pos-btn-ghost text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                        aria-label={`Editar datos de ${u.name}`}
                        title="Modificar nombre, PIN o correo"
                      >
                        <i className="fa-solid fa-pen-to-square text-sm" aria-hidden="true"></i>
                      </button>
                      {u.id !== currentUser.id && (
                        <button
                          type="button"
                          onClick={() => handleDeleteUser(u.id, u.name)}
                          className="pos-btn-ghost text-[var(--text-muted)] hover:text-[var(--status-danger-fg)]"
                          aria-label={`Dar de baja a ${u.name}`}
                        >
                          <i className="fa-solid fa-trash-can text-sm" aria-hidden="true"></i>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modal para editar datos del usuario */}
      {editingUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--backdrop-overlay)] p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-user-modal-title"
        >
          <div className="pos-panel w-full max-w-md p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <div className="flex items-center gap-2.5">
                <i className="fa-solid fa-user-pen text-[var(--accent-brand)]" aria-hidden="true"></i>
                <h3 id="edit-user-modal-title" className="font-display font-bold text-base text-[var(--text-primary)]">
                  Modificar datos de {editingUser.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="pos-btn-ghost -mr-1"
                aria-label="Cerrar ventana de edición"
              >
                <i className="fa-solid fa-xmark text-sm" aria-hidden="true"></i>
              </button>
            </div>

            <form onSubmit={handleSaveEditUser} className="space-y-3.5">
              <div>
                <label htmlFor="edit-user-name" className="pos-label">Nombre y apellido:</label>
                <input
                  id="edit-user-name"
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="pos-input"
                />
              </div>

              <div>
                <label htmlFor="edit-user-role" className="pos-label">Rol en el local:</label>
                <select
                  id="edit-user-role"
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="pos-input"
                >
                  <option value="mozo">Mozo de salón</option>
                  <option value="cajero">Cajero</option>
                  <option value="admin">Encargado / Administrador</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="edit-user-pin" className="pos-label">Clave PIN (4 dígitos):</label>
                  <input
                    id="edit-user-pin"
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    value={editPin}
                    onChange={(e) => setEditPin(e.target.value.replace(/\D/g, ''))}
                    className="pos-input font-mono font-bold text-center tracking-widest text-base"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="edit-user-pass" className="pos-label">Nueva contraseña:</label>
                  <input
                    id="edit-user-pass"
                    type="text"
                    placeholder="Sin cambiar"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    className="pos-input font-mono text-sm"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="edit-user-email" className="pos-label">Correo corporativo:</label>
                <input
                  id="edit-user-email"
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="pos-input font-mono text-xs"
                />
              </div>

              <div className="flex gap-2.5 pt-2 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="pos-btn-secondary flex-1"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="pos-btn-primary flex-1"
                >
                  {submitting ? 'Guardando...' : 'Aplicar cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
