import { describe, it, expect } from 'vitest';
import { isDoneLikeStatus, resolveDefaultStatus } from '../lib/taskService';
import { List, StatusGroup } from '../types';

describe('isDoneLikeStatus', () => {
  it('reconhece variações de "concluído/fechado"', () => {
    ['Concluído', 'CONCLUÍDA', 'Aprovado', 'Done', 'Closed', 'Finalizado', 'Pronto', 'Completed']
      .forEach((s) => expect(isDoneLikeStatus(s)).toBe(true));
  });

  it('não marca status abertos', () => {
    // Nota: "Completo" (PT) NÃO conta como concluído — o keyword é "complete"
    // (inglês). Comportamento pré-existente, documentado aqui de propósito.
    ['A fazer', 'Em andamento', 'Revisão', 'Bloqueado', 'Backlog', 'Completo']
      .forEach((s) => expect(isDoneLikeStatus(s)).toBe(false));
  });
});

describe('resolveDefaultStatus', () => {
  const statusGroups = [
    { id: 'g1', name: 'Padrão', options: [{ label: 'Backlog' }, { label: 'Fazendo' }] },
  ] as unknown as StatusGroup[];
  const lists = [{ id: 'l1', name: 'Lista', folderId: 'f1', statusGroupId: 'g1' }] as List[];

  it('usa o primeiro option do grupo de status da lista', () => {
    expect(resolveDefaultStatus('l1', lists, statusGroups)).toBe('Backlog');
  });

  it('cai para "A fazer" quando não há lista', () => {
    expect(resolveDefaultStatus(null, lists, statusGroups)).toBe('A fazer');
    expect(resolveDefaultStatus(undefined, lists, statusGroups)).toBe('A fazer');
  });

  it('cai para "A fazer" quando a lista não existe', () => {
    expect(resolveDefaultStatus('inexistente', lists, statusGroups)).toBe('A fazer');
  });

  it('cai para "A fazer" quando o grupo não tem options', () => {
    const semOptions = [{ id: 'g1', name: 'Padrão', options: [] }] as unknown as StatusGroup[];
    expect(resolveDefaultStatus('l1', lists, semOptions)).toBe('A fazer');
  });
});
