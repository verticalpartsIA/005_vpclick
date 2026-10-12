import { describe, it, expect } from 'vitest';
import { queryFailed, failedLabels, type SettledQuery } from '../lib/queryResults';

const ok: SettledQuery = { status: 'fulfilled', value: { data: [], error: null } };
const rpcError: SettledQuery = { status: 'fulfilled', value: { data: null, error: { message: 'statement timeout' } } };
const rejected: SettledQuery = { status: 'rejected', reason: new Error('network') };

describe('queryFailed', () => {
  it('trata resposta com data vazia e sem erro como sucesso', () => {
    expect(queryFailed(ok)).toBe(false);
  });
  it('trata erro do PostgREST (fulfilled com error) como falha', () => {
    expect(queryFailed(rpcError)).toBe(true);
  });
  it('trata rejeição como falha', () => {
    expect(queryFailed(rejected)).toBe(true);
  });
});

describe('failedLabels', () => {
  it('devolve só os rótulos das consultas que falharam', () => {
    expect(failedLabels([ok, rpcError, rejected], ['a', 'b', 'c'])).toEqual(['b', 'c']);
  });
});
