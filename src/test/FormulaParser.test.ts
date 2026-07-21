import { describe, it, expect } from "vitest";
import { FormulaParser } from "../lib/FormulaParser";

describe("FormulaParser", () => {
  it("evaluates a formula referencing other fields by name", () => {
    const result = FormulaParser.evaluate("{{Preço}} * {{Quantidade}}", { Preço: 10, Quantidade: 3 });
    expect(result).toBe(30);
  });

  it("treats a missing/non-numeric referenced field as 0", () => {
    const result = FormulaParser.evaluate("{{NaoExiste}} + 5", {});
    expect(result).toBe(5);
  });

  it("returns 0 for a blank formula", () => {
    expect(FormulaParser.evaluate("", {})).toBe(0);
  });

  it("returns 'Error' for an invalid expression instead of throwing", () => {
    expect(FormulaParser.evaluate("{{A}} +* 1", { A: 1 })).toBe("Error");
  });
});
