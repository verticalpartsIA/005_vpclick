import { describe, it, expect } from "vitest";
import { resolveScopedTasks, taskMatchesContextFilters } from "../components/views/TableView";

// Issue #165: "Todos os contextos autorizados" e "Listas específicas" da
// Tabela dependem dessas duas funções puras pra decidir o que exibir — antes
// dessa extração, `TableView.tsx` não tinha nenhum teste automatizado
// cobrindo a lógica de agregação por escopo.
describe("resolveScopedTasks", () => {
  const scopeOptions = [
    { id: "current", taskSource: ["a", "b"] },
    { id: "all", taskSource: ["a", "b", "c", "d"] },
  ];

  it("uses the matching scope option's task source", () => {
    expect(resolveScopedTasks("all", scopeOptions, ["fallback"], [], [])).toEqual(["a", "b", "c", "d"]);
  });

  it("falls back to the given tasks when no scope option matches", () => {
    expect(resolveScopedTasks("missing", scopeOptions, ["fallback"], [], [])).toEqual(["fallback"]);
  });

  it("prefers a manual multi-list selection over the hierarchical scope, even when a scope option matches", () => {
    expect(resolveScopedTasks("current", scopeOptions, ["fallback"], ["list-1", "list-2"], ["x", "y", "z"])).toEqual(["x", "y", "z"]);
  });

  it("ignores the multi-list task source when no list is actually selected", () => {
    expect(resolveScopedTasks("current", scopeOptions, ["fallback"], [], ["stale", "data"])).toEqual(["a", "b"]);
  });
});

describe("taskMatchesContextFilters", () => {
  const context = { space: { id: "space-1" }, folder: { id: "folder-1" }, list: { id: "list-1" } };

  it("matches when no filter is set", () => {
    expect(taskMatchesContextFilters(context, {})).toBe(true);
  });

  it("matches when every set filter equals the task's context", () => {
    expect(taskMatchesContextFilters(context, { spaceId: "space-1", folderId: "folder-1", listId: "list-1" })).toBe(true);
  });

  it("rejects when the list filter points to a different list", () => {
    expect(taskMatchesContextFilters(context, { listId: "list-2" })).toBe(false);
  });

  it("rejects when the folder filter points to a different folder, even if the space matches", () => {
    expect(taskMatchesContextFilters(context, { spaceId: "space-1", folderId: "folder-2" })).toBe(false);
  });

  it("rejects when the task has no context at all but a filter is set", () => {
    expect(taskMatchesContextFilters({}, { spaceId: "space-1" })).toBe(false);
  });
});
