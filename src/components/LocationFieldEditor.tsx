// Editor do campo personalizado "Localização" (issue #193). Usado tanto na
// célula da tabela (Lista) quanto na aba "Campos" do detalhe da tarefa —
// ambos os chamadores em App.tsx passam value/onCommit no mesmo formato de
// CustomFieldLocationValue (src/types.ts).
import React, { useEffect, useRef, useState } from 'react';
import { geocodeAddress } from '../lib/mapbox';
import type { CustomFieldLocationValue } from '../types';

const EMPTY: CustomFieldLocationValue = { address: '', lat: null, lng: null, geocodedAt: null };

function normalize(value: any): CustomFieldLocationValue {
  if (value && typeof value === 'object' && typeof value.address === 'string') return value;
  // valor legado/ausente: string simples ou nada
  if (typeof value === 'string' && value) return { address: value, lat: null, lng: null, geocodedAt: null };
  return EMPTY;
}

export function LocationFieldEditor({
  value,
  onCommit,
  compact = false,
}: {
  value: any;
  onCommit: (next: CustomFieldLocationValue) => void;
  compact?: boolean;
}) {
  const current = normalize(value);
  const [address, setAddress] = useState(current.address);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'invalid'>(
    current.lat != null ? 'ok' : current.address ? 'invalid' : 'idle'
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setAddress(current.address);
    setStatus(current.lat != null ? 'ok' : current.address ? 'invalid' : 'idle');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current.address, current.lat]);

  const runGeocode = async (addr: string) => {
    if (!addr.trim()) {
      setStatus('idle');
      onCommit(EMPTY);
      return;
    }
    setStatus('loading');
    const result = await geocodeAddress(addr);
    if (result) {
      setStatus('ok');
      onCommit({ address: addr, lat: result.lat, lng: result.lng, geocodedAt: new Date().toISOString() });
    } else {
      // Fallback para endereço inválido: mantém o texto, sem lat/lng.
      setStatus('invalid');
      onCommit({ address: addr, lat: null, lng: null, geocodedAt: null });
    }
  };

  const handleChange = (v: string) => {
    setAddress(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runGeocode(v), 700);
  };

  return (
    <div className={compact ? '' : 'mt-1'}>
      <div className="relative">
        <input
          type="text"
          value={address}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Digite um endereço..."
          className={`w-full rounded-md border border-gray-200 bg-white pl-7 pr-7 text-gray-700 focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)] transition-shadow ${compact ? 'h-8 text-xs' : 'h-9 text-sm p-2'}`}
        />
        <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" />
        </svg>
        {status === 'loading' && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-gray-300 border-t-[var(--primary-color)] rounded-full animate-spin" />
        )}
        {status === 'ok' && (
          <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
        )}
      </div>
      {status === 'invalid' && address.trim() !== '' && (
        <p className="text-[10px] text-amber-600 mt-1">Endereço não encontrado — texto salvo, sem coordenadas.</p>
      )}
    </div>
  );
}
