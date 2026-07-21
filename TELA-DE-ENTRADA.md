# Tela de Entrada — Padrão VerticalParts

> **Para quem lê este arquivo (humano ou LLM):** este documento existe para que o
> mesmo padrão de "tela de entrada" implementado no VP Click seja replicado nos
> outros sistemas da VerticalParts (VP Gestão, VP Propostas, VP Requisições,
> Pós-Venda 360, vpsistema, etc.), de forma uniforme. Implemente exatamente o
> que está aqui, adaptando apenas os nomes/textos específicos do produto (a
> tagline e o nome do sistema) e a stack técnica se o projeto não usar Vite/React.
> Referência viva (código real, testado, em produção): repositório
> `verticalpartsIA/005_vpclick`, branch `main`, PRs #14, #23, #24, #25.

## O que é isto, em uma frase

Duas peças, sempre juntas: (1) uma tela de entrada com vídeo animado do logo da
VerticalParts + boas-vindas, em vez de um loading genérico; (2) um aviso
automático quando o site é atualizado, pra quem já está com uma aba aberta não
ficar rodando uma versão antiga sem saber.

---

## Parte 1 — Aviso de nova versão publicada

### Problema que resolve

A maioria dos nossos deploys é um build estático sobrescrito direto no
servidor (sem invalidação de CDN, sem versionamento de assets do lado do
servidor). Uma aba deixada aberta continua rodando o JS antigo indefinidamente
— mesmo depois de uma correção já estar em produção, quem já estava logado
não vê o efeito e ninguém tem como saber que precisa recarregar, a não ser
que alguém avise manualmente "pessoal, recarreguem o sistema".

### Como implementar (Vite + React)

**1. Gerar `dist/version.json` a cada build**, com o timestamp e o commit do
build, e embutir esse mesmo timestamp no bundle JS via `define` — é assim que
a aba já aberta sabe "de que build eu sou", sem precisar buscar nada. Em
`vite.config.ts`:

```ts
import { defineConfig, type Plugin } from "vite";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

function writeVersionFile(buildTime: string, commit: string): Plugin {
  return {
    name: "write-version-file",
    apply: "build",
    writeBundle(options) {
      const outDir = options.dir || "dist";
      fs.writeFileSync(
        path.join(outDir, "version.json"),
        JSON.stringify({ buildTime, commit }, null, 2),
      );
    },
  };
}

export default defineConfig(({ mode }) => {
  const buildTime = new Date().toISOString();
  const commit =
    process.env.GITHUB_SHA ||
    (() => {
      try { return execSync("git rev-parse HEAD").toString().trim(); }
      catch { return ""; }
    })();

  return {
    // ...resto da config já existente...
    plugins: [/* ...outros plugins..., */ writeVersionFile(buildTime, commit)],
    define: { __APP_BUILD_TIME__: JSON.stringify(buildTime) },
  };
});
```

Declarar o tipo global em `src/vite-env.d.ts`:

```ts
declare const __APP_BUILD_TIME__: string;
```

**2. Módulo de verificação** — `src/lib/versionCheck.ts`. Troque `sonner` pela
lib de toast já usada no projeto (ou por um banner fixo simples, se não
houver nenhuma):

```ts
import { toast } from "sonner";

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutos
const FIRST_CHECK_DELAY_MS = 15 * 1000; // dá um tempo antes da primeira checagem

interface VersionInfo {
  buildTime: string;
  commit: string;
}

function formatUpdateMessage(buildTime: string): string {
  const d = new Date(buildTime);
  if (isNaN(d.getTime())) return "Este site foi atualizado.";
  const date = d.toLocaleDateString("pt-BR");
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `Este site foi atualizado em ${date} às ${time}h`;
}

export function startVersionCheck(): () => void {
  let notified = false;
  const currentBuildTime = __APP_BUILD_TIME__;

  const check = async () => {
    if (notified) return;
    try {
      const res = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) return;
      const info: VersionInfo = await res.json();
      if (info.buildTime && info.buildTime !== currentBuildTime) {
        notified = true;
        toast.message(formatUpdateMessage(info.buildTime), {
          description: "Atualize a página para usar a versão mais recente.",
          duration: Infinity,
          action: { label: "Atualizar agora", onClick: () => window.location.reload() },
        });
      }
    } catch {
      // Rede instável/offline — tenta de novo no próximo ciclo, sem incomodar.
    }
  };

  const firstCheckTimer = setTimeout(check, FIRST_CHECK_DELAY_MS);
  const interval = setInterval(check, CHECK_INTERVAL_MS);
  const onVisibilityChange = () => { if (document.visibilityState === "visible") check(); };
  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("online", check);

  return () => {
    clearTimeout(firstCheckTimer);
    clearInterval(interval);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("online", check);
  };
}
```

