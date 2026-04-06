import React, { useState } from 'react';
import { X, Check, Layout, Palette } from 'lucide-react';
import { StatusGroup } from '../types';

interface CreateListModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (name: string, statusGroupId: string) => void;
    statusGroups: StatusGroup[];
}

const CreateListModal: React.FC<CreateListModalProps> = ({ isOpen, onClose, onConfirm, statusGroups }) => {
    const [name, setName] = useState('');
    const [selectedGroupId, setSelectedGroupId] = useState(statusGroups[0]?.id || '');

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim() && selectedGroupId) {
            onConfirm(name.trim(), selectedGroupId);
            setName('');
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] animate-in fade-in duration-200 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-6 border-b">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                            <Layout className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-800">Nova Lista</h2>
                            <p className="text-xs text-gray-500">Organize suas tarefas em uma nova lista</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Nome da Lista</label>
                        <input
                            autoFocus
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Ex: Marketing Digital, Produção de Vídeos..."
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                            <Palette className="w-4 h-4 text-gray-400" />
                            Modelo de Status
                        </label>
                        <div className="grid grid-cols-1 gap-3">
                            {statusGroups.map((group) => (
                                <div
                                    key={group.id}
                                    onClick={() => setSelectedGroupId(group.id)}
                                    className={`cursor-pointer group relative p-4 rounded-xl border-2 transition-all ${selectedGroupId === group.id
                                            ? 'border-primary bg-primary/[0.02]'
                                            : 'border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50'
                                        }`}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <span className={`font-bold text-sm ${selectedGroupId === group.id ? 'text-primary' : 'text-gray-700'}`}>
                                            {group.name}
                                        </span>
                                        {selectedGroupId === group.id && (
                                            <div className="bg-primary text-white p-0.5 rounded-full">
                                                <Check className="w-3 h-3" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap gap-1.5 leading-none">
                                        {group.options.map((opt) => (
                                            <span
                                                key={opt.id}
                                                className="text-[10px] px-1.5 py-0.5 rounded-md border text-gray-500 bg-white group-hover:bg-gray-50"
                                                style={{ borderColor: opt.color }}
                                            >
                                                {opt.label}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-3 text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={!name.trim() || !selectedGroupId}
                            className="flex-[2] px-4 py-3 text-sm font-bold text-white bg-primary hover:bg-primary-dark rounded-xl shadow-lg shadow-primary/25 disabled:opacity-50 disabled:shadow-none transition-all flex items-center justify-center gap-2"
                        >
                            <Check className="w-4 h-4" />
                            Criar Lista
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateListModal;
