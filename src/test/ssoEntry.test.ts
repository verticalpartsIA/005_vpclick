import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

// A entrada no VP Click é sempre pelo portal (vpsistema), e o token de acesso
// chega na URL. Duas coisas dependem da lógica coberta aqui:
//
// 1. O token sai da barra de endereço antes do app montar. Antes ele era
//    limpo num useEffect do React — com o bundle acima de 1 MB, o endereço com
//    o token gigante ficava à vista durante todo o carregamento, e vazava pro
//    histórico do navegador e pro cabeçalho Referer.
// 2. Ao limpar, os outros parâmetros são preservados. A limpeza antiga
//    reconstruía a URL só com origin + pathname, então um link direto pra
//    tarefa (`?taskId=...`) chegando junto com o token perdia o taskId e a
//    tarefa não abria.
//
// O módulo captura o token no carregamento (efeito de import), então cada teste
// precisa reconfigurar o ambiente e reimportar via vi.resetModules().
async function carregarModulo() {
  vi.resetModules();
  return import("../lib/ssoEntry");
}

// Caminhos relativos: o jsdom recusa replaceState que troque de origem, e o
// que está sob teste é a manipulação de query string, não o host.
const HREF_BASE = "/";

function prepararURL(href: string) {
  window.history.replaceState({}, "", href);
}

describe("ssoEntry", () => {
  beforeEach(() => {
    prepararURL(HREF_BASE);
    delete window.__VP_SSO_TOKEN__;
  });

  afterEach(() => {
    delete window.__VP_SSO_TOKEN__;
  });

  it("lê o token que o script inline do index.html deixou e o remove do global", async () => {
    window.__VP_SSO_TOKEN__ = "token-do-inline";

    const { ssoToken, veioDoPortal } = await carregarModulo();

    expect(ssoToken).toBe("token-do-inline");
    expect(veioDoPortal).toBe(true);
    // Não deixa o token pendurado em window depois de lido.
    expect(window.__VP_SSO_TOKEN__).toBeUndefined();
  });

  it("cai pro fallback e lê da URL quando o script inline não rodou", async () => {
    prepararURL(`?sso_token=token-da-url`);

    const { ssoToken, veioDoPortal } = await carregarModulo();

    expect(ssoToken).toBe("token-da-url");
    expect(veioDoPortal).toBe(true);
  });

  it("remove o token da URL no fallback", async () => {
    prepararURL(`?sso_token=segredo`);

    await carregarModulo();

    expect(window.location.search).not.toContain("sso_token");
    expect(window.location.href).not.toContain("segredo");
  });

  it("preserva os outros parâmetros ao limpar (regressão do taskId perdido)", async () => {
    prepararURL(`?sso_token=segredo&taskId=abc-123`);

    await carregarModulo();

    const params = new URLSearchParams(window.location.search);
    expect(params.get("sso_token")).toBeNull();
    expect(params.get("taskId")).toBe("abc-123");
  });

  it("reporta que não veio do portal quando não há token em lugar nenhum", async () => {
    const { ssoToken, veioDoPortal } = await carregarModulo();

    expect(ssoToken).toBeNull();
    expect(veioDoPortal).toBe(false);
  });

  it("prefere o token do script inline ao da URL quando os dois existem", async () => {
    window.__VP_SSO_TOKEN__ = "do-inline";
    prepararURL(`?sso_token=da-url`);

    const { ssoToken } = await carregarModulo();

    expect(ssoToken).toBe("do-inline");
  });
});
