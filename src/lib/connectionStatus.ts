// Aviso visual pra trava de ~25s do lock de auth (ver lockTimeout.ts). A causa
// raiz: TODA chamada ao Supabase passa por getSession() antes de disparar o
// fetch, e todas essas chamadas compartilham uma fila só por aba — se uma
// renovação de token cair numa rede instável, a fila inteira fica pendurada
// até o teto de 25s liberar à força. Isso já evita travar pra sempre, mas a
// tela fica muda nesse meio tempo, o que o usuário relatou como "trava, não
// acontece nada". Aqui só rastreamos SE algum fetch está demorando mais do
// que o normal, pra App.tsx poder mostrar um toast — não muda o timeout em
// si (ver supabase.ts).
const SLOW_THRESHOLD_MS = 3_500;

let slowCount = 0;
const listeners = new Set<(isSlow: boolean) => void>();

function notify() {
  const isSlow = slowCount > 0;
  listeners.forEach((cb) => cb(isSlow));
}

export function subscribeSlowConnection(cb: (isSlow: boolean) => void): () => void {
  listeners.add(cb);
  cb(slowCount > 0);
  return () => listeners.delete(cb);
}

// Chamado por supabase.ts ao redor de cada fetch — não usar em outro lugar.
export function trackRequestForSlowness<T>(promise: Promise<T>): Promise<T> {
  let flaggedSlow = false;
  const timer = setTimeout(() => {
    flaggedSlow = true;
    slowCount += 1;
    notify();
  }, SLOW_THRESHOLD_MS);

  const clear = () => {
    clearTimeout(timer);
    if (flaggedSlow) {
      slowCount = Math.max(0, slowCount - 1);
      notify();
    }
  };

  promise.then(clear, clear);
  return promise;
}
