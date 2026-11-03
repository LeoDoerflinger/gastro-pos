/**
 * Helper unificado para mostrar únicamente el rol del usuario con numeración
 * cuando existen múltiples usuarios en el mismo puesto (ej: Mozo 1, Mozo 2, Cajero, Admin).
 */
export function formatUserRoleDisplay(rawName, role, users = []) {
  const clean = String(rawName || '').trim();

  // Si ya tiene el formato esperado (ej. "Mozo 1", "Mozo 2", "Cajero", "Admin"), retornarlo
  if (/^(Mozo|Cajero|Admin|Cadete)(\s+\d+)?$/i.test(clean)) {
    return clean;
  }

  // Normalización de nombres seed legacy
  if (/rodrigo/i.test(clean)) return 'Admin';
  if (/lucas/i.test(clean)) return 'Mozo 1';
  if (/sof[ií]a/i.test(clean)) return 'Mozo 2';
  if (/cajero/i.test(clean)) return 'Cajero';

  // Si se encuentra en la lista de usuarios
  if (Array.isArray(users) && users.length > 0) {
    const matched = users.find(u => u.name === clean || u.id === clean || (role && u.role === role && u.name === clean));
    if (matched) {
      const sameRole = users.filter(u => u.role === matched.role);
      const roleLabel = matched.role === 'mozo' ? 'Mozo' : matched.role === 'cajero' ? 'Cajero' : matched.role === 'admin' ? 'Admin' : 'Personal';
      if (sameRole.length > 1) {
        const idx = sameRole.findIndex(u => u.id === matched.id);
        return `${roleLabel} ${idx + 1}`;
      }
      return roleLabel;
    }
  }

  // Fallback por rol
  if (role === 'mozo') return 'Mozo 1';
  if (role === 'cajero') return 'Cajero';
  if (role === 'admin') return 'Admin';

  return clean || 'Personal';
}

export function isShiftActive(s) {
  if (!s || !s.status) return false;
  const st = String(s.status).toLowerCase().trim();
  return st === 'abierta' || st === 'abierto';
}
