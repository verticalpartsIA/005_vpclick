import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { Icons } from "../constants";

// Guarda contra a classe de bug do React #130 "Element type is invalid ... got:
// undefined": `Icons` (src/constants.tsx) é um conjunto CURADO de ícones, não o
// lucide-react. Referenciar `Icons.NomeInexistente` compila no tsc (o objeto tem
// index signature frouxo) mas em runtime é `undefined` e renderizar
// `<undefined/>` derruba a tela inteira (ErrorBoundary). Este teste varre o
// código e falha se algum `Icons.X` estático não existir no objeto real.
function collectTsx(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "test") continue;
      collectTsx(full, acc);
    } else if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) {
      acc.push(full);
    }
  }
  return acc;
}

describe("Icons references exist at runtime", () => {
  it("every static Icons.<Name> in src/ resolves to a defined icon", () => {
    const defined = new Set(Object.keys(Icons));
    const files = collectTsx(join(process.cwd(), "src"));
    const offenders: string[] = [];

    for (const file of files) {
      const src = readFileSync(file, "utf8");
      // Só arquivos que importam Icons de constants usam este objeto.
      if (!/import\s*\{[^}]*\bIcons\b[^}]*\}\s*from\s*['"][^'"]*constants['"]/.test(src)) continue;
      const re = /\bIcons\.([A-Z][A-Za-z0-9]*)/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(src))) {
        if (!defined.has(m[1])) offenders.push(`${file.replace(process.cwd(), "")} → Icons.${m[1]}`);
      }
    }

    expect(offenders, `Ícones inexistentes (renderizam <undefined/> → React #130):\n${offenders.join("\n")}`).toEqual([]);
  });
});
