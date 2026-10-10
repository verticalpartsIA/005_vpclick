import { describe, it, expect } from 'vitest';
import { writeRows, writeOk } from '../lib/dbWrite';

// Achado real (2026-10): um UPDATE barrado pelo `with check` de uma policy de
// RLS volta `error: null` com ZERO linhas afetadas — sem `.select()`, o
// código não tinha como distinguir isso de um sucesso de verdade, e a UI
// mostrava "salvo" até o próximo refetch reverter a mudança. writeRows/writeOk
// existem pra fechar esse buraco em todo write do app, não só nos 4 pontos já
// corrigidos manualmente (updateTaskFields, handleStatusChange,
// handleQuickUpdateTask, handleUpdateFieldValue).

function fakeBuilder<T>(data: T[] | null, error: { message: string } | null = null) {
  return { select: async (_columns?: string) => ({ data, error }) };
}

describe('writeRows', () => {
  it('reports success with the returned rows when at least one row comes back', async () => {
    const res = await writeRows(fakeBuilder([{ id: 'task-1' }]));
    expect(res).toEqual({ ok: true, rows: [{ id: 'task-1' }] });
  });

  it('reports a real Postgres/PostgREST error as reason "error"', async () => {
    const res = await writeRows(fakeBuilder(null, { message: 'column "foo" does not exist' }));
    expect(res).toEqual({ ok: false, reason: 'error', message: 'column "foo" does not exist' });
  });

  it('treats an empty array (no error) as denied, not as success — the RLS silent-block case', async () => {
    const res = await writeRows(fakeBuilder([]));
    expect(res.ok).toBe(false);
    // `=== false`, não `!res.ok`: ver nota em dbWrite.ts sobre narrowing de
    // union discriminado sob `strict: false` deste projeto.
    if (res.ok === false) {
      expect(res.reason).toBe('denied');
      expect(res.message).toMatch(/permissão/i);
    }
  });

  it('treats data: null (no error) the same as an empty array', async () => {
    const res = await writeRows(fakeBuilder(null));
    expect(res.ok).toBe(false);
    if (res.ok === false) expect(res.reason).toBe('denied');
  });

  it('uses a custom denied message when provided', async () => {
    const res = await writeRows(fakeBuilder([]), { deniedMessage: 'Sem acesso a esta tarefa.' });
    expect(res).toEqual({ ok: false, reason: 'denied', message: 'Sem acesso a esta tarefa.' });
  });

  it('requests the given select columns instead of the "id" default', async () => {
    let requestedColumns: string | undefined;
    const builder = {
      select: async (columns?: string) => {
        requestedColumns = columns;
        return { data: [{ entity_id: 'x' }], error: null };
      },
    };
    await writeRows(builder, { selectColumns: 'entity_id' });
    expect(requestedColumns).toBe('entity_id');
  });
});

describe('writeOk', () => {
  it('collapses a successful write down to { ok: true }, dropping the rows', async () => {
    const res = await writeOk(fakeBuilder([{ id: 'task-1' }]));
    expect(res).toEqual({ ok: true });
  });

  it('passes a denied write through unchanged', async () => {
    const res = await writeOk(fakeBuilder([]), { deniedMessage: 'Sem permissão.' });
    expect(res).toEqual({ ok: false, reason: 'denied', message: 'Sem permissão.' });
  });

  it('passes a real error through unchanged', async () => {
    const res = await writeOk(fakeBuilder(null, { message: 'boom' }));
    expect(res).toEqual({ ok: false, reason: 'error', message: 'boom' });
  });
});
