# Relatório — Integração Propostas → VP Click (Hub Central)
### 29 de maio de 2026

> **Sistema:** VP Click — https://vpclick.vpsistema.com (Supabase `sfpnjwllcmentoocylow`)
> **Origem integrada:** VP Proposta Comercial (Supabase `wfwraicrwazjblyvtzfu`)
> **Executado por:** Claude (Anthropic) — Claude Code
> **Status:** ✅ Em produção e validado ponta a ponta

---

## 1. O que passou a funcionar hoje

A partir de **29/05/2026**, **toda proposta criada** no sistema de Propostas
gera automaticamente uma **tarefa no VP Click**, e **mudanças relevantes na
proposta** (status, título, valor) **atualizam** essa mesma tarefa.

- **Lista de destino:** espaço **VP PROPOSTAS** › folder *Propostas Comerciais*
  › lista **Propostas** (`list_id 44400000-0000-4000-8000-000000000001`).
- **Responsável (principal):** o **vendedor** da proposta, identificado por
  e-mail (a convenção de e-mails é idêntica entre os dois bancos).
- **Acompanhando (secundários):** **Bianca** (Jurídico), **Marcus Braz** e
  **Guilherme** (Gestores Comerciais) — o vendedor é removido da lista de
  acompanhantes quando ele próprio é um dos três (evita duplicidade).
- **Status:** mapeado de Propostas → VP Click
  (`enviada→Enviada`, `aprovada→Aprovada`, `recusada/cancelada→Recusada`, etc.).
- **Prioridade:** "Alta" para propostas.

---

## 2. Arquitetura (Hub Central de Integrações)

Esta era a arquitetura **já desenhada** no projeto (sessão 05), porém estava
**quebrada** e nunca havia criado nenhuma tarefa. O fluxo é:

```
Propostas (INSERT/UPDATE em propostas)
   └─▶ TRIGGER notify_vpclick_proposta  (no banco de Propostas)
         └─▶ pg_net.http_post  ──HTTP──▶  Edge Function handle-integration-event (VP Click)
                                              └─▶ cria/atualiza task + vpclick_integration_links
```

- A tabela **`vpclick_integration_links`** liga cada registro de origem à tarefa
  criada, garantindo **idempotência** (nunca duplica) e permitindo **update**.
- A autenticação entre trigger e Edge Function usa o header
  `x-integration-secret: vp-hub-integration-2026-secret`.

---

## 3. Bugs encontrados e corrigidos hoje

A integração existia mas **nunca funcionou** — diagnóstico:

### 3.1. Trigger (banco de Propostas) — `supabase_trigger_propostas.sql`
- **Bug:** chamava `net.http_post(body := v_payload::TEXT)`, mas a assinatura
  do pg_net é `net.http_post(body jsonb)`. Passar **TEXT** fazia a função "não
  existir"; o erro caía no `EXCEPTION WHEN OTHERS` e era **engolido
  silenciosamente** — nenhuma requisição HTTP era disparada.
- **Correção:** passar `body := v_payload` (JSONB). Função `notify_vpclick_proposta`
  recriada no banco `wfwraicrwazjblyvtzfu`.

### 3.2. Edge Function `handle-integration-event`
- **Bug:** o INSERT na tabela `tasks` incluía as colunas `extension_history` e
  `checklists`, que **não existem** na tabela → todo INSERT falhava (500).
- **Correções (deploy v2):**
  - Removidas as colunas inexistentes (`extension_history`, `checklists`).
  - Passou a preencher **`secondary_assignee_ids`** com os acompanhantes de
    propostas (Bianca, Marcus, Guilherme), sem duplicar o responsável.
  - Adicionada **descrição** amigável e prioridade "Alta" para propostas.
  - Mensagem de erro legível (antes retornava `"[object Object]"`).

---

## 4. Validação (ponta a ponta)

| Passo | Resultado |
|------|-----------|
| INSERT de proposta no banco de Propostas | Trigger disparou; `pg_net` retornou **201** |
| Tarefa no VP Click | **Criada** na lista Propostas, responsável = vendedor, acompanhando = Bianca/Marcus/Guilherme |
| UPDATE da proposta para `aprovada` | A **mesma** tarefa mudou para **"Aprovada"** (sem duplicar, `num_links=1`) |

Todos os dados de teste foram removidos depois da validação.

---

## 5. Observações / pendências

- **Segurança (RLS):** duas tabelas do VP Click estão com **RLS desativado**:
  `task_status_groups` e `task_status_options`. Qualquer um com a chave anon
  pode lê-las/alterá-las. Recomenda-se habilitar RLS com políticas de leitura.
- **Outras origens (visitas, brindes, posvenda):** os triggers correspondentes
  existem no repositório (`supabase_trigger_*.sql`) e a mesma Edge Function já os
  trata. Vale validar cada um com o mesmo cuidado (mesma classe de bug do
  `body ::TEXT` pode existir nos outros triggers).
- **Acompanhantes de outras origens:** hoje só `propostas` tem acompanhantes
  fixos definidos (`FOLLOWERS` na Edge Function). Definir para as demais se
  desejado.

---

*Relatório gerado por Claude (Anthropic) em 29/05/2026.*
