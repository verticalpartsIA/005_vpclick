import { describe, it, expect } from 'vitest';
import { buildRecurrenceRuleInput, defaultRecurrenceForm, toDatetimeLocalValue } from '../App';
import type { TaskRecurrenceRule } from '../types';

// Regra "em andamento" de teste: começou há 3 meses, já avançou (nextRunAt
// != startAt) e já gerou ocorrências — usada nos testes de edição abaixo
// pra provar que editar não rebobina o agendamento (achado real corrigido
// nesta mesma mudança).
function ongoingRule(overrides: Partial<TaskRecurrenceRule> = {}): TaskRecurrenceRule {
  return {
    id: 'rule-1', taskId: 'task-1', listId: 'list-1', enabled: true,
    frequencyType: 'weekly', interval: 1, weekdays: [1],
    startAt: '2026-06-15T09:00:00.000Z',
    nextRunAt: '2026-09-14T09:00:00.000Z',
    timezone: 'America/Sao_Paulo',
    triggerMode: 'on_schedule', createNewTask: true,
    skipWeekends: false, skipHolidays: false, weekendShift: 'next_business_day',
    endMode: 'forever',
    inheritOptions: {
      includeDescription: true, includePriority: true, includeAssignees: true, includeTags: true,
      includeSubtasks: false, remapSubtaskDates: true, includeChecklists: false, includeChecklistCheckedState: false,
      includeCustomFields: false, includeWatchers: false,
    } as TaskRecurrenceRule['inheritOptions'],
    overlapPolicy: 'create_and_flag', misfirePolicy: 'create_latest_only',
    occurrencesCreated: 13, createdAt: '2026-06-15T09:00:00.000Z', updatedAt: '2026-09-14T09:00:00.000Z',
    ...overrides,
  } as TaskRecurrenceRule;
}