**3. Chamar uma vez** no componente raiz do app (ex: `App.tsx`), sem depender
de autenticação — deve valer mesmo antes do login:

```ts
useEffect(() => startVersionCheck(), []);
```

### Adaptando pra outra stack

- **Sem Vite**: qualquer bundler consegue escrever um `version.json` no
  diretório de saída num passo de `postbuild` (script simples de Node), e
  embutir uma constante equivalente a `__APP_BUILD_TIME__` (Webpack:
  `DefinePlugin`; outros: variável de ambiente lida em build-time).
- **Sem `sonner`**: troque `toast.message(...)` pela API de notificação já
  usada no projeto, ou implemente um banner fixo simples no topo da tela com
  as mesmas condições de exibição.
- **Nunca force o reload automaticamente.** Só avise e deixe a pessoa
  escolher quando — alguém pode estar digitando algo no meio da tarefa.

---

## Parte 2 — Tela de entrada (boas-vindas)

### Especificação visual

De cima para baixo, tudo centralizado:

1. Tagline pequena, maiúscula, cinza — o que o sistema faz (ex: "Gestão de
   Tarefas" no VP Click; adapte pro produto: "Gestão de Importação",
   "Gestão de Propostas", etc.).
2. O vídeo animado do logo da VerticalParts (ver abaixo), mudo, com cantos
   arredondados e sombra suave.
3. O nome do produto em maiúsculas, na cor de marca amarela (`#ffce05`),
   fonte Poppins, peso **fino** (300) — não negrito.
4. Um indicador de carregamento discreto (spinner pequeno + "Carregando..."),
   na mesma cor de marca.

Fundo da tela: **claro** (`bg-slate-50`, aprox. `#f8fafc`). Nunca escuro —
veja o porquê abaixo, é a parte mais fácil de errar.

### Por que o fundo tem que ser claro (não pule esta seção)

O vídeo do logo é gerado por IA (Gemini) e tem fundo **cinza-claro de
estúdio** — não é transparente, nem preto. Isso é uma limitação técnica, não
um detalhe estético: **MP4 com codec H.264 não suporta canal alpha
(transparência) em navegador**, ponto final. Se você pedir "fundo
transparente" pra uma ferramenta de geração de vídeo que só exporta MP4, ela
tipicamente desenha um xadrez cinza/branco (a convenção visual de softwares
de edição pra indicar "isto é transparente") **direto nos pixels do vídeo** —
o que fica pior do que um fundo sólido.

Testamos os dois caminhos possíveis:
- Pedir fundo sólido escuro (batendo com a cor da tela) → a IA de geração não
  respeita a cor exata pedida de forma confiável.
- Pedir fundo transparente → vira um xadrez cinza gravado nos pixels,
  inutilizável.

A solução que funcionou: **não lutar contra o vídeo — deixar a tela clara**,
pra o cinza do vídeo combinar naturalmente com o fundo, em vez de tentar
fazer o vídeo bater com um tema escuro. Cantos arredondados + sombra suave no
vídeo assumem a pequena diferença de tom como uma "moldura" intencional, em
vez de tentar esconder uma borda que nunca vai ficar 100% invisível.

**Se o seu produto usa um vídeo diferente deste**, gerado com outro prompt:
teste antes de decidir a cor de fundo da tela — extraia um frame do vídeo e
confira a cor real de fundo dele (não confie na palavra "transparente" da
ferramenta de geração).

### O vídeo do logo

Arquivo de referência, o mesmo em todos os produtos (é o logo animado da
VerticalParts, não do produto específico):

```
https://raw.githubusercontent.com/verticalpartsIA/005_vpclick/main/src/assets/logo-limpo-video.mp4
```

Especificações do arquivo: MP4, vídeo H.264 + áudio AAC (o par de codecs mais
universalmente suportado por navegadores), ~10 segundos, 1200×292px. É
reproduzido mudo (`muted`) — o arquivo tem trilha de áudio, mas ela nunca é
usada (autoplay com som é bloqueado pela maioria dos navegadores de qualquer
forma).

