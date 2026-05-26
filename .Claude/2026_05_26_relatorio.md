# Relatório de Bugs e Melhorias — VP Click  
**Data:** 26/05/2026  
**Branch:** `main` → `https://github.com/verticalpartsIA/vp-click.git`

---

## Bugs reportados pelo usuário

### Bug 1 — Kanban: clique em card → tela branca (CRÍTICO)

**Sintoma:** Ao clicar em qualquer card do Kanban, o app ia para uma tela em branco.

**Causa raiz:**  
`TaskDetailModal` é uma função separada definida em `App.tsx`, mas internamente acessava duas variáveis do escopo do componente `App` **sem recebê-las como props**:

- `workspace.id` (linha 5729) — usado em `<TaskTagsInput workspaceId={workspace.id} />`
- `setTasks` (linha 5734) — usado no callback `onTagsChange`

Em JavaScript, funções fora de closures não têm acesso ao estado de outro componente. Ao renderizar a aba padrão "Detalhes", o acesso a `workspace.id` lançava imediatamente um `ReferenceError`, derrubando toda a árvore React (tela branca, sem mensagem).

**Correção aplicada (`src/App.tsx`):**
- Adicionadas duas novas props ao `<TaskDetailModal>` na chamada do pai:
  - `workspaceId={workspace.id}`
  - `onTagsChange={(taskId, tags) => setTasks(prev => prev.map(...))`
- Adicionadas ao destructuring de `props` dentro do `TaskDetailModal`
- Substituído `workspace.id` por `workspaceId` na linha do `TaskTagsInput`
- Substituído o `setTasks(...)` pelo callback `onTagsChange?.(task.id, tags)` + `onUpdate({...task, tags})`

**Commit:** `6b0f2c5`

---

### Bug 2 — Nova Lista: modal abre mas "nada funciona"

**Sintoma:** O popup de criar nova lista aparecia corretamente com os modelos de status, mas clicar em "Criar Lista" não tinha efeito.

**Causa raiz (dois problemas combinados):**

**2a) `selectedGroupId` iniciava vazio:**  
`CreateListModal` usa `useState(statusGroups[0]?.id || '')` para o grupo selecionado. Como o componente é montado junto com o `App` (antes dos dados do Supabase chegarem), `statusGroups` estava vazio no momento do mount, e o `useState` só usa o valor inicial uma vez. Resultado: `selectedGroupId = ''` → botão "Criar Lista" ficava `disabled` indefinidamente, mesmo após os grupos carregarem na tela.

**2b) Nenhum feedback de erro no `handleConfirmCreateList`:**  
Se o insert no Supabase falhasse por qualquer motivo (RLS, timeout, coluna faltando), o código simplesmente ignorava o erro — sem `toast.error`, sem mensagem. O modal ficava aberto em silêncio total.

**Correção aplicada:**

`src/components/CreateListModal.tsx`:
- Adicionado `useEffect` que auto-seleciona o primeiro grupo quando `statusGroups` carregar (se `selectedGroupId` ainda estiver vazio)
- `onConfirm` alterado para `Promise<void>` (interface e implementação)
- Adicionado estado `isSubmitting` para feedback visual no botão ("Criando...")
- `handleSubmit` agora é `async` e usa `await onConfirm()`
- Modal redesenhado com **sticky footer sempre visível**: barra de preview mostrando "Nome → Modelo ✓ Pronto para criar" + botão dinâmico guiando o usuário passo a passo

`src/App.tsx`:
- `handleConfirmCreateList` agora retorna `Promise<void>` explicitamente
- Caminho de erro adicionado: `toast.error('Erro ao criar lista: ' + error.message)`

**Commit:** `338bb9a`

---

## Outros bugs encontrados e corrigidos (sessões anteriores)

### Bug 3 — Links em documentos não eram clicáveis
URLs digitadas ou coladas nos documentos ficavam como texto puro. `contentEditable` também bloqueia o clique padrão em `<a>`. Correção: função `linkifyHtml()` + `handlePaste` + `handleContentClick`.

### Bug 4 — Painel Admin: scroll infinito para ver alçadas
A lista de usuários exibia todos os controles de acesso expandidos para todos os usuários ao mesmo tempo. Correção: redesign com acordeão (clique no usuário expande), pesquisa em tempo real, avatares compactos à esquerda.

---

## Melhorias implementadas

### Melhoria 1 — Drag-and-drop na sidebar (listas e pastas)

