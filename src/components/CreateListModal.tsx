import React, { useState, useEffect, useRef } from 'react';
import { X, Check, Layout, ChevronRight, Loader2 } from 'lucide-react';
import { StatusGroup } from '../types';

interface CreateListModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (name: string, statusGroupId: string) => Promise<void>;
    statusGroups: StatusGroup[];
}

const CreateListModal: React.FC<CreateListModalProps> = ({ isOpen, onClose, onConfirm, statusGroups }) => {
    const [name, setName]                   = useState('');
    const [selectedGroupId, setSelectedGroupId] = useState('');
    const [isSubmitting, setIsSubmitting]   = useState(false);
    const nameRef = useRef<HTMLInputElement>(null);

    // Auto-seleciona o primeiro grupo quando os dados chegarem
    useEffect(() => {
        if (statusGroups.length > 0 && !selectedGroupId) {
            setSelectedGroupId(statusGroups[0].id);
        }
    }, [statusGroups]);

    // Foca no campo nome ao abrir
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => nameRef.current?.focus(), 80);
        }
    }, [isOpen]);

    // Reseta ao fechar
    useEffect(() => {
        if (!isOpen) {
            setName('');
            setIsSubmitting(false);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const selectedGroup = statusGroups.find(g => g.id === selectedGroupId);
    const canSubmit = name.trim().length > 0 && !!selectedGroupId && !isSubmitting;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canSubmit) return;
        setIsSubmitting(true);
        try {
            await onConfirm(name.trim(), selectedGroupId);
            setName('');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-4"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <form
                onSubmit={handleSubmit}
                className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
                style={{ maxHeight: '90vh' }}
            >
                {/* ── Cabeçalho ───────────────────────────────── */}
                <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-[var(--primary-color)]/15 rounded-xl flex items-center justify-center">
                            <Layout className="w-4 h-4 text-[var(--primary-color)]" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-gray-900">Nova Lista</h2>
                            <p className="text-xs text-gray-400">Dê um nome e escolha o modelo de status</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* ── Campo de nome ────────────────────────────── */}
                <div className="px-6 pt-5 pb-4 shrink-0">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
                        Nome da lista
                    </label>
                    <input
                        ref={nameRef}
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Ex: Marketing Digital, Produção de Vídeos..."
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/30 focus:border-[var(--primary-color)] transition-all"
                        required
                    />
                </div>

                {/* ── Modelo de status (scrollável) ────────────── */}
                <div className="px-6 pb-2 shrink-0">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
                        Modelo de status
                    </label>
                </div>

                <div className="px-6 overflow-y-auto flex-1 space-y-2 pb-4 custom-scrollbar">
                    {statusGroups.map((group) => {
                        const isSelected = selectedGroupId === group.id;
                        return (
                            <div
                                key={group.id}
                                onClick={() => setSelectedGroupId(group.id)}
                                className={`cursor-pointer relative p-3.5 rounded-xl border-2 transition-all ${
                                    isSelected
                                        ? 'border-[var(--primary-color)] bg-[var(--primary-color)]/[0.04] shadow-sm'
                                        : 'border-gray-100 bg-white hover:border-gray-300 hover:bg-gray-50/80'
                                }`}
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <span className={`font-bold text-sm ${isSelected ? 'text-[var(--primary-color)]' : 'text-gray-700'}`}>
                                        {group.name}
                                    </span>
                                    {isSelected ? (
                                        <div className="bg-[var(--primary-color)] text-white p-0.5 rounded-full">
                                            <Check className="w-3 h-3" />
                                        </div>
                                    ) : (
                                        <div className="w-4 h-4 rounded-full border-2 border-gray-200" />
                                    )}
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {group.options.map((opt) => (
                                        <span
                                            key={opt.id}
                                            className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                                            style={{
                                                backgroundColor: opt.color + '22',
                                                color: opt.color,
                                                border: `1px solid ${opt.color}55`
                                            }}
                                        >
                                            {opt.label}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* ── Rodapé fixo sempre visível ───────────────── */}
                <div className="px-6 py-4 border-t bg-gray-50/80 shrink-0">
                    {/* Preview do que será criado */}
                    {name.trim() && selectedGroup && (
                        <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs text-gray-500">
                            <Layout className="w-3.5 h-3.5 text-[var(--primary-color)] shrink-0" />
                            <span className="font-semibold text-gray-800 truncate">{name.trim()}</span>
                            <ChevronRight className="w-3 h-3 shrink-0" />
                            <span className="truncate">{selectedGroup.name}</span>
                            <span className="ml-auto text-[10px] text-green-600 font-bold shrink-0">Pronto para criar</span>
                        </div>
                    )}

                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 text-sm font-semibold text-gray-600 bg-white border border-gray-200 hover:bg-gray-100 rounded-xl transition-all"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={!canSubmit}
                            className={`flex-[2] px-4 py-2.5 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
                                canSubmit
                                    ? 'bg-[var(--primary-color)] text-[#2c3e50] hover:brightness-95 shadow-md'
                                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            }`}
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Criando lista...
                                </>
                            ) : (
                                <>
                                    <Check className="w-4 h-4" />
                                    {!name.trim()
                                        ? 'Digite um nome para continuar'
                                        : !selectedGroupId
                                        ? 'Escolha um modelo'
                                        : 'Criar Lista'}
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
};

export default CreateListModal;