### Componente (React + Tailwind)

Copie e adapte os textos marcados:

```tsx
const [bootVideoEnded, setBootVideoEnded] = useState(false);
useEffect(() => {
  // Segurança: se o vídeo não conseguir tocar por algum motivo (autoplay
  // bloqueado, formato não suportado, etc.), não travamos o usuário na tela
  // de carregamento pra sempre — o vídeo dura ~10s.
  const fallback = setTimeout(() => setBootVideoEnded(true), 12000);
  return () => clearTimeout(fallback);
}, []);

// `isLoadingAuth` é a condição real de carregamento do SEU app (verificação
// de sessão, etc.) — substitua pelo equivalente do projeto.
if (isLoadingAuth || !bootVideoEnded) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <p className="text-slate-500 text-sm font-bold uppercase tracking-widest mb-3">
          {/* TAGLINE DO PRODUTO, ex: "Gestão de Tarefas" */}
        </p>
        <video
          src={bootLogoVideo}
          autoPlay
          muted
          playsInline
          onEnded={() => setBootVideoEnded(true)}
          onError={() => setBootVideoEnded(true)}
          className="w-full max-w-sm mx-auto rounded-xl shadow-lg shadow-slate-200"
        />
        <p
          className="font-light text-2xl tracking-wide mt-4"
          style={{ color: "#ffce05", fontFamily: "Poppins, sans-serif" }}
        >
          {/* NOME DO PRODUTO EM MAIÚSCULAS, ex: "VPCLICK" */}
        </p>
        <div className="flex items-center justify-center gap-2 mt-4">
          <svg className="w-4 h-4 animate-spin" style={{ color: "#ffce05" }} fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-slate-400 text-xs">Carregando...</p>
        </div>
      </div>
    </div>
  );
}
```

**A regra mais importante é o gating (a condição do `if`):** a tela só libera
quando a condição real de carregamento **e** o vídeo tiverem terminado — o
que vier depois, prevalece. Isso garante que o vídeo sempre toque por
completo, em vez de ser cortado por uma verificação de sessão rápida.
**Nunca** faça o gate só no vídeo — combine sempre com um timeout de
segurança (`setTimeout` de ~12s) e `onError`, porque se o vídeo não
conseguir tocar por qualquer motivo (autoplay bloqueado, formato não
suportado por algum navegador específico) o usuário não pode ficar travado
pra sempre numa tela em branco.

### Fonte Poppins

Adicionar no `<head>` do `index.html` do projeto:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500&display=swap" rel="stylesheet" />
```

Se o carregamento da fonte falhar (rede, bloqueio), o `fontFamily:
"Poppins, sans-serif"` cai pro sans-serif padrão automaticamente — não é
preciso tratar esse caso.

### Não há tela de login pra ajustar (na maioria dos casos)

Nos produtos que usam SSO via `vpsistema.com` (o portal central), não existe
tela de login própria visível em produção — a entrada é sempre pelo card do
portal. Se o seu produto tiver uma tela de login própria e visível, ela **não**
está coberta por este documento; decida separadamente se ela também deve
adotar o fundo claro (por consistência) ou manter tratamento visual distinto
(ex: uma tela de login pode legitimamente ter um visual mais elaborado, com
fundo escuro/carrossel — isso é aceitável, desde que a tela de entrada
propriamente dita siga este padrão).

---

## Checklist de implementação

- [ ] Baixar `logo-limpo-video.mp4` (URL acima) e colocar em `src/assets/` do projeto
- [ ] Adicionar o import da fonte Poppins no `index.html`
- [ ] Substituir a tela de loading/entrada atual pelo componente da Parte 2, adaptando a tagline e o nome do produto
- [ ] Implementar `src/lib/versionCheck.ts` + o plugin do Vite pra gerar `version.json`
- [ ] Declarar `__APP_BUILD_TIME__` em `vite-env.d.ts`
- [ ] Chamar `startVersionCheck()` uma vez no componente raiz do app
- [ ] Rodar o build e confirmar que `dist/version.json` foi gerado com `buildTime`/`commit` corretos
- [ ] Testar a tela de entrada num navegador real (não em Chromium de automação/CI — ele costuma não ter o codec H.264 licenciado e o vídeo nunca toca de verdade nesse ambiente)
- [ ] Depois de um deploy, com uma aba antiga aberta, confirmar que o aviso de atualização aparece
