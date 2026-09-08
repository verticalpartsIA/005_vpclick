import React, { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
// Issue #192 (Mapa Mental, modo "Forma livre") — reaproveita a mesma engine
// tldraw do Whiteboards (issue #191), não construída do zero. Módulo próprio
// (carregado via React.lazy em App.tsx) pelo mesmo motivo do WhiteboardCanvas:
// o import de 'tldraw' roda uma detecção de ambiente (CSS.supports) assim que
// o módulo carrega, o que quebra os testes Vitest (jsdom não implementa
// CSS.supports) se ficar no topo do App.tsx.
import { Tldraw, Editor as TldrawEditor, getSnapshot as getTldrawSnapshot, loadSnapshot as loadTldrawSnapshot } from 'tldraw';
import 'tldraw/tldraw.css';
import * as taskRepo from '../../lib/taskRepo';
import { Icons } from '../../constants';
import { MindMapDef } from '../../types';

export function MindMapCanvas({ mindMap, onClose }: { mindMap: MindMapDef; onClose: () => void }) {
  const editorRef = useRef<TldrawEditor | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isLoadingDoc, setIsLoadingDoc] = useState(true);
  const [initialDoc, setInitialDoc] = useState<any>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');

  useEffect(() => {
    let cancelled = false;
    taskRepo.fetchMindMapDocument(mindMap.id)
      .then((doc) => { if (!cancelled) { setInitialDoc(doc); setIsLoadingDoc(false); } })
      .catch((err) => { console.error('MindMapCanvas: erro ao carregar', err); if (!cancelled) setIsLoadingDoc(false); });
    return () => { cancelled = true; };
  }, [mindMap.id]);

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaveState('saving');
    saveTimerRef.current = setTimeout(async () => {
      const editor = editorRef.current;
      if (!editor) return;
      const { document } = getTldrawSnapshot(editor.store);
      const res = await taskRepo.saveMindMapDocument(mindMap.id, document);
      setSaveState(res.ok ? 'saved' : 'idle');
      if (!res.ok) toast.error('Erro ao salvar o mapa: ' + res.message);
    }, 1500);
  }, [mindMap.id]);

  const handleMount = useCallback((editor: TldrawEditor) => {
    editorRef.current = editor;
    if (initialDoc) {
      try { loadTldrawSnapshot(editor.store, { document: initialDoc }); }
      catch (err) { console.error('MindMapCanvas: erro ao aplicar snapshot salvo', err); }
    }
    const unsubscribe = editor.store.listen(() => { scheduleSave(); }, { source: 'user', scope: 'document' });
    return () => {
      unsubscribe();
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [initialDoc, scheduleSave]);

  if (isLoadingDoc) {
    return (
      <div className="fixed inset-0 z-[300] bg-white flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gray-200 border-t-fuchsia-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[300] bg-white flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 shrink-0" title="Voltar aos Mapas Mentais">
            <Icons.ChevronRight className="w-4 h-4 rotate-180" />
          </button>
          <span className="font-semibold text-sm text-gray-800 truncate">{mindMap.name}</span>
        </div>
        <span className="text-xs text-gray-400 shrink-0">{saveState === 'saving' ? 'Salvando...' : saveState === 'saved' ? 'Salvo' : ''}</span>
      </div>
      <div className="flex-1 relative">
        <Tldraw onMount={handleMount} />
      </div>
    </div>
  );
}
