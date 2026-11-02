import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';

export default function PinModal() {
  const { isPinModalOpen, setIsPinModalOpen, switchUser, currentUser } = useApp();
  const [pin, setPin] = useState('');
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isPinModalOpen) {
      setPin('');
      setError('');
      api.getUsers().then(setUsers).catch(console.error);
    }
  }, [isPinModalOpen]);

  if (!isPinModalOpen) return null;

  const handleKeyPress = (num) => {
    if (pin.length < 4) {
      const nextPin = pin + num;
      setPin(nextPin);
      setError('');
      if (nextPin.length === 4) {
        verifyPin(nextPin);
      }
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
    setError('');
  };

  const verifyPin = async (inputPin) => {
    try {
      const res = await api.loginWithPin(inputPin);
      if (res.user) {
        switchUser(res.user);
        setIsPinModalOpen(false);
      }
    } catch (err) {
      setError('PIN no válido');
      setPin('');
    }
  };

  const handleDirectSelect = (user) => {
    switchUser(user);
    setIsPinModalOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-3 animate-in fade-in duration-150">
      <div className="bg-[#121215] border border-[#27272a] rounded w-full max-w-sm overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-3 border-b border-[#27272a] flex items-center justify-between bg-[#0e0e11]">
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-key text-zinc-400 text-xs" aria-hidden="true"></i>
            <h3 className="font-bold text-zinc-100 text-xs uppercase tracking-wider font-mono">Cambio de Usuario</h3>
          </div>
          <button 
            onClick={() => setIsPinModalOpen(false)}
            aria-label="Cerrar modal de PIN"
            className="w-6 h-6 rounded text-zinc-400 hover:text-zinc-100 flex items-center justify-center"
          >
            <i className="fa-solid fa-xmark text-sm" aria-hidden="true"></i>
          </button>
        </div>

        {/* Quick staff select list */}
        <div className="p-3 bg-[#15151a] border-b border-[#27272a]">
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2 font-mono">Personal Registrado:</p>
          <div className="grid grid-cols-2 gap-1.5">
            {users.map(u => {
              const uIcon = u.avatar?.startsWith('fa-') ? u.avatar : (u.role === 'admin' ? 'fa-solid fa-user-shield' : u.role === 'cajero' ? 'fa-solid fa-cash-register' : 'fa-solid fa-user-tie');
              return (
                <button
                  key={u.id}
                  onClick={() => handleDirectSelect(u)}
                  className={`flex items-center gap-2 p-2 rounded border text-left transition-colors ${
                    currentUser.id === u.id 
                      ? 'bg-zinc-800 border-zinc-600 text-zinc-100 font-bold border-l-[3px] border-l-zinc-200' 
                      : 'bg-[#18181c] border-[#27272a] hover:border-zinc-700 text-zinc-300'
                  }`}
                >
                  <span className="w-5 h-5 flex items-center justify-center bg-zinc-900 text-zinc-400 rounded-sm border border-zinc-700 text-[11px] shrink-0">
                    <i className={uIcon} aria-hidden="true"></i>
                  </span>
                  <div className="overflow-hidden">
                    <div className="text-xs font-bold truncate leading-tight">{u.name.split(' ')[0]}</div>
                    <div className="text-[10px] text-zinc-500 uppercase font-mono">{u.role} : {u.pin}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* PIN input dots */}
        <div className="p-4 flex flex-col items-center justify-center bg-[#101014]">
          <p className="text-xs text-zinc-400 mb-2.5 font-mono">Ingresar PIN de 4 dígitos:</p>
          
          <div className="flex items-center gap-2.5 mb-2">
            {[0, 1, 2, 3].map(idx => (
              <div 
                key={idx}
                className={`w-3 h-3 rounded-full border transition-all ${
                  pin.length > idx 
                    ? 'bg-zinc-200 border-white' 
                    : 'border-zinc-700 bg-zinc-900'
                }`}
              />
            ))}
          </div>

          {error && (
            <p className="text-xs text-rose-400 font-mono flex items-center gap-1 mt-1">
              <i className="fa-solid fa-triangle-exclamation text-xs" aria-hidden="true"></i>
              <span>{error}</span>
            </p>
          )}

          {/* NumPad */}
          <div className="grid grid-cols-3 gap-1.5 w-full mt-2.5 max-w-[220px]">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
              <button
                key={num}
                type="button"
                onClick={() => handleKeyPress(num)}
                className="h-10 rounded bg-[#18181c] hover:bg-zinc-800 active:scale-95 text-zinc-100 font-mono font-bold text-base border border-[#27272a] transition-colors flex items-center justify-center"
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPin('')}
              className="h-10 rounded bg-[#141418] hover:bg-zinc-800 active:scale-95 text-zinc-400 text-xs font-semibold border border-[#27272a] transition-colors flex items-center justify-center"
            >
              C
            </button>
            <button
              type="button"
              onClick={() => handleKeyPress(0)}
              className="h-10 rounded bg-[#18181c] hover:bg-zinc-800 active:scale-95 text-zinc-100 font-mono font-bold text-base border border-[#27272a] transition-colors flex items-center justify-center"
            >
              0
            </button>
            <button
              type="button"
              onClick={handleDelete}
              aria-label="Borrar dígito"
              className="h-10 rounded bg-[#141418] hover:bg-zinc-800 active:scale-95 text-zinc-300 border border-[#27272a] transition-colors flex items-center justify-center"
            >
              <i className="fa-solid fa-delete-left text-sm" aria-hidden="true"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}