// Achado real (2026-10): usuário se afasta da aba, volta, clica numa tarefa e
// NADA acontece — sem erro, sem aviso, sem toast. Causa: o navegador suspende
// conexões de rede de abas em segundo plano (mais comum: a renovação
// automática do token do Supabase, que expira a cada 1h e tenta se renovar
// sozinha mesmo com a aba escondida). Isso pode deixar o processLock do
// supabase-js preso (ver lockTimeout.ts) ou a sessão num estado inconsistente.
//
// O app já tem mitigação REATIVA — um teto de ~20-25s que força um erro
// quando ALGO tenta usar essa trava (ver lockTimeout.ts/supabase.ts) — mas
// nada PROATIVO: o usuário só descobre que quebrou ao tentar usar a tela
// (clicar numa tarefa), e só depois de esperar o teto inteiro, sem nenhum
// aviso visível nesse meio tempo. Um clique que não faz nada por 20s parece
// "o site não responde", não "espera, está corrigindo sozinho".
//
// Primeira versão escutava só `visibilitychange` (document.hidden/visible) —
// mas isso só dispara quando a ABA é trocada ou minimizada. O relato real que
// expôs essa lacuna: usuário alternando entre o navegador (com o VP Click na
// aba ativa, janela aberta, nada cobrindo) e outra janela/app (ex.: este
// próprio chat) — a janela do navegador PERDE O FOCO do sistema operacional,
// mas a aba continua "visível" pela Page Visibility API (não foi trocada nem
// minimizada), então `visibilitychange` nunca disparava e a recuperação nunca
// rodava, mesmo com o mesmo travamento acontecendo. `blur`/`focus` (foco da
// JANELA, não da aba) cobre exatamente esse caso. Trata os dois sinais juntos
// — "sumiu" é visibilitychange=hidden OU blur da janela; "voltou" é
// visibilitychange=visible OU focus da janela — porque não dá pra saber de
// antemão qual delas o navegador do usuário vai realmente disparar.
//
// Esta função detecta a volta (por qualquer um dos dois sinais) depois de
// tempo suficiente ausente pra esse problema ser plausível, e tenta se
// recuperar ANTES que o usuário interaja com qualquer coisa:
//   1. Pede uma sessão fresca ao Supabase. Se a sessão/trava estiver
//      saudável, isso só confirma e não causa nada visível pro usuário.
//   2. Se isso também travar (confirma que a trava está presa de verdade) ou
//      falhar, recarrega a página inteira — resolve garantidamente (é
//      exatamente o que o F5 manual já resolve hoje), só que automático e
//      ANTES que o usuário perceba o problema.
import { supabase } from './supabase';

const AWAY_THRESHOLD_MS = 60_000; // tempo mínimo ausente pra valer a pena checar — evita disparar à toa numa troca rápida de aba/janela
const RECOVERY_CHECK_TIMEOUT_MS = 8_000; // bem menor que os 20-25s das travas internas — não faz sentido esperar o teto inteiro só pra decidir se recarrega

export function startBackgroundTabRecovery(): () => void {
  let awaySince: number | null = null;
  let recovering = false; // evita checar 2x se visibilitychange e focus dispararem quase juntos pro mesmo retorno

  const markAway = () => {
    if (awaySince === null) awaySince = Date.now();
  };

  const checkRecovery = () => {
    if (awaySince === null || recovering) return;
    const awayDurationMs = Date.now() - awaySince;
    awaySince = null;
    if (awayDurationMs < AWAY_THRESHOLD_MS) return;

    recovering = true;
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      recovering = false;
      console.warn(
        `backgroundTabRecovery: sessão não respondeu em ${RECOVERY_CHECK_TIMEOUT_MS}ms após ` +
        `${Math.round(awayDurationMs / 1000)}s ausente — recarregando a página.`
      );
      window.location.reload();
    }, RECOVERY_CHECK_TIMEOUT_MS);

    supabase.auth.getSession().then(
      ({ error }) => {
        if (settled) return;
        settled = true;
        recovering = false;
        clearTimeout(timer);
        // getSession() não rejeita por sessão quebrada (ex.: refresh token
        // inválido depois de muito tempo ausente) — ela RESOLVE normalmente
        // com `error` preenchido dentro da resposta (mesmo formato que
        // checkSession em App.tsx já trata). Tratar qualquer resolução como
        // "saudável" sem olhar pra esse campo deixava passar esse caso: a
        // trava nem chegou a travar, mas a sessão em si está morta, e o
        // usuário continuaria preso sem recuperação nenhuma.
        if (error) {
          console.warn('backgroundTabRecovery: getSession() voltou com erro ao retomar — recarregando a página.', error);
          window.location.reload();
        }
      },
      () => {
        if (settled) return;
        settled = true;
        recovering = false;
        clearTimeout(timer);
        console.warn('backgroundTabRecovery: getSession() falhou ao retomar — recarregando a página.');
        window.location.reload();
      }
    );
  };

  const onVisibilityChange = () => {
    if (document.visibilityState === 'hidden') markAway();
    else if (document.visibilityState === 'visible') checkRecovery();
  };
  const onBlur = () => markAway();
  const onFocus = () => checkRecovery();

  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('blur', onBlur);
  window.addEventListener('focus', onFocus);

  return () => {
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('blur', onBlur);
    window.removeEventListener('focus', onFocus);
  };
}
