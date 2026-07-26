import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface LoginScreenProps {
    onLogin: () => void;
    /** Mensagem de erro quando o SSO do vpsistema falhou nesta visita. */
    ssoError?: string | null;
}

const BACKGROUND_IMAGES = [
    'https://verticalparts.com.br/wp-content/uploads/2026/02/2.png',
    'https://verticalparts.com.br/wp-content/uploads/2026/02/1.png',
    'https://verticalparts.com.br/wp-content/uploads/2026/02/3.png',
];

const LOGO_URL = 'https://verticalparts.com.br/wp-content/uploads/2026/01/grp__NM__bg__NM__logotipo_branco.png';

// O VP Click não tem porta de entrada própria: em produção o acesso é
// obrigatoriamente pelo portal central (vpsistema → login → card VP Click).
// Quem colar a URL do VP Click direto no navegador é devolvido pro portal.
const PRODUCTION_HOST = 'vpclick.vpsistema.com';
const PORTAL_URL = 'https://vpsistema.com';

export default function LoginScreen({ onLogin, ssoError }: LoginScreenProps) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Carousel state
    const [bgIndex, setBgIndex] = useState(0);

    // Em produção não existe entrada alternativa — nem o formulário de
    // email/senha abaixo, que fica só pra desenvolvimento local e testes.
    const entradaSomentePeloPortal = window.location.hostname === PRODUCTION_HOST;

    // Devolve pro portal quem chegou aqui direto. A exceção é quando o SSO
    // já falhou nesta visita: aí redirecionar de novo joga a pessoa no portal,
    // que a manda de volta pra cá, e o vai-e-vem se repete sem nunca mostrar
    // o motivo da falha. Nesse caso paramos e explicamos o que aconteceu.
    useEffect(() => {
        if (ssoError) return;
        if (entradaSomentePeloPortal) {
            window.location.replace(PORTAL_URL);
        }
    }, [ssoError, entradaSomentePeloPortal]);

    useEffect(() => {
        const interval = setInterval(() => {
            setBgIndex((prev) => (prev + 1) % BACKGROUND_IMAGES.length);
        }, 8000); // 8 segundos
        return () => clearInterval(interval);
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) {
            setError('Preencha email e senha.');
            return;
        }
        setLoading(true);
        setError(null);

        try {
            const { data, error: authError } = await supabase.auth.signInWithPassword({
                email: email.trim().toLowerCase(),
                password,
            });

            if (authError) {
                setError(`Erro ao logar: ${authError.message}`);
                setLoading(false);
                return;
            }

            if (data.user) {
                localStorage.setItem('vp_2fa_verified', 'true');
                onLogin();
            }
        } catch (err: any) {
            setError(err.message || 'Erro inesperado.');
        } finally {
            setLoading(false);
        }
    };

    const errorBox = (mensagem: string) => (
        <div className="bg-red-500/20 border border-red-500/40 rounded-2xl p-4 flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
            <svg className="w-5 h-5 text-red-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-red-400 text-xs font-bold leading-tight">{mensagem}</p>
        </div>
    );

    return (
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-slate-900">
            {/* Background Carousel */}
            {BACKGROUND_IMAGES.map((img, idx) => (
                <div
                    key={img}
                    className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${bgIndex === idx ? 'opacity-40' : 'opacity-0'}`}
                    style={{
                        backgroundImage: `url(${img})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                    }}
                />
            ))}

            {/* Overlay Gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-slate-900/60" />

            <div className="relative w-full max-w-md mx-4">
                {/* Card */}
                <div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-3xl p-10 shadow-3xl">
                    {/* Logo */}
                    <div className="text-center mb-10">
                        <img
                            src={LOGO_URL}
                            alt="VerticalParts Logo"
                            className="h-20 mx-auto mb-6 drop-shadow-2xl"
                        />
                        <h1 className="text-3xl font-black text-white tracking-tight uppercase">VP CLICK</h1>
                        <p className="text-slate-300 text-sm mt-2 font-medium">Sistema de Gerenciamento VerticalParts</p>
                    </div>

                    {entradaSomentePeloPortal ? (
                        // Produção: sem porta própria. Ou estamos indo pro portal,
                        // ou o SSO falhou e mostramos o motivo com um caminho de volta.
                        <div className="space-y-5">
                            {ssoError ? (
                                <>
                                    {errorBox(`Não foi possível validar seu acesso pelo portal: ${ssoError}`)}
                                    <p className="text-slate-300 text-xs leading-relaxed text-center">
                                        O acesso ao VP CLICK é sempre pelo portal VerticalParts.
                                        Entre no portal e clique no card do VP CLICK. Se o erro
                                        continuar, avise o administrador com a mensagem acima.
                                    </p>
                                </>
                            ) : (
                                <p className="text-slate-300 text-xs leading-relaxed text-center">
                                    Redirecionando para o portal VerticalParts, onde você faz o
                                    login e acessa o VP CLICK pelo card do sistema...
                                </p>
                            )}

                            <a
                                href={PORTAL_URL}
                                className="w-full h-14 bg-yellow-400 hover:bg-yellow-300 text-slate-900 font-black rounded-2xl text-sm transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-yellow-400/20 mt-4 uppercase tracking-widest flex items-center justify-center"
                            >
                                Ir para o portal
                            </a>
                        </div>
                    ) : (
                        // Fora de produção (dev local): formulário direto, pra
                        // desenvolvimento e testes sem depender do portal.
                        <form onSubmit={handleLogin} className="space-y-5">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-300 uppercase tracking-widest ml-1">Email</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="seu@email.com.br"
                                    className="w-full h-14 bg-white/10 border border-white/20 rounded-2xl px-5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-yellow-400 focus:ring-4 focus:ring-yellow-400/20 transition-all"
                                    autoComplete="email"
                                    disabled={loading}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-300 uppercase tracking-widest ml-1">Senha</label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••••"
                                    className="w-full h-14 bg-white/10 border border-white/20 rounded-2xl px-5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-yellow-400 focus:ring-4 focus:ring-yellow-400/20 transition-all"
                                    autoComplete="current-password"
                                    disabled={loading}
                                />
                            </div>

                            {error && errorBox(error)}

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full h-14 bg-yellow-400 hover:bg-yellow-300 text-slate-900 font-black rounded-2xl text-sm transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:transform-none shadow-xl shadow-yellow-400/20 mt-4 uppercase tracking-widest"
                            >
                                {loading ? 'Entrando...' : 'Entrar'}
                            </button>
                        </form>
                    )}

                    {/* Footer */}
                    <p className="text-center text-slate-500 text-[10px] mt-10 font-bold uppercase tracking-widest">
                        VerticalParts © {new Date().getFullYear()} · VP CLICK v2.0
                    </p>
                </div>
            </div>
        </div>
    );
}
