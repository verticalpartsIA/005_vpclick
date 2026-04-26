import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface LoginScreenProps {
    onLogin: () => void;
}

const BACKGROUND_IMAGES = [
    'https://verticalparts.com.br/wp-content/uploads/2026/02/2.png',
    'https://verticalparts.com.br/wp-content/uploads/2026/02/1.png',
    'https://verticalparts.com.br/wp-content/uploads/2026/02/3.png',
];

const LOGO_URL = 'https://verticalparts.com.br/wp-content/uploads/2026/01/grp__NM__bg__NM__logotipo_branco.png';

export default function LoginScreen({ onLogin }: LoginScreenProps) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [step, setStep] = useState<'login' | '2fa'>('login');
    const [pin, setPin] = useState('');
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

    // Carousel state
    const [bgIndex, setBgIndex] = useState(0);

    // Force redirect to central portal to ensure SSO usage (só em produção)
    useEffect(() => {
        if (window.location.hostname === 'vpclick.vpsistema.com') {
            window.location.replace("https://vpsistema.com");
        }
    }, []);

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
                setCurrentUserId(data.user.id);

                // Chamar Edge Function para enviar PIN
                const { data: fnData, error: fnError } = await supabase.functions.invoke('send-2fa-pin', {
                    body: { email: data.user.email, userId: data.user.id }
                });

                if (fnError) {
                    setError(`Erro ao enviar código (Network): ${fnError.message}`);
                    setLoading(false);
                    return;
                }

                if (fnData && fnData.success === false) {
                    setError(`Erro ao enviar código: ${fnData.error}`);
                    setLoading(false);
                    return;
                }

                setStep('2fa');
            }
        } catch (err: any) {
            setError(err.message || 'Erro inesperado.');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyPin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!pin || pin.length < 6) {
            setError('Digite o código de 6 dígitos.');
            return;
        }
        setLoading(true);
        setError(null);

        try {
            // Verificar PIN no banco
            const { data, error: dbError } = await supabase
                .from('auth_pins')
                .select('*')
                .eq('user_id', currentUserId)
                .eq('pin', pin)
                .gt('expires_at', new Date().toISOString())
                .is('verified_at', null)
                .maybeSingle();

            if (dbError) throw dbError;

            if (!data) {
                setError('Código inválido ou expirado.');
                setLoading(false);
                return;
            }

            // Marcar como verificado
            await supabase
                .from('auth_pins')
                .update({ verified_at: new Date().toISOString() })
                .eq('id', data.id);

            // Persistir verificação de 2FA - usa localStorage para sobreviver ao F5
            localStorage.setItem('vp_2fa_verified', 'true');
            onLogin();
        } catch (err: any) {
            setError(err.message || 'Erro na verificação.');
        } finally {
            setLoading(false);
        }
    };

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

                    {step === 'login' ? (
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

                            {error && (
                                <div className="bg-red-500/20 border border-red-500/40 rounded-2xl p-4 flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                                    <svg className="w-5 h-5 text-red-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <p className="text-red-400 text-xs font-bold leading-tight">{error}</p>
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full h-14 bg-yellow-400 hover:bg-yellow-300 text-slate-900 font-black rounded-2xl text-sm transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:transform-none shadow-xl shadow-yellow-400/20 mt-4 uppercase tracking-widest"
                            >
                                {loading ? 'Entrando...' : 'Entrar'}
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={handleVerifyPin} className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
                            <div className="text-center space-y-2">
                                <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-500/20 rounded-full mb-2">
                                    <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <h2 className="text-xl font-bold text-white">Verificação de Segurança</h2>
                                <p className="text-slate-400 text-xs px-4">
                                    Enviamos um código de 6 dígitos para o seu e-mail cadastrado.
                                </p>
                            </div>

                            <div className="space-y-2">
                                <input
                                    type="text"
                                    maxLength={6}
                                    value={pin}
                                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                                    placeholder="000000"
                                    className="w-full h-16 bg-white/10 border border-white/20 rounded-2xl px-4 text-center text-2xl font-black text-white tracking-[0.5em] focus:outline-none focus:border-yellow-400 focus:ring-4 focus:ring-yellow-400/20 transition-all placeholder:opacity-20 translate-x-[0.25em]"
                                    disabled={loading}
                                    autoFocus
                                />
                            </div>

                            {error && (
                                <div className="bg-red-500/20 border border-red-500/40 rounded-2xl p-4 text-center">
                                    <p className="text-red-400 text-xs font-bold">{error}</p>
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full h-14 bg-yellow-400 hover:bg-yellow-300 text-slate-900 font-black rounded-2xl text-sm transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:transform-none shadow-xl shadow-yellow-400/20 uppercase tracking-widest"
                            >
                                {loading ? 'Validando...' : 'Confirmar Código'}
                            </button>

                            <button
                                type="button"
                                onClick={() => setStep('login')}
                                className="w-full text-slate-500 text-xs font-bold hover:text-slate-400 transition-colors uppercase tracking-widest"
                            >
                                Voltar ao login
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
