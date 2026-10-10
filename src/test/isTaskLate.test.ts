import { describe, it, expect } from "vitest";
import { isTaskLate } from "../lib/taskService";

// Regressão: o filtro/badge "Atrasadas" da Tabela e do Kanban só excluíam
// status "concluído", enquanto o card "Atrasadas" do Dashboard (SQL
// get_dashboard_summary) também exclui cancelado/reprovado e
// aguardando/bloqueado — resultado: ~660 tarefas nessa situação com prazo
// vencido apareciam como atrasadas na Tabela/Kanban mas não no Dashboard.
// isTaskLate é a classificação única que as três telas agora compartilham.
describe("isTaskLate", () => {
  const YESTERDAY = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const TOMORROW = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  it("is late when past due and status is a normal in-progress one", () => {
    expect(isTaskLate({ status: "Em Andamento", dueDate: YESTERDAY })).toBe(true);
  });

  it("is not late when done, even with a past due date", () => {
    expect(isTaskLate({ status: "Concluído", dueDate: YESTERDAY })).toBe(false);
  });

  it("is not late when cancelled, even with a past due date", () => {
    expect(isTaskLate({ status: "Cancelado", dueDate: YESTERDAY })).toBe(false);
  });

  it("is not late when reproved, even with a past due date", () => {
    expect(isTaskLate({ status: "Reprovado", dueDate: YESTERDAY })).toBe(false);
  });

  it("is not late when blocked/waiting, even with a past due date", () => {
    expect(isTaskLate({ status: "Aguardando aprovação", dueDate: YESTERDAY })).toBe(false);
  });

  it("is not late without a due date", () => {
    expect(isTaskLate({ status: "Em Andamento" })).toBe(false);
  });

  it("is not late when the due date hasn't arrived yet", () => {
    expect(isTaskLate({ status: "Em Andamento", dueDate: TOMORROW })).toBe(false);
  });

  it("is not late when the start date is still in the future, even past due", () => {
    expect(isTaskLate({ status: "A Fazer", dueDate: YESTERDAY, startDate: TOMORROW })).toBe(false);
  });
});
