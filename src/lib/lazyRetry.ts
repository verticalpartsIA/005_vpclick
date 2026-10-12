import { reportRecoverableProblem } from './recoveryNotice';

// Depois de um deploy, o build antigo é trocado atomicamente pelo novo (ver
// .github/workflows/deploy.yml) — um chunk lazy com hash do build anterior
// sobrevive só mais um ciclo de deploy inteiro (fica em public_html_prev),
// não pra sempre. Uma aba aberta há muito tempo que só então navega pra uma
// view carregada sob demanda pode pedir um chunk que já não existe mais no
// servidor (404), e sem isto o import rejeitado subia até o ErrorBoundary de
// topo — toda a UI cai por causa de UM chunk desatualizado, quando o build
// mais recente (que o navegador ainda não tem) resolveria sozinho.
//
// Envolve o import() dinâmico: se ele falhar, (antes) recarregava a página UMA vez
// (o index.html novo aponta pros hashes corretos do build atual) em vez de
// deixar o erro subir. Uma flag em sessionStorage evita loop infinito se o
// reload não resolver (ex.: chunk genuinamente quebrado, rede fora) — nesse
// caso a segunda falha cai no ErrorBoundary normalmente.
// ATUALIZAÇÃO: não recarrega mais sozinho (derrubava o que o usuário digitava).
// Avisa pelo banner (recoveryNotice.ts) e deixa o erro seguir; o usuário decide.
export function lazyImportWithReload<T>(factory: () => Promise<T>): () => Promise<T> {
  return () =>
    factory().catch((err) => {
      reportRecoverableProblem('uma tela não carregou porque o site foi atualizado');
      throw err;
    });
}
