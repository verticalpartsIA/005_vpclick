# Relatório de Bugs — VP Click  
**Data:** 26/05/2026  
**Commit final:** `6b0f2c5`  
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

`src/App.tsx`:
- `handleConfirmCreateList` agora retorna `Promise<void>` explicitamente
- Caminho de erro adicionado: `toast.error('Erro ao criar lista: ' + error.message)`
- Chamada do `onConfirm` na JSX agora usa `async/await`

---

## Outros bugs encontrados e corrigidos (nas sessões anteriores)

### Bug 3 — Links em documentos não eram clicáveis (sessão anterior)
URLs digitadas ou coladas nos documentos ficavam como texto puro. `contentEditable` também bloqueia o clique padrão em `<a>`. Correção: função `linkifyHtml()` + `handlePaste` + `handleContentClick`.

### Bug 4 — Painel Admin: scroll infinito para ver alçadas (sessão anterior)
A lista de usuários exibia todos os controles de acesso expandidos para todos os usuários ao mesmo tempo. Correção: redesign com acordeão (clique no usuário expande), pesquisa em tempo real, avatares compactos à esquerda.

---

## Arquivos modificados nesta sessão

| Arquivo | Tipo de mudança |
|---|---|
| `src/App.tsx` | Bugfix: `workspaceId` + `onTagsChange` em `TaskDetailModal`; `handleConfirmCreateList` com error handling |
| `src/components/CreateListModal.tsx` | Bugfix: auto-select status group; isSubmitting; onConfirm async |

---

## Status geral pós-correções

| Funcionalidade | Status |
|---|---|
| Kanban — clicar em card | ✅ Abre TaskDetailModal corretamente |
| Nova Lista — criação | ✅ Grupo pré-selecionado, botão habilitado, feedback de erro |
| Links em documentos | ✅ Clicáveis, auto-detectados no load e no paste |
| Painel Admin — alçadas | ✅ Acordeão + pesquisa |
| Spaces nativos (is_system) | ✅ Não deletáveis |
| Integração VP Click Hub | ✅ Edge Function + triggers nos 3 projetos externos |
| Automações VP REQUISICOES | ✅ 4 automações ativas |

---

*Relatório gerado após conclusão e validação de build (`npm run build` sem erros).*
