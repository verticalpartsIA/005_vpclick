// Política: o app NUNCA recarrega a página sozinho. Recarregar derruba o que o
// usuário está digitando (descrição de tarefa, comentário) e já foi a causa de
// reclamações de "o site reinicia sozinho". Quando algo precisa de recarga
// (sessão presa, chunk de deploy antigo), o código só AVISA por aqui e quem
// decide é a pessoa, pelo botão do banner (ver App.tsx).
export type RecoveryNotice = { reason: string };

const listeners = new Set<(notice: RecoveryNotice | null) => void>();
let current: RecoveryNotice | null = null;

export function reportRecoverableProblem(reason: string): void {
  console.warn(`recoveryNotice: ${reason} — aguardando o usuário decidir recarregar.`);
  current = { reason };
  listeners.forEach((cb) => cb(current));
}

export function dismissRecoveryNotice(): void {
  current = null;
  listeners.forEach((cb) => cb(null));
}

export function subscribeRecoveryNotice(cb: (notice: RecoveryNotice | null) => void): () => void {
  listeners.add(cb);
  cb(current);
  return () => { listeners.delete(cb); };
}