// Cobre a "configuração da recorrência pela UI" (issue #184 seção 30) sem
// Cypress (não usado no projeto) — testa a função pura que valida o
// formulário e monta o payload, extraída do RecurrenceConfigModal.
describe('buildRecurrenceRuleInput', () => {
  it('rejeita frequência semanal sem nenhum dia selecionado', () => {
    const form = { ...defaultRecurrenceForm(null), frequencyType: 'weekly' as const, weekdays: [] };
    const result = buildRecurrenceRuleInput(form);
    expect('error' in result).toBe(true);
  });

  it('rejeita data de início inválida', () => {
    const form = { ...defaultRecurrenceForm(null), startAt: 'não-é-uma-data' };
    const result = buildRecurrenceRuleInput(form);
    expect('error' in result).toBe(true);
  });

  it('monta o payload semanal corretamente', () => {
    const form = { ...defaultRecurrenceForm(null), frequencyType: 'weekly' as const, weekdays: [1, 3, 5], interval: 2 };
    const result = buildRecurrenceRuleInput(form);
    if ('error' in result) throw new Error('esperava sucesso: ' + result.error);
    expect(result.input.frequencyType).toBe('weekly');
    expect(result.input.weekdays).toEqual([1, 3, 5]);
    expect(result.input.interval).toBe(2);
    expect(result.input.monthDay).toBeNull();
    // nextRunAt = startAt exato (a primeira ocorrência não passa pelo shift)
    expect(result.input.nextRunAt).toBe(result.input.startAt);
  });

  it('monta o payload mensal por dia fixo e ignora enésimo-dia-da-semana', () => {
    const form = { ...defaultRecurrenceForm(null), frequencyType: 'monthly' as const, monthMode: 'day' as const, monthDay: 15, monthWeek: 2, monthWeekday: 3 };
    const result = buildRecurrenceRuleInput(form);
    if ('error' in result) throw new Error('esperava sucesso: ' + result.error);
    expect(result.input.monthDay).toBe(15);
    expect(result.input.monthWeek).toBeNull();
    expect(result.input.monthWeekday).toBeNull();
    expect(result.input.weekdays).toEqual([]);
  });

  it('monta o payload mensal por enésimo-dia-da-semana e ignora dia fixo', () => {
    const form = { ...defaultRecurrenceForm(null), frequencyType: 'monthly' as const, monthMode: 'nth' as const, monthDay: 15, monthWeek: 5, monthWeekday: 1 };
    const result = buildRecurrenceRuleInput(form);
    if ('error' in result) throw new Error('esperava sucesso: ' + result.error);
    expect(result.input.monthDay).toBeNull();
    expect(result.input.monthWeek).toBe(5);
    expect(result.input.monthWeekday).toBe(1);
  });

  it('endMode=count exige maxOccurrences e ignora endAt', () => {
    const form = { ...defaultRecurrenceForm(null), endMode: 'count' as const, maxOccurrences: 7, endAt: '2030-01-01' };
    const result = buildRecurrenceRuleInput(form);
    if ('error' in result) throw new Error('esperava sucesso: ' + result.error);
    expect(result.input.maxOccurrences).toBe(7);
    expect(result.input.endAt).toBeNull();
  });

  it('endMode=until exige endAt e ignora maxOccurrences', () => {
    const form = { ...defaultRecurrenceForm(null), endMode: 'until' as const, endAt: '2030-06-15', maxOccurrences: 99 };
    const result = buildRecurrenceRuleInput(form);
    if ('error' in result) throw new Error('esperava sucesso: ' + result.error);
    expect(result.input.maxOccurrences).toBeNull();
    // new Date('YYYY-MM-DDTHH:mm:ss') sem 'Z' é interpretado no fuso LOCAL da
    // máquina — comparar contra o mesmo parse evita depender do fuso do
    // runner (CI pode rodar em UTC, dev local pode não).
    expect(result.input.endAt).toBe(new Date('2030-06-15T23:59:59').toISOString());
  });

  it('endMode=forever não define nem endAt nem maxOccurrences', () => {
    const form = { ...defaultRecurrenceForm(null), endMode: 'forever' as const };
    const result = buildRecurrenceRuleInput(form);
    if ('error' in result) throw new Error('esperava sucesso: ' + result.error);
    expect(result.input.endAt).toBeNull();
    expect(result.input.maxOccurrences).toBeNull();
  });

  it('interval mínimo é sempre 1, mesmo com valor inválido no form', () => {
    const form = { ...defaultRecurrenceForm(null), interval: 0 };
    const result = buildRecurrenceRuleInput(form);
    if ('error' in result) throw new Error('esperava sucesso: ' + result.error);
    expect(result.input.interval).toBe(1);
  });

  it('achado real: editar uma regra em andamento sem mudar a data preserva o nextRunAt (não rebobina pro startAt original)', () => {
    const rule = ongoingRule();
    const form = { ...defaultRecurrenceForm(null), startAt: toDatetimeLocalValue(new Date(rule.startAt)), misfirePolicy: 'skip_past' as const };
    const result = buildRecurrenceRuleInput(form, rule);
    if ('error' in result) throw new Error('esperava sucesso: ' + result.error);
    expect(result.input.startAt).toBe(rule.startAt);
    expect(result.input.nextRunAt).toBe(rule.nextRunAt);
    expect(result.input.misfirePolicy).toBe('skip_past');
  });

  it('editar a data de início de uma regra em andamento recalcula o nextRunAt a partir da nova data', () => {
    const rule = ongoingRule();
    const newStart = new Date('2027-01-10T09:00:00.000Z');
    const form = { ...defaultRecurrenceForm(null), startAt: toDatetimeLocalValue(newStart) };
    const result = buildRecurrenceRuleInput(form, rule);
    if ('error' in result) throw new Error('esperava sucesso: ' + result.error);
    expect(result.input.startAt).toBe(newStart.toISOString());
    expect(result.input.nextRunAt).toBe(newStart.toISOString());
  });

  it('criar uma regra nova (sem existingRule) sempre usa nextRunAt = startAt', () => {
    const form = { ...defaultRecurrenceForm(null) };
    const result = buildRecurrenceRuleInput(form, null);
    if ('error' in result) throw new Error('esperava sucesso: ' + result.error);
    expect(result.input.nextRunAt).toBe(result.input.startAt);
  });

  it('repassa skipWeekends/skipHolidays/weekendShift e inheritOptions como estão no form', () => {
    const form = {
      ...defaultRecurrenceForm(null),
      skipWeekends: true,
      skipHolidays: true,
      weekendShift: 'previous_business_day' as const,
      inheritOptions: { includeDescription: true, includeSubtasks: true, remapSubtaskDates: false },
    };
    const result = buildRecurrenceRuleInput(form);
    if ('error' in result) throw new Error('esperava sucesso: ' + result.error);
    expect(result.input.skipWeekends).toBe(true);
    expect(result.input.skipHolidays).toBe(true);
    expect(result.input.weekendShift).toBe('previous_business_day');
    expect(result.input.inheritOptions).toEqual(form.inheritOptions);
  });
});
