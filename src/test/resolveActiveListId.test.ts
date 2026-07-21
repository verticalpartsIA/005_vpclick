import { describe, it, expect } from "vitest";
import { resolveActiveListId } from "../App";

// Regressão: o modal "Gerenciar Campos Personalizados" usava o `activeListId`
// bruto (null ao navegar por pasta/espaço) enquanto a tabela (ListView) já
// resolvia a lista real quando havia só uma nas tarefas exibidas. Isso fazia
// os toggles de mostrar/ocultar campo do modal gravarem numa chave diferente
// da que a tabela lê, dando a impressão de que não tinham efeito nenhum.
describe("resolveActiveListId", () => {
  it("uses the explicit list id when one is selected", () => {
    expect(resolveActiveListId("list-1", [{ listId: "list-2" }])).toBe("list-1");
  });

  it("falls back to the single list present in the visible tasks (folder/space scope)", () => {
    expect(
      resolveActiveListId(null, [{ listId: "list-1" }, { listId: "list-1" }]),
    ).toBe("list-1");
  });

  it("returns null when there is no explicit list and tasks span multiple lists", () => {
    expect(
      resolveActiveListId(null, [{ listId: "list-1" }, { listId: "list-2" }]),
    ).toBeNull();
  });

  it("returns null when there is no explicit list and no tasks are visible", () => {
    expect(resolveActiveListId(null, [])).toBeNull();
  });

  it("agrees with itself across two independent call sites given the same inputs (ListView vs CustomFieldsManager)", () => {
    const tasks = [{ listId: "list-1" }, { listId: "list-1" }];
    const fromListView = resolveActiveListId(null, tasks);
    const fromFieldManager = resolveActiveListId(null, tasks);
    expect(fromListView).toBe(fromFieldManager);
    expect(fromListView).toBe("list-1");
  });
});
