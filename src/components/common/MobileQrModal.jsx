import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import { generateQrMatrix } from '../../utils/qrGenerator';

export default function MobileQrModal() {
  const { isQrModalOpen, setIsQrModalOpen, showToast, tables, orders } = useApp();
  const [lanIps, setLanIps] = useState([]);
  const [selectedHost, setSelectedHost] = useState('');

  useEffect(() => {
    if (!isQrModalOpen) return;
    const origin = window.location.origin;
    setSelectedHost(origin);

    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      api.getNetworkInfo().then((info) => {
        if (info?.lanIps?.length > 0) {
          setLanIps(info.lanIps);
          const port = window.location.port ? `:${window.location.port}` : '';
          setSelectedHost(`${window.location.protocol}//${info.lanIps[0]}${port}`);
        }
      });
    }
  }, [isQrModalOpen]);

  useEffect(() => {
    if (!isQrModalOpen) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setIsQrModalOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isQrModalOpen, setIsQrModalOpen]);

  const comanderaUrl = useMemo(() => {
    const base = (selectedHost || window.location.origin).replace(/\/+$/, '');
    return `${base}/?mode=comandera`;
  }, [selectedHost]);

  const qrMatrix = useMemo(() => {
    return generateQrMatrix(comanderaUrl);
  }, [comanderaUrl]);

  if (!isQrModalOpen) return null;

  const openTablesCount = tables.filter(t => t.status !== 'libre').length;
  const activeOrdersCount = orders.filter(o => o.status === 'abierto' || o.status === 'cuenta_pedida').length;

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(comanderaUrl);
      showToast('Enlace de comandera copiado al portapapeles');
    } catch {
      showToast('Copiá manualmente la dirección del recuadro', 'info');
    }
  };

  const quietZone = 3;
  const totalModules = qrMatrix.length + quietZone * 2;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--backdrop-overlay)] p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="qr-modal-title"
    >
      <div className="pos-panel w-full max-w-xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-4 py-3.5 border-b border-[var(--border-subtle)] flex items-center justify-between bg-[var(--bg-subtle)]">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded bg-[var(--accent-brand-bg)] border border-[var(--accent-brand-border)] text-[var(--accent-brand)] flex items-center justify-center">
              <i className="fa-solid fa-qrcode text-sm" aria-hidden="true"></i>
            </span>
            <div>
              <h2 id="qr-modal-title" className="font-display font-bold text-base text-[var(--text-primary)] leading-tight">
                Comandera móvil para mozos
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Terminal independiente sincronizada en tiempo real con salón y caja
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsQrModalOpen(false)}
            aria-label="Cerrar ventana de código QR"
            className="pos-btn-ghost"
          >
            <i className="fa-solid fa-xmark text-base" aria-hidden="true"></i>
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
          {/* Left: Crisp Scannable SVG QR */}
          <div className="md:col-span-5 flex flex-col items-center">
            <div className="p-3 bg-[#ffffff] rounded-md border-2 border-[var(--border-strong)] shadow-sm">
              <svg
                viewBox={`0 0 ${totalModules} ${totalModules}`}
                width="196"
                height="196"
                shapeRendering="crispEdges"
                role="img"
                aria-label={`Código QR hacia ${comanderaUrl}`}
                className="block w-44 h-44 sm:w-48 sm:h-48"
              >
                <rect width={totalModules} height={totalModules} fill="#ffffff" />
                {qrMatrix.map((row, rIdx) =>
                  row.map((cell, cIdx) =>
                    cell ? (
                      <rect
                        key={`${rIdx}-${cIdx}`}
                        x={cIdx + quietZone}
                        y={rIdx + quietZone}
                        width={1}
                        height={1}
                        fill="#111315"
                      />
                    ) : null
                  )
                )}
              </svg>
            </div>

            <div className="mt-2.5 flex items-center gap-1.5 text-xs font-mono text-[var(--status-open-fg)]">
              <span className="w-2 h-2 rounded-full bg-[var(--status-open-bar)]" aria-hidden="true"></span>
              <span>Sincronización activa ({openTablesCount} mesas · {activeOrdersCount} comandas)</span>
            </div>
          </div>

          {/* Right: Instructions & Direct Launch */}
          <div className="md:col-span-7 space-y-3.5">
            <div className="space-y-2 text-sm text-[var(--text-secondary)]">
              <p className="font-semibold text-[var(--text-primary)]">
                ¿Cómo vincular los teléfonos del salón?
              </p>
              <ol className="space-y-1.5 text-xs leading-relaxed list-decimal list-inside">
                <li>Escaneá el código QR con la cámara del celular del mozo.</li>
                <li>Se abrirá la <strong>Comandera Móvil</strong> de forma independiente, sin los paneles administrativos de escritorio.</li>
                <li>Cada mozo ingresa con su PIN de 4 dígitos y toma pedidos directo en la mesa.</li>
                <li>Al marchar una comanda o pedir la cuenta, el salón y la caja de escritorio se actualizan automáticamente.</li>
              </ol>
            </div>

            {lanIps.length > 0 && (
              <div>
                <label htmlFor="qr-host-select" className="pos-label">
                  Red local detectada (Wi-Fi del salón):
                </label>
                <select
                  id="qr-host-select"
                  value={selectedHost}
                  onChange={(e) => setSelectedHost(e.target.value)}
                  className="pos-input font-mono text-xs"
                >
                  {lanIps.map((ip) => {
                    const port = window.location.port ? `:${window.location.port}` : '';
                    const url = `${window.location.protocol}//${ip}${port}`;
                    return (
                      <option key={ip} value={url}>
                        Red Wi-Fi local ({url})
                      </option>
                    );
                  })}
                  <option value={window.location.origin}>
                    Este equipo ({window.location.origin})
                  </option>
                </select>
              </div>
            )}

            <div>
              <label htmlFor="qr-direct-url" className="pos-label">
                Dirección directa de la comandera móvil:
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="qr-direct-url"
                  type="text"
                  readOnly
                  value={comanderaUrl}
                  className="pos-input font-mono text-xs flex-1"
                />
                <button
                  type="button"
                  onClick={handleCopyUrl}
                  className="pos-btn-secondary px-3 shrink-0"
                  aria-label="Copiar enlace de comandera"
                >
                  <i className="fa-solid fa-copy text-xs" aria-hidden="true"></i>
                  <span>Copiar</span>
                </button>
              </div>
            </div>

            <div className="pt-1 flex flex-wrap items-center gap-2">
              <a
                href="/?mode=comandera"
                target="_blank"
                rel="noopener noreferrer"
                className="pos-btn-primary flex-1 text-center"
              >
                <i className="fa-solid fa-up-right-from-square text-xs" aria-hidden="true"></i>
                <span>Abrir comandera independiente</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
