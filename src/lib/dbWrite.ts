// Wrapper fino em volta de UPDATE/INSERT/UPSERT/DELETE do Supabase que fecha
// uma classe inteira de bug encontrada e corrigida em vários pontos do app
// (updateTaskFields em taskRepo.ts; handleStatusChange, handleQuickUpdateTask
// e handleUpdateFieldValue em App.tsx): sem `.select()`, um UPDATE barrado
// pelo `with check` de uma policy de RLS volta `error: null` com ZERO linhas
// afetadas — Postgres/PostgREST não avisam disso de jeito nenhum. O código
// aplicava a mudança otimisticamente mesmo assim, então a UI mostrava "salvo"
// até o próximo refetch (realtime ou reabrir a tela) trazer de volta o valor
// antigo do banco — reportado como "status não muda"/"campo não salva"
// (achado real, 2026-10).
//
// Todo write (update/insert/upsert/delete) que o app faz deveria passar por
// aqui em vez de um `await builder` cru: o `.select()` é obrigatório (quem
// chama não tem como esquecer, porque é esta função que o adiciona) e um
// array vazio na resposta vira falha explícita, nunca sucesso silencioso.

export interface WriteDeniedResult {
  ok: false;
  // 'denied': a query rodou sem erro mas devolveu 0 linhas — RLS bloqueou, ou
  // o registro já não existe mais. Mais provável ser RLS: o `.eq('id', x)`
  // quase sempre vem de um id que a própria tela já tinha carregado.
  // 'error': o PostgREST/Postgres reportou um erro de verdade (rede, coluna
  // inválida, violação de constraint, etc.).
  reason: 'denied' | 'error';
  message: string;
}

export type WriteResult<T> = { ok: true; rows: T[] } | WriteDeniedResult;

// Achado ao escrever este wrapper: com `strict: false` (como este projeto
// roda, ver tsconfig.app.json), o TypeScript NÃO estreita esse union
// discriminado com `if (res.ok)`/`if (!res.ok)` — o `else`/o `if` continuam
// vendo o tipo inteiro e acessar `.reason`/`.message` dá erro de compilação
// (`strictNullChecks`, parte de `strict`, é o que normalmente habilita esse
// estreitamento; sem ele o narrowing de discriminante booleano simplesmente
// não acontece). Comparação explícita contra o literal funciona em qualquer
// modo: use sempre `res.ok === true` / `res.ok === false` ao ler um
// `WriteResult`/`{ok:true}|WriteDeniedResult`, nunca `if (res.ok)` cru.

// Builder mínimo aceito: qualquer coisa com um `.select()` encadeável no
// final de um update/insert/upsert/delete do supabase-js. Tipado por
// estrutura (duck typing) em vez de importar os tipos internos do
// supabase-js — esses mudam de nome entre versões e são incômodos de
// referenciar aqui só pra isso.
interface SelectableBuilder<T> {
  select(columns?: string): PromiseLike<{ data: T[] | null; error: { message: string } | null }>;
}

const DEFAULT_DENIED_MESSAGE =
  'Alteração não aplicada: você não tem permissão para isso (ou o registro foi movido/excluído).';

/**
 * Executa um update/insert/upsert/delete do Supabase e GARANTE que pelo
 * menos uma linha foi afetada antes de reportar sucesso.
 *
 * Uso — troque:
 *   const { error } = await supabase.from('tasks').update({...}).eq('id', id);
 *   if (error) ...
 * por:
 *   const res = await writeRows(supabase.from('tasks').update({...}).eq('id', id));
 *   if (!res.ok) ...
 *
 * `builder` deve ser a query JÁ COM os filtros (.eq/.in/...) mas SEM
 * `.select()` — esta função adiciona o `.select()` ela mesma.
 */
export async function writeRows<T = { id: string }>(
  builder: SelectableBuilder<T>,
  options?: { deniedMessage?: string; selectColumns?: string },
): Promise<WriteResult<T>> {
  const { data, error } = await builder.select(options?.selectColumns ?? 'id');
  if (error) return { ok: false, reason: 'error', message: error.message };
  if (!data || data.length === 0) {
    return { ok: false, reason: 'denied', message: options?.deniedMessage ?? DEFAULT_DENIED_MESSAGE };
  }
  return { ok: true, rows: data };
}

/**
 * Mesma garantia de `writeRows`, para quando só importa se deu certo (sem
 * precisar da linha de volta no chamador).
 */
export async function writeOk(
  builder: SelectableBuilder<{ id: string }>,
  options?: { deniedMessage?: string },
): Promise<{ ok: true } | WriteDeniedResult> {
  const res = await writeRows(builder, options);
  return res.ok ? { ok: true } : res;
}