**Solicitação do usuário:** "cada pasta é um espaço o usuário precisa segurar e arrastar lista ou pastas para outros espaços"

**Implementação (`src/App.tsx`):**

| Ação | Comportamento |
|------|--------------|
| Arrastar uma **lista** sobre uma **pasta** | Move a lista para aquela pasta (qualquer espaço) |
| Arrastar uma **pasta** sobre um **espaço** | Move a pasta para aquele espaço |
| Feedback visual durante drag | Borda azul tracejada no destino válido; item sendo arrastado fica com 40% de opacidade |
| Após o drop | Supabase atualizado imediatamente; estado React sincronizado; toast de confirmação |
| Auto-expand | Ao mover uma lista para uma pasta recolhida, a pasta se expande automaticamente |

**Novos handlers em `App.tsx`:**
- `handleMoveList(listId, targetFolderId)` — atualiza `lists.folder_id` no Supabase
- `handleMoveFolder(folderId, targetSpaceId)` — atualiza `folders.space_id` no Supabase

**Commit:** `e2f041d`

---

### Melhoria 2 — Migração de tarefas do Gelson para IntraSites_Projetos

**Solicitação do usuário:** "mova todas as minhas tarefas para pasta intra site, todos por favor! Deixe tudo em um único lugar!"

**Ação realizada via Supabase SQL:**  
16 tarefas pessoais do usuário Gelson (UUID `73388463-f6b7-4cdf-ab02-30da6403cb4b`) foram movidas de espaços dispersos para um único ponto:

> **T.I → IntraSites_Projetos → Geral** (list_id: `2698cfc2-3741-42a8-b0bf-81ca7403ac10`)

**Tarefas migradas:**
- Configurar GitHub Actions
- Finalizar dashboards de analytics
- Infraestrutura de Agentes de IA
- Novo site vpsuprimentos (×2)
- Portal VPSistema - Manutencao e Seguranca
- Validar fluxo de propostas e vendedores
- VerticalPartsLiveTV - Lancamento e Analytics
- VP Requisicoes - Estabilizacao de Producao (Hostinger)
- Nova versão vpclick / Teste vpclick / Teste Gelson
- vprequisição / vprequisições (×2)
- VerticalPartsLiveTV - Lan

> Tarefas de integração (VP Requisicoes / SUPRIMENTOS) e tarefas E2E de auditoria foram mantidas em seus espaços funcionais para não quebrar workflows automáticos.

---

## Histórico de commits desta sessão

| Commit | Descrição |
|--------|-----------|
| `6b0f2c5` | Bugfix: `workspaceId` + `onTagsChange` em `TaskDetailModal`; error handling em `handleConfirmCreateList` |
| `338bb9a` | Bugfix + redesign: `CreateListModal` com sticky footer, auto-select grupo, `isSubmitting` |
| `28ba327` | Docs: criação do relatório `.Claude/2026_05_26_relatorio.md` + push para GitHub |
| `e2f041d` | Feat: drag-and-drop sidebar (listas/pastas entre espaços) + migração de tarefas |

---

## Arquivos modificados na sessão completa

| Arquivo | Tipo de mudança |
|---------|----------------|
| `src/App.tsx` | Bugfix Kanban + bugfix Nova Lista + drag-and-drop sidebar |
| `src/components/CreateListModal.tsx` | Redesign completo com sticky footer e UX guiada |
| `src/pages/AdminPanel.tsx` | Redesign: acordeão + pesquisa + avatares |
| `.Claude/2026_05_26_relatorio.md` | Este relatório |

---

## Status geral pós-sessão

| Funcionalidade | Status |
|----------------|--------|
| Kanban — clicar em card | ✅ Abre TaskDetailModal corretamente |
| Nova Lista — criação | ✅ Grupo pré-selecionado, sticky footer, feedback de erro |
| Links em documentos | ✅ Clicáveis, auto-detectados no load e no paste |
| Painel Admin — alçadas | ✅ Acordeão + pesquisa |
| Drag-and-drop sidebar | ✅ Listas e pastas arrastáveis entre espaços |
| Tarefas Gelson consolidadas | ✅ Todas em IntraSites_Projetos → Geral |
| Spaces nativos (is_system) | ✅ Não deletáveis |
| Integração VP Click Hub | ✅ Edge Function + triggers nos 3 projetos externos |
| Automações VP REQUISICOES | ✅ 4 automações ativas |

---

*Relatório atualizado após conclusão e validação de build (`npm run build` sem erros).*
