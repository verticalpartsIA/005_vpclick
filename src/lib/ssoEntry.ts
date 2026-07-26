// Ponto único de leitura do token de SSO que o portal (vpsistema) manda na URL.
//
// A limpeza da URL acontece num script inline no <head> do index.html, que roda
// antes do bundle baixar — sem isso, o endereço com o token gigante fica visível
// na barra por todo o tempo de carregamento do JS. Aqui só recolhemos o valor
// que aquele script guardou.
//
// O fallback lê da própria URL (e limpa) para os casos em que o script inline
// não rodou: ambiente de teste que monta o app sem o index.html, navegador sem
// suporte a URL/replaceState, ou o próprio `npm run dev` com HTML alternativo.

declare global {
    interface Window {
        __VP_SSO_TOKEN__?: string;
    }
}

function limparDaURL(): string | null {
    try {
        const url = new URL(window.location.href);
        const token = url.searchParams.get('sso_token');
        if (!token) return null;
        url.searchParams.delete('sso_token');
        const query = url.searchParams.toString();
        window.history.replaceState(
            {},
            document.title,
            url.pathname + (query ? `?${query}` : '') + url.hash,
        );
        return token;
    } catch {
        return null;
    }
}

function capturar(): string | null {
    const doScriptInline = typeof window !== 'undefined' ? window.__VP_SSO_TOKEN__ : undefined;
    if (doScriptInline) {
        // Não deixamos o token pendurado no objeto global depois de lido.
        delete window.__VP_SSO_TOKEN__;
        return doScriptInline;
    }
    return limparDaURL();
}

/**
 * Token de SSO desta visita, ou null se o usuário não chegou pelo portal.
 * Capturado uma única vez, no carregamento do módulo — a URL já foi limpa
 * neste ponto, então não tente reler de `window.location`.
 */
export const ssoToken: string | null = capturar();

/** True quando esta visita veio do portal com um token (válido ou não). */
export const veioDoPortal: boolean = ssoToken !== null;
