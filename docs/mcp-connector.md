# Conector MCP para o Claude

O VP Click expõe um servidor MCP remoto (Streamable HTTP) via Supabase Edge
Function, permitindo que o Claude (claude.ai, Claude Desktop ou Claude Code)
consulte e opere tarefas diretamente em conversa.

## Endpoint

```
https://sfpnjwllcmentoocylow.supabase.co/functions/v1/mcp-server
```

Código-fonte: `supabase/functions/mcp-server/index.ts`.

## Autenticação: chave na URL (sem OAuth)

O domínio compartilhado `*.supabase.co` aplica CSP sandbox em HTML servido
por Edge Functions, o que impede qualquer tela de login OAuth de renderizar
ou submeter formulário (aprendido ao integrar VPRequisições). Por isso este
servidor não implementa OAuth: a autenticação é só uma chave compartilhada,
aceita via query string `?key=` (ou header `Authorization: Bearer`, para
outros clientes MCP).

O token não é uma variável de ambiente Deno — ele é validado contra o hash
(SHA-256) guardado na tabela `public.mcp_api_keys`
(migration `supabase/migrations/20260710050000_mcp_api_keys.sql`), com RLS
habilitado sem policies (só o `service_role` consegue ler). O valor em texto
puro nunca é persistido em lugar nenhum.

Para gerar um novo token e revogar o antigo:

```sql
update public.mcp_api_keys set active = false where label = 'claude-web-connector';
insert into public.mcp_api_keys (label, token_hash) values ('novo-label', '<sha256-hex-do-novo-token>');
```

## Como conectar no claude.ai

1. Configurações → Conectores → Adicionar conector → Adicionar conector personalizado.
2. **Nome:** `VP Click`
3. **URL do servidor MCP remoto** (a URL inteira, incluindo `?key=`):
   ```
   https://sfpnjwllcmentoocylow.supabase.co/functions/v1/mcp-server?key=<token-de-acesso>
   ```
4. Deixe os campos de OAuth Client ID/Secret em branco e clique em Adicionar.

O claude.ai pode mostrar um aviso de "não foi possível registrar no serviço
de login" durante a conexão — é a sondagem de descoberta OAuth que ele tenta
por padrão, mesmo sem precisar dela. A chave da URL autentica a requisição
de qualquer forma; o aviso é cosmético.

## Ferramentas disponíveis

**Leitura:** `list_spaces`, `list_lists`, `list_tasks`, `get_task`,
`list_teams`, `list_users`, `dashboard_summary`.

**Escrita:** `create_task`, `update_task`, `add_task_comment`,
`add_checklist_item`, `toggle_checklist_item`.

Todas as ações de escrita usam o `service_role` do Supabase e, quando
aplicável, registram evento em `task_activities`. Não há diferenciação de
papel por usuário — qualquer portador do token pode executar qualquer
ferramenta. Trate o token com o mesmo cuidado que uma credencial de
administrador do sistema.

## Limitações conhecidas

- `list_tasks`/`get_task` não resolvem nomes de usuário para
  `main_assignee_id`/`secondary_assignee_ids` automaticamente — o chamador
  recebe UUIDs; use `list_users` para mapear.
- Status e prioridade são texto livre por lista (cada lista tem seu próprio
  `status_group`), não um enum fixo — `dashboard_summary` usa `'Concluído'`
  como heurística para "atrasadas", que pode não bater com listas que usam
  outros rótulos de status.
- Sem suporte a criação/edição de Spaces, Folders, Lists, Automações ou
  Dependências — só leitura para essas entidades por ora.

## Alerta de segurança separado (não resolvido nesta etapa)

Durante a integração foi identificado que `.env` está **versionado no git**
deste repositório, com a `SUPABASE_SERVICE_ROLE_KEY` em texto puro — dá
acesso total ao banco, ignorando RLS, para qualquer um com leitura no
repositório. Isso é independente do MCP e não foi corrigido a pedido do
usuário; recomenda-se rotacionar a chave e remover o arquivo do histórico do
git assim que possível.
