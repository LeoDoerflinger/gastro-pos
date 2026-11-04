import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import ReceiptModal from './ReceiptModal';
import { buildWhatsAppLink, getDefaultDeliveryMessage } from '../../utils/phoneHelper';

let lastSoundTime = 0;

function playArrivalSound() {
  const nowMs = Date.now();
  if (nowMs - lastSoundTime < 800) {
    return; // Evita acople de audio y repeticion por rafagas
  }
  lastSoundTime = nowMs;

  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    // Sonido suave y discreto solo al llegar comanda o cuenta
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, now);
    osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.12);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.12, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc.start(now);
    osc.stop(now + 0.36);

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 500);
  } catch {
    // Restriccion de audio del navegador
  }
}

export default function NotificationCenter() {
  const {
    notifications,
    unreadNotificationsCount,
    markNotificationRead,
    markAllNotificationsRead,
    isNotificationsOpen,
    setIsNotificationsOpen,
    orders,
    refreshData,
    showToast,
    currentUser
  } = useApp();

  const [selectedOrderForReceipt, setSelectedOrderForReceipt] = useState(null);
  const [receiptType, setReceiptType] = useState('comanda');
  const [filterType, setFilterType] = useState('todas');

  // Track popups that have already completed their 6s screen time
  const [dismissedFromScreen, setDismissedFromScreen] = useState(() => new Set());
  const [exitingIds, setExitingIds] = useState(() => new Set());
  const seenIdsRef = useRef(new Set());
  const isInitialMount = useRef(true);
  const initializedPopupsRef = useRef(false);

  useEffect(() => {
    if (!isNotificationsOpen) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsNotificationsOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isNotificationsOpen, setIsNotificationsOpen]);

  // Al montar o refrescar la pantalla, evitar que las notificaciones historicas vuelvan a saltar como popups
  useEffect(() => {
    if (!initializedPopupsRef.current && Array.isArray(notifications) && notifications.length > 0) {
      const existingIds = new Set(notifications.map(n => n.id));
      setDismissedFromScreen(existingIds);
      notifications.forEach(n => seenIdsRef.current.add(n.id));
      initializedPopupsRef.current = true;
      isInitialMount.current = false;
      return;
    }

    if (isInitialMount.current) {
      (notifications || []).forEach(n => seenIdsRef.current.add(n.id));
      isInitialMount.current = false;
      return;
    }

    const unread = (notifications || []).filter(n => !n.read);
    const brandNew = unread.filter(n => !seenIdsRef.current.has(n.id));

    if (brandNew.length > 0) {
      brandNew.forEach(n => seenIdsRef.current.add(n.id));
      playArrivalSound();
    }
  }, [notifications]);

  // Auto-cierre de popups a los 6s en pantalla (sin ningun sonido al desaparecer)
  useEffect(() => {
    const unread = (notifications || []).filter(n => !n.read);
    unread.forEach(n => {
      if (!dismissedFromScreen.has(n.id) && !exitingIds.has(n.id)) {
        const timer = setTimeout(() => {
          setExitingIds(prev => new Set([...prev, n.id]));
          setTimeout(() => {
            setDismissedFromScreen(prev => new Set([...prev, n.id]));
            setExitingIds(prev => {
              const next = new Set(prev);
              next.delete(n.id);
              return next;
            });
          }, 350);
        }, 6000);

        return () => clearTimeout(timer);
      }
    });
  }, [notifications, dismissedFromScreen, exitingIds]);

  // Active floating popups: solo si el usuario inicio sesion (nunca en pantalla de login) y no vistas previamente
  const floatingPopups = !currentUser
    ? []
    : (notifications || [])
        .filter(n => !n.read && !dismissedFromScreen.has(n.id))
        .slice(0, 3);

  const filteredList = (notifications || []).filter(n => {
    if (filterType === 'todas') return true;
    return n.type === filterType;
  });

  const handleManualDismissPopup = (notifId, markRead = false) => {
    setExitingIds(prev => new Set([...prev, notifId]));
    setTimeout(() => {
      setDismissedFromScreen(prev => new Set([...prev, notifId]));
      setExitingIds(prev => {
        const next = new Set(prev);
        next.delete(notifId);
        return next;
      });
      if (markRead) {
        markNotificationRead(notifId);
      }
    }, 350);
  };

  const handleOpenTicket = async (notif) => {
    const order = (orders || []).find(o => o.id === notif.orderId);
    if (order) {
      setReceiptType(notif.type === 'cuenta' ? 'precuenta' : 'comanda');
      setSelectedOrderForReceipt(order);
    }
    if (!notif.read) {
      await markNotificationRead(notif.id);
    }
  };

  const handlePassToPendingPayment = async (notif) => {
    try {
      if (notif.orderId) {
        await api.markPendingPayment(notif.orderId);
      }
      await markNotificationRead(notif.id);
      await refreshData();
      showToast(`${notif.tableCode || 'Mesa'} pasada a Pendiente de cobro`);
    } catch (err) {
      showToast(err.message || 'No se pudo actualizar la mesa', 'error');
    }
  };

  const formatNotifTime = (iso) => {
    if (!iso) return '';
    return new Date(iso).toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  return (
    <>
      {/* Floating Comandas & Bill Requests on PC: positioned top-16 to avoid toast clash at bottom-4 */}
      {floatingPopups.length > 0 && !isNotificationsOpen && (
        <aside
          aria-label="Avisos de comandas y cuentas en tiempo real"
          className="fixed top-16 right-4 sm:right-6 z-40 w-[calc(100vw-2rem)] sm:w-96 space-y-2.5 pointer-events-none"
        >
          {floatingPopups.map(notif => {
            const isCuenta = notif.type === 'cuenta';
            const isExiting = exitingIds.has(notif.id);
            const relatedOrder = (orders || []).find(o => o.id === notif.orderId);
            const isDispatch = relatedOrder && (relatedOrder.channel === 'delivery' || relatedOrder.channel === 'take_away');
            const hasPhone = relatedOrder && relatedOrder.customerPhone;

            return (
              <div
                key={notif.id}
                role="status"
                aria-live="polite"
                className={`pos-panel p-3.5 shadow-2xl pointer-events-auto border-l-4 transform transition-all duration-300 ease-out ${
                  isExiting
                    ? 'translate-x-12 opacity-0 pointer-events-none'
                    : 'translate-x-0 opacity-100'
                } ${
                  isCuenta
                    ? 'border-l-[var(--status-account-bar)] bg-[var(--bg-surface)]'
                    : 'border-l-[var(--accent-brand)] bg-[var(--bg-surface)]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`pos-badge font-mono ${
                        isCuenta ? 'pos-badge-account' : 'pos-badge-brand'
                      }`}
                    >
                      <i
                        className={`fa-solid ${isCuenta ? 'fa-receipt' : 'fa-kitchen-set'} text-[11px]`}
                        aria-hidden="true"
                      ></i>
                      <span>{isCuenta ? 'Solicitó cuenta' : 'Comanda cocina'}</span>
                    </span>
                    <span className="text-xs font-mono text-[var(--text-muted)]">
                      {formatNotifTime(notif.createdAt)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleManualDismissPopup(notif.id, true)}
                    aria-label="Marcar aviso como recibido"
                    className="pos-btn-ghost min-h-[44px] min-w-[44px] -mt-1 -mr-1"
                  >
                    <i className="fa-solid fa-xmark text-sm" aria-hidden="true"></i>
                  </button>
                </div>

                <div className="mt-1">
                  <h3 className="font-display font-bold text-sm text-[var(--text-primary)]">
                    {notif.title}
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                    {notif.message}
                  </p>
                </div>

                {Array.isArray(notif.items) && notif.items.length > 0 && (
                  <div className="mt-2.5 p-2 rounded bg-[var(--bg-subtle)] border border-[var(--border-subtle)] space-y-1 max-h-28 overflow-y-auto">
                    {notif.items.map((it, idx) => (
                      <div key={idx} className="text-xs flex items-start justify-between gap-2">
                        <span className="text-[var(--text-primary)] truncate">
                          <strong className="font-mono">{it.quantity}x</strong> {it.productName}
                        </span>
                        {it.notes && (
                          <span className="text-[11px] text-[var(--accent-brand)] shrink-0 truncate max-w-[120px]">
                            ({it.notes})
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-3 pt-2.5 border-t border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] text-[var(--text-muted)]">
                    Pasa a avisos tras 6s
                  </span>

                  <div className="flex flex-wrap items-center gap-2">
                    {isCuenta && notif.orderId && (
                      <button
                        type="button"
                        onClick={() => handlePassToPendingPayment(notif)}
                        className="pos-btn-secondary text-xs px-2.5"
                      >
                        <i className="fa-solid fa-file-invoice-dollar text-xs text-[var(--status-bill-fg)]" aria-hidden="true"></i>
                        <span>Cobro</span>
                      </button>
                    )}

                    {notif.orderId && (
                      <button
                        type="button"
                        onClick={() => handleOpenTicket(notif)}
                        className="pos-btn-secondary text-xs px-2.5"
                      >
                        <i className="fa-solid fa-eye text-xs" aria-hidden="true"></i>
                        <span>Ticket</span>
                      </button>
                    )}

                    {isDispatch && hasPhone && (() => {
                      const waUrl = buildWhatsAppLink(
                        relatedOrder.customerPhone,
                        getDefaultDeliveryMessage({
                          customerName: relatedOrder.customerName,
                          orderNumber: relatedOrder.orderNumber,
                          channel: relatedOrder.channel,
                          driverName: relatedOrder.driverName
                        })
                      );
                      if (!waUrl) return null;
                      return (
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="pos-btn-secondary text-xs px-2.5 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 inline-flex items-center gap-1.5"
                          title="Contactar al cliente por WhatsApp"
                        >
                          <i className="fa-brands fa-whatsapp text-emerald-500 text-xs" aria-hidden="true"></i>
                          <span>WhatsApp</span>
                        </a>
                      );
                    })()}

                    <button
                      type="button"
                      onClick={() => handleManualDismissPopup(notif.id, true)}
                      className="pos-btn-primary text-xs px-2.5"
                    >
                      <i className="fa-solid fa-check text-xs" aria-hidden="true"></i>
                      <span>Recibido</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </aside>
      )}

      {/* Full Notification Center Modal / Drawer */}
      {isNotificationsOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-[var(--backdrop-overlay)]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="notif-drawer-title"
        >
          <button
            type="button"
            aria-label="Cerrar centro de comandas y avisos"
            className="fixed inset-0 cursor-default"
            onClick={() => setIsNotificationsOpen(false)}
            tabIndex={-1}
          />

          <div className="relative z-10 w-full max-w-md bg-[var(--bg-surface)] border-l border-[var(--border-subtle)] h-full flex flex-col shadow-2xl">
            <div className="px-4 py-3.5 border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <i className="fa-solid fa-bell text-sm text-[var(--accent-brand)]" aria-hidden="true"></i>
                <div>
                  <h2 id="notif-drawer-title" className="font-display font-bold text-base text-[var(--text-primary)] leading-tight">
                    Comandas y Cuentas Digitales
                  </h2>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Reemplazo digital de comandera impresa en cocina y caja
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsNotificationsOpen(false)}
                aria-label="Cerrar panel de avisos"
                className="pos-btn-ghost"
              >
                <i className="fa-solid fa-xmark text-base" aria-hidden="true"></i>
              </button>
            </div>

            <div className="px-4 py-2.5 border-b border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-2 bg-[var(--bg-surface)]">
              <div className="pos-segment-group" role="group" aria-label="Filtrar avisos">
                {[
                  { id: 'todas', label: 'Todas' },
                  { id: 'comanda', label: 'Cocina' },
                  { id: 'cuenta', label: 'Cuentas' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    aria-pressed={filterType === tab.id}
                    onClick={() => setFilterType(tab.id)}
                    className="pos-segment-btn text-xs px-2.5"
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {unreadNotificationsCount > 0 && (
                <button
                  type="button"
                  onClick={markAllNotificationsRead}
                  className="pos-btn-secondary text-xs px-2.5"
                >
                  <i className="fa-solid fa-check-double text-xs" aria-hidden="true"></i>
                  <span>Leer todas ({unreadNotificationsCount})</span>
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-[var(--border-subtle)]">
              {filteredList.length === 0 ? (
                <div className="p-10 text-center space-y-2">
                  <div className="w-10 h-10 rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-muted)] flex items-center justify-center mx-auto">
                    <i className="fa-solid fa-bell-slash text-base" aria-hidden="true"></i>
                  </div>
                  <p className="font-display font-bold text-sm text-[var(--text-primary)]">
                    Sin avisos registrados
                  </p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Cada pedido enviado a cocina o solicitud de cuenta aparecerá acá al instante.
                  </p>
                </div>
              ) : (
                filteredList.map(notif => {
                  const isCuenta = notif.type === 'cuenta';
                  const relatedOrder = (orders || []).find(o => o.id === notif.orderId);
                  const isDispatch = relatedOrder && (relatedOrder.channel === 'delivery' || relatedOrder.channel === 'take_away');
                  const hasPhone = relatedOrder && relatedOrder.customerPhone;
                  return (
                    <div
                      key={notif.id}
                      className={`p-4 space-y-2.5 transition-colors ${
                        !notif.read
                          ? 'bg-[var(--bg-elevated)] border-l-4 border-l-[var(--accent-brand)]'
                          : 'bg-[var(--bg-surface)]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`pos-badge font-mono ${
                              isCuenta ? 'pos-badge-account' : 'pos-badge-brand'
                            }`}
                          >
                            <i
                              className={`fa-solid ${isCuenta ? 'fa-receipt' : 'fa-kitchen-set'} text-[11px]`}
                              aria-hidden="true"></i>
                            <span>{isCuenta ? 'Cuenta' : 'Comanda'}</span>
                          </span>
                          {!notif.read && (
                            <span className="pos-badge pos-badge-open text-[11px]">Nueva</span>
                          )}
                        </div>
                        <span className="text-xs font-mono text-[var(--text-muted)]">
                          {formatNotifTime(notif.createdAt)}
                        </span>
                      </div>

                      <div>
                        <h3 className="font-display font-bold text-sm text-[var(--text-primary)]">
                          {notif.title}
                        </h3>
                        <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                          {notif.message}
                        </p>
                      </div>

                      {Array.isArray(notif.items) && notif.items.length > 0 && (
                        <div className="p-2.5 rounded bg-[var(--bg-subtle)] border border-[var(--border-subtle)] space-y-1">
                          {notif.items.map((it, idx) => (
                            <div key={idx} className="text-xs flex items-center justify-between gap-2">
                              <span className="text-[var(--text-primary)]">
                                <strong className="font-mono">{it.quantity}x</strong> {it.productName}
                              </span>
                              {it.notes && (
                                <span className="text-[11px] text-[var(--accent-brand)] font-medium">
                                  {it.notes}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                        {isCuenta && notif.orderId && (
                          <button
                            type="button"
                            onClick={() => handlePassToPendingPayment(notif)}
                            className="pos-btn-secondary text-xs px-3"
                          >
                            <i className="fa-solid fa-file-invoice-dollar text-xs text-[var(--status-bill-fg)]" aria-hidden="true"></i>
                            <span>Pasar a Pendiente cobro</span>
                          </button>
                        )}

                        {notif.orderId && (
                          <button
                            type="button"
                            onClick={() => handleOpenTicket(notif)}
                            className="pos-btn-secondary text-xs px-3"
                          >
                            <i className="fa-solid fa-receipt text-xs" aria-hidden="true"></i>
                            <span>Ver ticket</span>
                          </button>
                        )}

                        {isDispatch && hasPhone && (() => {
                          const waUrl = buildWhatsAppLink(
                            relatedOrder.customerPhone,
                            getDefaultDeliveryMessage({
                              customerName: relatedOrder.customerName,
                              orderNumber: relatedOrder.orderNumber,
                              channel: relatedOrder.channel,
                              driverName: relatedOrder.driverName
                            })
                          );
                          if (!waUrl) return null;
                          return (
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="pos-btn-secondary text-xs px-3 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 inline-flex items-center gap-1.5"
                              title="Contactar al cliente por WhatsApp"
                            >
                              <i className="fa-brands fa-whatsapp text-emerald-500 text-xs" aria-hidden="true"></i>
                              <span>WhatsApp</span>
                            </a>
                          );
                        })()}

                        {!notif.read && (
                          <button
                            type="button"
                            onClick={() => markNotificationRead(notif.id)}
                            className="pos-btn-primary text-xs px-3"
                          >
                            <i className="fa-solid fa-check text-xs" aria-hidden="true"></i>
                            <span>Recibido</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {selectedOrderForReceipt && (
        <ReceiptModal
          isOpen={!!selectedOrderForReceipt}
          onClose={() => setSelectedOrderForReceipt(null)}
          order={selectedOrderForReceipt}
          type={receiptType}
        />
      )}
    </>
  );
}
