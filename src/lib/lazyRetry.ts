// Depois de um deploy, o build antigo é trocado atomicamente pelo novo (ver
// .github/workflows/deploy.yml) — um chunk lazy com hash do build anterior
// sobrevive só mais um ciclo de deploy inteiro (fica em public_html_prev),
// não pra sempre. Uma aba aberta há muito tempo que só então navega pra uma
// view carregada sob demanda pode pedir um chunk que já não existe mais no
// servidor (404), e sem isto o import rejeitado subia até o ErrorBoundary de
// topo — toda a UI cai por causa de UM chunk desatualizado, quando o build
// mais recente (que o navegador ainda não tem) resolveria sozinho.
//
// Envolve o import() dinâmico: se ele falhar, recarrega a página UMA vez
// (o index.html novo aponta pros hashes corretos do build atual) em vez de
// deixar o erro subir. Uma flag em sessionStorage evita loop infinito se o
// reload não resolver (ex.: chunk genuinamente quebrado, rede fora) — nesse
// caso a segunda falha cai no ErrorBoundary normalmente.
const RELOAD_FLAG_KEY = 'vp-click-chunk-reload';

export function lazyImportWithReload<T>(factory: () => Promise<T>): () => Promise<T> {
  return () =>
    factory().catch((err) => {
      try {
        if (!sessionStorage.getItem(RELOAD_FLAG_KEY)) {
          sessionStorage.setItem(RELOAD_FLAG_KEY, '1');
          window.location.reload();
          return new Promise<T>(() => {}); // a página já está recarregando; nunca resolve
        }
      } catch {
        // sessionStorage indisponível (modo privado, quota etc.) — segue pro throw abaixo.
      }
      throw err;
    });
}

/**
 * Chamado depois que o app monta com sucesso, pra liberar um novo reload
 * automático caso um chunk de um deploy FUTURO também fique stale nesta
 * mesma aba (sessionStorage sobrevive ao reload que acabamos de disparar).
 */
export function clearChunkReloadFlag() {
  try {
    sessionStorage.removeItem(RELOAD_FLAG_KEY);
  } catch {
    // sessionStorage indisponível (modo privado, quota etc.) — não é crítico.
  }
}
