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
// Esta função detecta quando a aba volta a ficar visível depois de tempo
// suficiente em segundo plano pra esse problema ser plausível, e tenta se
// recuperar ANTES que o usuário interaja com qualquer coisa:
//   1. Pede uma sessão fresca ao Supabase. Se a sessão/trava estiver
//      saudável, isso só confirma e não causa nada visível pro usuário.
//   2. Se isso também travar (confirma que a trava está presa de verdade) ou
//      falhar, recarrega a página inteira — resolve garantidamente (é
//      exatamente o que o F5 manual já resolve hoje), só que automático e
//      ANTES que o usuário perceba o problema.
import { supabase } from './supabase';

const HIDDEN_THRESHOLD_MS = 60_000; // tempo mínimo escondida pra valer a pena checar — evita disparar à toa quando o usuário só troca de aba rapidamente
const RECOVERY_CHECK_TIMEOUT_MS = 8_000; // bem menor que os 20-25s das travas internas — não faz sentido esperar o teto inteiro só pra decidir se recarrega

export function startBackgroundTabRecovery(): () => void {
  let hiddenAt: number | null = null;

  const onVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      hiddenAt = Date.now();
      return;
    }
    if (document.visibilityState !== 'visible' || hiddenAt === null) return;

    const hiddenDurationMs = Date.now() - hiddenAt;
    hiddenAt = null;
    if (hiddenDurationMs < HIDDEN_THRESHOLD_MS) return;

    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      console.warn(
        `backgroundTabRecovery: sessão não respondeu em ${RECOVERY_CHECK_TIMEOUT_MS}ms após ` +
        `${Math.round(hiddenDurationMs / 1000)}s em segundo plano — recarregando a página.`
      );
      window.location.reload();
    }, RECOVERY_CHECK_TIMEOUT_MS);

    supabase.auth.getSession().then(
      () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
      },
      () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        console.warn('backgroundTabRecovery: getSession() falhou ao retomar a aba — recarregando a página.');
        window.location.reload();
      }
    );
  };

  document.addEventListener('visibilitychange', onVisibilityChange);
  return () => document.removeEventListener('visibilitychange', onVisibilityChange);
}
