import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';

export default function Configuration() {
  const { tables, currentUser, showToast, refreshData } = useApp();

  const [configSubtab, setConfigSubtab] = useState('tables'); // 'tables' | 'users'
  const [userList, setUserList] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // New Table Form
  const [tableNumber, setTableNumber] = useState('');
  const [tableSector, setTableSector] = useState('Salón Principal');
  const [tableCapacity, setTableCapacity] = useState('4');

  // New User Form
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState('mozo'); // 'mozo' | 'cajero' | 'admin'
  const [userPin, setUserPin] = useState('');

  React.useEffect(() => {
    api.getUsers().then(setUserList).catch(console.error);
  }, []);

  const handleAddTable = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.createTable({
        number: Number(tableNumber) || (tables.length + 1),
        sector: tableSector,
        capacity: Number(tableCapacity)
      });
      showToast('Mesa agregada al plano');
      setTableNumber('');
      await refreshData();
    } catch (err) {
      showToast(err.message || 'Error agregando mesa', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTable = async (id, num) => {
    if (window.confirm(`¿Deseas eliminar la Mesa #${num}?`)) {
      try {
        await api.deleteTable(id);
        showToast(`Mesa #${num} eliminada`);
        await refreshData();
      } catch (err) {
        showToast('Error eliminando mesa', 'error');
      }
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!userName.trim() || userPin.length !== 4) {
      showToast('Ingresa el nombre y un PIN de 4 dígitos exactos', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const avatarIcon = userRole === 'admin'
        ? 'fa-solid fa-user-shield'
        : userRole === 'cajero'
        ? 'fa-solid fa-cash-register'
        : 'fa-solid fa-user-tie';

      const created = await api.createUser({
        name: userName,
        role: userRole,
        pin: userPin,
        avatar: avatarIcon
      });
      showToast(`Usuario ${created.name} (${created.role}) creado`);
      setUserName('');
      setUserPin('');
      const updated = await api.getUsers();
      setUserList(updated);
    } catch (err) {
      showToast(err.message || 'Error creando usuario', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async (id, name) => {
    if (id === currentUser.id) {
      showToast('No puedes eliminar el usuario activo', 'error');
      return;
    }
    if (window.confirm(`¿Eliminar al usuario ${name}?`)) {
      try {
        await api.deleteUser(id);
        showToast(`Usuario ${name} eliminado`);
        const updated = await api.getUsers();
        setUserList(updated);
      } catch (err) {
        showToast('Error eliminando usuario', 'error');
      }
    }
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="bg-[#121215] p-3 rounded border border-[#27272a] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-100 flex items-center gap-2">
            <i className="fa-solid fa-sliders text-zinc-400 text-xs" aria-hidden="true"></i>
            <span>Configuración del Sistema</span>
          </h2>
          <p className="text-[11px] text-zinc-400 mt-1 font-mono">
            Administración de sectores, distribución de mesas y personal con roles y claves PIN de acceso.
          </p>
        </div>

        <div className="inline-flex border border-[#27272a] divide-x divide-[#27272a] rounded-sm overflow-hidden self-start sm:self-auto">
          <button
            onClick={() => setConfigSubtab('tables')}
            className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider transition-colors flex items-center gap-1.5 ${
              configSubtab === 'tables'
                ? 'bg-zinc-800 text-zinc-100 font-bold'
                : 'bg-[#09090b] text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <i className="fa-solid fa-table-cells text-xs" aria-hidden="true"></i>
            <span>Mesas y Sectores ({tables.length})</span>
          </button>

          <button
            onClick={() => setConfigSubtab('users')}
            className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider transition-colors flex items-center gap-1.5 ${
              configSubtab === 'users'
                ? 'bg-zinc-800 text-zinc-100 font-bold'
                : 'bg-[#09090b] text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <i className="fa-solid fa-users text-xs" aria-hidden="true"></i>
            <span>Personal & Roles ({userList.length})</span>
          </button>
        </div>
      </div>

      {/* Tables Subtab */}
      {configSubtab === 'tables' && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Add Table Form */}
          <div className="md:col-span-5 bg-[#121215] p-3.5 rounded border border-[#27272a]">
            <h3 className="font-mono font-bold text-xs uppercase tracking-wider text-zinc-100 mb-3 flex items-center gap-2 border-b border-[#27272a] pb-2">
              <i className="fa-solid fa-plus text-zinc-400 text-xs" aria-hidden="true"></i>
              <span>Nueva Mesa</span>
            </h3>

            <form onSubmit={handleAddTable} className="space-y-2.5">
              <div>
                <label className="text-[10px] uppercase font-mono font-semibold text-zinc-400 block mb-1">Número de Mesa:</label>
                <input
                  type="number"
                  placeholder="Ej: 11"
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                  className="w-full bg-[#09090b] border border-[#27272a] rounded-sm p-1.5 text-xs font-mono text-zinc-100 focus:outline-none focus:border-zinc-500 tabular-nums"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-mono font-semibold text-zinc-400 block mb-1">Sector:</label>
                <select
                  value={tableSector}
                  onChange={(e) => setTableSector(e.target.value)}
                  className="w-full bg-[#09090b] border border-[#27272a] rounded-sm p-1.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-500"
                >
                  <option value="Salón Principal">Salón Principal</option>
                  <option value="Terraza">Terraza</option>
                  <option value="Vereda">Vereda</option>
                  <option value="Barra">Barra</option>
                  <option value="Planta Alta">Planta Alta</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase font-mono font-semibold text-zinc-400 block mb-1">Capacidad Máxima (comensales):</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={tableCapacity}
                  onChange={(e) => setTableCapacity(e.target.value)}
                  className="w-full bg-[#09090b] border border-[#27272a] rounded-sm p-1.5 text-xs font-mono text-zinc-100 tabular-nums focus:outline-none focus:border-zinc-500"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2 rounded-sm bg-zinc-100 hover:bg-white text-zinc-950 font-mono font-bold text-xs transition-all mt-1"
              >
                Crear Mesa
              </button>
            </form>
          </div>

          {/* Tables List */}
          <div className="md:col-span-7 bg-[#121215] rounded border border-[#27272a] overflow-hidden flex flex-col">
            <div className="p-2.5 bg-[#09090b] border-b border-[#27272a] font-mono font-bold text-[10px] text-zinc-400 uppercase tracking-wider">
              Mesas Disponibles en el Plano
            </div>

            <div className="divide-y divide-[#27272a] max-h-[500px] overflow-y-auto">
              {tables.map(table => (
                <div key={table.id} className="p-2.5 hover:bg-[#18181c] flex items-center justify-between text-xs transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-xs bg-[#09090b] border border-[#27272a] text-zinc-200 font-mono font-bold flex items-center justify-center tabular-nums">
                      #{table.number}
                    </span>
                    <div>
                      <div className="font-semibold text-zinc-200">{table.sector}</div>
                      <div className="text-[10px] text-zinc-500 font-mono tabular-nums">Capacidad: {table.capacity} comensales</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 font-mono">
                    <span className={`px-2 py-0.5 rounded-xs text-[10px] font-bold uppercase border ${
                      table.status === 'libre' ? 'bg-[#09090b] text-emerald-400 border-emerald-500/30' : 'bg-[#09090b] text-amber-400 border-amber-500/30'
                    }`}>
                      {table.status}
                    </span>
                    <button
                      onClick={() => handleDeleteTable(table.id, table.number)}
                      className="p-1 text-zinc-500 hover:text-rose-400 transition-colors"
                      aria-label={`Eliminar mesa ${table.number}`}
                    >
                      <i className="fa-solid fa-trash-can text-xs" aria-hidden="true"></i>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Users Subtab */}
      {configSubtab === 'users' && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* New User Form */}
          <div className="md:col-span-5 bg-[#121215] p-3.5 rounded border border-[#27272a] space-y-3">
            <h3 className="font-mono font-bold text-xs uppercase tracking-wider text-zinc-100 mb-2 flex items-center gap-2 border-b border-[#27272a] pb-2">
              <i className="fa-solid fa-key text-zinc-400 text-xs" aria-hidden="true"></i>
              <span>Nuevo Usuario / Personal</span>
            </h3>

            <form onSubmit={handleAddUser} className="space-y-2.5">
              <div>
                <label className="text-[10px] uppercase font-mono font-semibold text-zinc-400 block mb-1">Nombre Completo:</label>
                <input
                  type="text"
                  placeholder="Ej: Nicolás Gómez"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="w-full bg-[#09090b] border border-[#27272a] rounded-sm p-1.5 text-xs text-zinc-100 focus:outline-none focus:border-zinc-500"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-mono font-semibold text-zinc-400 block mb-1">Rol de Acceso:</label>
                <select
                  value={userRole}
                  onChange={(e) => setUserRole(e.target.value)}
                  className="w-full bg-[#09090b] border border-[#27272a] rounded-sm p-1.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-500 font-mono"
                >
                  <option value="mozo">Mozo (Salón y Pre-cuenta)</option>
                  <option value="cajero">Cajero (Caja, Arqueos, Cobros, Stock y Facturas)</option>
                  <option value="admin">Encargado / Admin (Acceso Total)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase font-mono font-semibold text-zinc-400 block mb-1">PIN Numérico (4 Dígitos):</label>
                <input
                  type="text"
                  maxLength={4}
                  placeholder="Ej: 5566"
                  value={userPin}
                  onChange={(e) => setUserPin(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-[#09090b] border border-[#27272a] rounded-sm p-1.5 text-sm font-mono font-bold text-zinc-100 text-center tracking-widest focus:outline-none focus:border-zinc-500 tabular-nums"
                  required
                />
              </div>

              <div className="p-2.5 bg-[#09090b] border border-[#27272a] rounded-sm text-[11px] text-zinc-400 space-y-1 font-mono">
                <span className="font-bold text-zinc-200 block uppercase tracking-wider text-[10px]">Permisos por Rol:</span>
                <p>· <strong>Mozo:</strong> Carga de pedidos de salón y pre-cuenta.</p>
                <p>· <strong>Cajero:</strong> Cobro, arqueo de caja, stock y facturas de compras.</p>
                <p>· <strong>Admin:</strong> Métricas, configuración, recetario y control global.</p>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2 rounded-sm bg-zinc-100 hover:bg-white text-zinc-950 font-mono font-bold text-xs transition-all mt-1"
              >
                Guardar Usuario
              </button>
            </form>
          </div>

          {/* Users List */}
          <div className="md:col-span-7 bg-[#121215] rounded border border-[#27272a] overflow-hidden flex flex-col">
            <div className="p-2.5 bg-[#09090b] border-b border-[#27272a] font-mono font-bold text-[10px] text-zinc-400 uppercase tracking-wider">
              Personal Registrado
            </div>

            <div className="divide-y divide-[#27272a] max-h-[500px] overflow-y-auto">
              {userList.map(u => {
                const isFaIcon = typeof u.avatar === 'string' && u.avatar.includes('fa-');
                return (
                  <div key={u.id} className="p-3 hover:bg-[#18181c] flex items-center justify-between text-xs transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xs bg-[#09090b] border border-[#27272a] flex items-center justify-center text-zinc-300">
                        {isFaIcon ? (
                          <i className={`${u.avatar} text-xs`} aria-hidden="true"></i>
                        ) : (
                          <i className="fa-solid fa-user text-xs" aria-hidden="true"></i>
                        )}
                      </div>
                      <div>
                        <div className="font-semibold text-zinc-200">{u.name}</div>
                        <div className="text-[10px] text-zinc-500 font-mono uppercase">
                          Rol: {u.role} · PIN: <span className="text-zinc-300 font-bold tabular-nums">{u.pin}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {u.id === currentUser.id && (
                        <span className="text-[10px] font-mono bg-[#18181c] text-emerald-400 px-2 py-0.5 rounded-xs border border-emerald-500/30">
                          Sesión Actual
                        </span>
                      )}
                      {u.id !== currentUser.id && (
                        <button
                          onClick={() => handleDeleteUser(u.id, u.name)}
                          className="p-1 text-zinc-500 hover:text-rose-400 transition-colors"
                          aria-label={`Eliminar usuario ${u.name}`}
                        >
                          <i className="fa-solid fa-trash-can text-xs" aria-hidden="true"></i>
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
    </div>
  );
}
