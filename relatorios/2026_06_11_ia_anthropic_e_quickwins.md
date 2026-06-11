# IA Anthropic + Quick Wins — 11/06/2026

## 1. IA real no VP Click (Anthropic Claude)

- **Edge Function `ask-ai`** (`supabase/functions/ask-ai/index.ts`): proxy seguro para a API da Anthropic.
  - A chave fica **só no backend** (secret `ANTHROPIC_API_KEY` do Supabase) — nunca no bundle do frontend.
  - Valida o JWT do usuário logado antes de qualquer chamada (401 para anônimos).
  - Modelo `claude-opus-4-8` com adaptive thinking, respostas em pt-BR, contexto limitado a 30k chars, histórico das últimas 10 mensagens.
- **`src/components/AIPanel.tsx`**: painel lateral roxo dentro do modal da tarefa.
  - Ações rápidas: Resumir tarefa · Resumir comentários · Sugerir subtarefas · Melhorar descrição.
  - Chat livre com follow-up (mantém histórico), botão Copiar em cada resposta.
  - O botão **"✨ Pergunte à IA"** no cabeçalho da tarefa (antes decorativo) agora abre/fecha o painel.
  - Contexto enviado: título, descrição, status, prioridade, datas, responsáveis, prorrogações, subtarefas, itens de ação e comentários.

### Deploy necessário (uma vez)
```sh
supabase secrets set ANTHROPIC_API_KEY=<chave> --project-ref sfpnjwllcmentoocylow
supabase functions deploy ask-ai --project-ref sfpnjwllcmentoocylow
```

## 2. Quick wins do comparativo ClickUp implementados

1. **Checklists ("Itens de ação") funcionais** — criar (input + Enter), marcar/desmarcar (persiste em `task_checklists`) e excluir (hover), com contador X/Y. Antes era somente leitura.
2. **Automação `send_notification` grava no sino** — além do toast local, insere em `notifications` (tipo `automation`) para o destinatário configurado ou o responsável da tarefa, chegando em tempo real no NotificationBell.

## Pendências conhecidas (próximos passos sugeridos)
- Editar/excluir comentários; favoritos sincronizados no Supabase; watchers reais; filtros do Calendário/Tabela (ver `relatorios/2026_06_11_comparativo_clickup.md`).
- Possível evolução da IA: criar subtarefas sugeridas com 1 clique; IA no Dashboard (resumo da semana).
