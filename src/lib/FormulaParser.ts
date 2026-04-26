/**
 * T603 — FormulaParser (mathjs edition)
 *
 * Replaces the previous `new Function()` eval-equivalent with mathjs `evaluate()`.
 * Public API is identical to the old version:
 *   FormulaParser.evaluate(formula, context) → number | string
 *
 * mathjs `evaluate()` is a sandboxed expression parser — it has no access to
 * the JS runtime, cannot import modules, and cannot execute arbitrary code.
 */

import { evaluate } from 'mathjs';

export class FormulaParser {
  static evaluate(formula: string, context: Record<string, any>): number | string {
    try {
      // Step 1 — resolve {{Field Name}} references to numeric values
      const expression = formula.replace(/\{\{(.*?)\}\}/g, (_, fieldName) => {
        const val = context[fieldName.trim()];
        return typeof val === 'number' ? val.toString() : '0';
      });

      // Step 2 — guard against blank expressions (e.g. all fields resolved to 0
      //          and the formula was just "{{NaoExiste}}" → "0" which is fine,
      //          but an empty string after trim would throw a mathjs parse error)
      const trimmed = expression.trim();
      if (!trimmed) return 0;

      // Step 3 — evaluate with mathjs (safe, no eval / new Function)
      const result = evaluate(trimmed);

      // mathjs may return a Unit or Matrix for complex expressions.
      // We only expect plain numbers from field formulas.
      if (typeof result === 'number') return result;
      if (typeof result === 'boolean') return result ? 1 : 0;
      return String(result);
    } catch (err) {
      console.error('Formula evaluation error:', err);
      return 'Error';
    }
  }
}
