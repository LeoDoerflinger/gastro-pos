import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import { getTableCode } from '../mozo/MozoSalonView';

export default function Configuration() {
  const { tables, users: userList, currentUser, showToast, refreshData } = useApp();

  const [configSubtab, setConfigSubtab] = useState('tables');
  const [submitting, setSubmitting] = useState(false);

  const [tableNumber, setTableNumber] = useState('');
  const [tableSector, setTableSector] = useState('Salón Principal');
  const [tableCapacity, setTableCapacity] = useState('4');

  const [userRole, setUserRole] = useState('mozo');
  const [userPin, setUserPin] = useState('');

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

      const created = await api.createUser({
        role: userRole,
        pin: userPin.trim(),
        avatar: avatarIcon
      });
      await refreshData();
      showToast(`Usuario ${created.name} (PIN ${created.pin}) habilitado`);
      setUserPin('');
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

  return (
    <section className="space-y-5" aria-label="Configuración de salón y usuarios">
      {/* Open Header */}
      <div className="pb-4 border-b border-[var(--border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display font-bold text-lg text-[var(--text-primary)]">
            Configuración de salón y personal
          </h2>
          <p className="text-sm text-[var(--text-secondary)]">
            Administrá la numeración por sectores y las claves PIN de acceso de cada usuario.
          </p>
        </div>

        <div className="pos-segment-group self-start sm:self-auto" role="group" aria-label="Secciones de configuración">
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

      {/* Tables Management */}
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
              Mesas activas en el plano
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

      {/* Staff & Roles Management */}
      {configSubtab === 'users' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-5 pos-panel p-5 space-y-4">
            <h3 className="font-display font-bold text-base text-[var(--text-primary)] pb-3 border-b border-[var(--border-subtle)]">
              Registrar usuario
            </h3>

            <form onSubmit={handleAddUser} className="space-y-3.5">
              <div>
                <label htmlFor="cfg-user-role" className="pos-label">Puesto / Rol asignado:</label>
                <select
                  id="cfg-user-role"
                  value={userRole}
                  onChange={(e) => setUserRole(e.target.value)}
                  className="pos-input"
                >
                  <option value="mozo">Mozo (Numeración automática: Mozo 1, Mozo 2...)</option>
                  <option value="cajero">Cajero (Numeración automática: Cajero 1, Cajero 2...)</option>
                  <option value="admin">Admin (Numeración automática: Admin 1, Admin 2...)</option>
                </select>
              </div>

              <div>
                <label htmlFor="cfg-user-pin" className="pos-label">Clave PIN (4 dígitos):</label>
                <input
                  id="cfg-user-pin"
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="Ej. 5566"
                  value={userPin}
                  onChange={(e) => setUserPin(e.target.value.replace(/\D/g, ''))}
                  className="pos-input font-mono font-bold text-center tracking-widest text-base"
                  required
                />
              </div>

              <div className="pos-subpanel p-3 text-xs text-[var(--text-secondary)] space-y-1">
                <strong className="text-[var(--text-primary)] block">Identificación por rol:</strong>
                <p>· El sistema asigna automáticamente el nombre por puesto y agrega número correlativo si hay más de un usuario en ese rol.</p>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="pos-btn-primary w-full"
              >
                <i className="fa-solid fa-user-plus text-xs" aria-hidden="true"></i>
                <span>Habilitar usuario</span>
              </button>
            </form>
          </div>

          <div className="lg:col-span-7 pos-panel overflow-hidden flex flex-col">
            <div className="px-4 py-3 bg-[var(--bg-subtle)] border-b border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-secondary)]">
              Plantel habilitado
            </div>

            <div className="divide-y divide-[var(--border-subtle)] max-h-[520px] overflow-y-auto">
              {userList.map(u => {
                const isFaIcon = typeof u.avatar === 'string' && u.avatar.includes('fa-');
                return (
                  <div key={u.id} className="px-4 py-3.5 hover:bg-[var(--bg-hover)] flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--accent-brand)]">
                        <i className={isFaIcon ? u.avatar : 'fa-solid fa-user'} aria-hidden="true"></i>
                      </div>
                      <div>
                        <div className="font-bold text-sm text-[var(--text-primary)]">{u.name}</div>
                        <div className="text-xs text-[var(--text-secondary)] font-mono capitalize">
                          {u.role} · PIN <strong className="text-[var(--text-primary)]">{u.pin}</strong>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {u.id === currentUser.id ? (
                        <span className="pos-badge pos-badge-open">En uso</span>
                      ) : (
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
    </section>
  );
}
