// Resultado de uma consulta do supabase-js dentro de Promise.allSettled.
// O cliente NÃO rejeita em erro de PostgREST (401, 500, timeout de statement):
// ele resolve com `{ data: null, error }`. Olhar só `status === 'rejected'`
// deixava essas falhas passarem como "0 linhas", e a tela mostrava pasta vazia.
export type SettledQuery = PromiseSettledResult<{ data: unknown; error?: unknown }>;

export function queryFailed(result: SettledQuery): boolean {
  if (result.status === 'rejected') return true;
  return !!result.value?.error;
}

export function failedLabels(results: SettledQuery[], labels: string[]): string[] {
  return results.flatMap((r, i) => (queryFailed(r) ? [labels[i] ?? `#${i}`] : []));
}
