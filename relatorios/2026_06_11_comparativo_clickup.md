# Comparativo ClickUp × VP Click — 11/06/2026

**Fonte:** documentação oficial "Principais recursos da ClickUp" (help.clickup.com, artigo 6311563319063) + **41 artigos linkados** lidos na íntegra via API do help center (2 indisponíveis: Sidebar legada 3.0 e FAQ de preços de IA — sem impacto).
**Base do VP Click:** inventário completo do código em `src/` + migrations SQL + relatórios anteriores (estado da branch `main` em 11/06/2026, v2.0.0 Gold).

Legenda: ✅ paridade real · 🟡 parcial/limitado · ❌ inexistente · ⭐ recurso que o VP Click tem e o ClickUp não tem igual.

---

## 1. Hierarquia e organização

| Recurso ClickUp | ClickUp | VP Click |
|---|---|---|
| Workspace (espaço de trabalho) | Múltiplos workspaces, trocar/criar pelo menu | 🟡 Workspace único e fixo ("VERTICALPARTS"), sem UI de criação/troca |
| Espaços | Ilimitados (pagos), privacidade público/compartilhado, ClickApps por espaço, status herdáveis | ✅ CRUD completo (nome, cor, ícone), espaços de sistema indeléveis; 🟡 sem privacidade por espaço (alçada é por usuário no Admin) |
| Pastas | Opcionais; status personalizados; campos personalizados de pasta | 🟡 Existem com CRUD + drag-and-drop entre espaços, mas são **obrigatórias** (não há lista direta no espaço — gap conhecido) |
| Listas | Em espaços ou pastas; obrigatórias como view | ✅ CRUD, modelo de status por lista, badge de tarefas abertas, progresso |
| Subtarefas aninhadas | ClickApp, até 7 níveis, Tab/Shift+Tab, expansão em Lista/Quadro/Gantt/Mind Map | ✅ Aninhamento recursivo até 7 níveis na Lista, criação inline, contador no Kanban; 🟡 sem rollup de progresso nem mover de pai pela UI |
| Visões Gerais (Overview de Espaço/Pasta) | Cartões (Recursos, Docs, Marcadores, Recentes, Pastas, Listas), exportação PDF | 🟡 Space Overview com progresso/KPIs por pasta e lista; sem cartões configuráveis nem export |
| Cabeçalho de localização + breadcrumbs | Campos do local, ações rápidas (IA, automações, compartilhar) | 🟡 Breadcrumb e toolbar por escopo; botão Automações por lista |
| Arquivamento + Lixeira (30 dias) | Em tarefas, docs, listas | ❌ Toda exclusão é permanente |
| Templates (pasta/lista/tarefa/doc) | Centro de modelos | ❌ (só templates de automação) |

## 2. Tarefas

| Recurso ClickUp | ClickUp | VP Click |
|---|---|---|
| Status personalizados por local | Herança Espaço→Pasta→Lista, edição livre | 🟡 Grupos de status por lista (5 modelos seed), mas **sem UI para criar/editar grupos** |
| Prioridades | 4 níveis | ✅ Baixa/Média/Alta/Urgente com bandeiras |
| Múltiplos responsáveis | Sim | ✅ 1 principal + N adicionais + atribuição de **Equipe inteira** |
| Datas início/fim | Sim | ✅ + ⭐ **prorrogação com justificativa obrigatória e contador** (auditoria que o ClickUp não tem nativamente) |
| Saúde/risco da tarefa | — (via campos/dashboards) | ⭐ Indicador de saúde com 8 estados (em dia/atenção/últimos dias/atrasada...) |
| Estimativa + time tracking | Timer nativo, horas, timesheets | ❌ (duração só calcula a data limite) |
| Checklists | Criar/marcar/atribuir itens | 🟡 Tabela e exibição existem, **sem UI para criar/marcar** (somente leitura) |
| Tags/etiquetas | Por espaço | ✅ Por workspace com cores, filtro no header, ações de automação |
| Campos personalizados | ~20 tipos, gerenciador central, IA, fórmulas, permissões por papel (BPlus+) | ✅ 9 tipos com gerenciador, obrigatoriedade, visibilidade por papel, edição inline; 🟡 fórmula/rating/progresso são código morto |
| Dependências e relacionamentos | Blocks/waiting on/relacionadas + Gantt | ✅ blocks/blocked_by/relates_to com **bloqueio funcional de conclusão** e setas no Gantt |
| Anexos | Versões, preview | 🟡 Upload múltiplo + links; sem preview de imagem embutido |
| Tarefa em múltiplas listas | Sim | ❌ |
| Tarefas recorrentes | Sim | ❌ |
| Tipos de tarefa + IDs personalizados | Sim | ❌ |
| Duplicar tarefa com opções | Sim | ✅ Modal completo (o que copiar, lista destino) |
| Ações em massa (Bulk Action Toolbar) | ~20 ações em 5 views, em docs também | 🟡 Na Lista: status, prioridade, mover, excluir |
| Compartilhar tarefa por link público | Sim | ✅ Link `?taskId=` com modo somente-leitura |
| Observadores (watchers) | Sim, com notificações | ❌ Aba existe mas é placeholder sem modelo de dados |
| Imagem de capa, fixar, layout | Sim | ❌ |

## 3. Visualizações

| View ClickUp | VP Click |
|---|---|
| Lista (obrigatória, agrupar/filtrar/ordenar, colunas) | ✅ Agrupada por status, colunas reordenáveis/redimensionáveis/ocultáveis por lista, quick-create, bulk |
| Quadro/Kanban | ✅ Drag-and-drop otimizado, criação inline, cards ricos |
| Calendário | 🟡 Só mensal; botões Semana/Dia/Filtros decorativos |
| Gantt | 🟡 60 dias, zoom, setas de dependência; sem arrastar barras/caminho crítico/marcos |
| Tabela | ✅ Edição inline incl. campos custom; 🟡 Filtros/Ordenar decorativos |
| Timeline, Workload, Box, Mind Map, Mapa | ❌ |
| Whiteboards (+ Hub, modelos) | ❌ |
| Formulários | ❌ |
| Views salvas/fixadas/privadas/padrão (Barra de Visualizações) | ❌ As abas de view não persistem configuração compartilhável |
| Barra de Visualizações com proteger/duplicar/exportar | ❌ |

## 4. Colaboração e comunicação

| Recurso ClickUp | ClickUp | VP Click |
|---|---|---|
| Comentários em tarefa | Rich text, threads, reações, editar, **comentários atribuídos** | 🟡 Comentários simples com anexo; sem editar/excluir/threads/reações/atribuir |
| @menções (pessoa, equipe, tarefa, doc) | Sim | ✅ Pessoas e Equipes com autocomplete, destaque colorido e notificação (entregue em 10/06) |
| Equipes (grupos de usuários) | "Teams/User Groups" para menção e atribuição | ✅ `teams` + `team_members`, gestão ADMIN/GESTOR, menção @Equipe e atribuição em massa |
| Notificações | **Inbox** com 4 abas, snooze, agrupamento, filtros persistentes, resumo IA, retenção 3 meses; e-mail/push/desktop configuráveis | 🟡 Sino realtime com não-lidas, 30 últimas, marcar todas; ❌ sem Inbox completa, snooze, e-mail/push, preferências |
| Chat (canais, DMs, posts, SyncUps, agendar msg) | Produto completo | ❌ |
| Lembretes (próprios e delegados, recorrência) | Sim | ❌ (trigger `due_date_arrives` existe mas nada o dispara — sem scheduler) |
| AI Notetaker / Clips (gravação de tela/voz) | Sim | ❌ |
| Docs/Wiki | Hub central, subpáginas, tags, edição em massa, privacidade, modelos, importação, wikis | 🟡 Docs por pasta com editor simples (negrito/itálico, linkify, header image, anexos PDF/link); sem subpáginas, versionamento, colaboração realtime, tags, hub |

## 5. Produtividade e navegação

| Recurso ClickUp | ClickUp | VP Click |
|---|---|---|
| Busca / AI Command Bar (Ctrl+K) | Busca universal (tarefas, docs, chat, anexos, pessoas), Busca Conectada a apps externos, calculadora, comandos | 🟡 Ctrl+K (cmdk) navega espaços/listas/tarefas + ações rápidas; busca do header só por título; ❌ full-text/comentários/docs |
| Barra Lateral de Início + Navegação Global (4.0) | Seções personalizáveis (100), fixar hubs, contadores | 🟡 Sidebar dupla com Início/Favoritos/Espaços, badges de abertas |
| Minhas Tarefas / Home (LineUp, AI StandUp, Agenda, Lista pessoal) | Sim | 🟡 "Minhas Tarefas" filtra atribuições; sem LineUp/Agenda/Lista pessoal |
| Favoritos | Tarefas, docs, views, canais; seções; sincronizado | 🟡 Espaços/pastas/listas; **só localStorage** (não sincroniza entre dispositivos) |
| Criação rápida (tarefa, doc, lembrete, chat, whiteboard, painel) | Botão global + atalhos | 🟡 Quick-create de tarefa e doc |
| Atalhos de teclado | Dezenas | 🟡 Ctrl+K, Ctrl/Cmd+Enter em comentário |
| App desktop (Mac/Win/Linux) + app mobile | Sim, com notificações móveis e Inbox mobile | ❌ Só web responsiva (sem PWA/manifest) |

## 6. Gestão e relatórios

| Recurso ClickUp | ClickUp | VP Click |
|---|---|---|
| Dashboards | Customizáveis (cartões/widgets), Hub, modelos, relatórios agendados, refresh 30min, export PDF, drill-down | 🟡 Dashboard fixo muito completo (6 KPIs, radar de saúde ⭐, performance por usuário, ranking 🥇, status/prioridade, top listas, atividade) — porém não customizável nem exportável |
| Metas (Goals: Number, True/False, Currency, Task; pastas de metas) | Sim | ❌ (roadmap explícito) |
| Time tracking + Timesheets Hub | Sim | ❌ |
| Funções de usuário | Proprietário/admin/membro/membro limitado/convidado + funções personalizadas (BPlus+) | 🟡 ADMIN/GESTOR/COLABORADOR + ⭐ alçadas por espaço/pasta por usuário (Admin Panel) — mas aplicadas **só no cliente** (RLS permissivo) e service role key exposta no front (risco já documentado) |
| Automações | Triggers/ações nativas extensas, server-side, automações de Chat, Zapier | 🟡 Engine própria (7 triggers, 10 ações, condições, logs, templates, seeds) — porém **client-side e só dispara em mudança de status**; `send_notification` não grava no sino |
| Integrações / Central de Aplicativos | Catálogo (Slack, GitHub, Drive, Teams...), Busca Conectada, API pública, webhooks | 🟡 ⭐ Hub próprio com 3 sistemas internos (Propostas/Visitas/Pós-Venda) via Edge Function idempotente + SSO do portal; ❌ sem apps de mercado, API pública, import/export |
| IA (Brain, Super Agents, Autopilot, campos IA, standup, busca conectada) | Suíte completa em todos os planos pagos | ❌ Botão "Pergunte à IA" decorativo, sem backend |

## 7. Onde o VP Click ganha do ClickUp ⭐

1. **Prorrogação de prazo com justificativa obrigatória e auditoria** (`task_extension_logs` + badge "Nx prorrogado").
2. **Indicador de saúde da tarefa** (8 estados com emoji) em todas as views e no dashboard (Radar de Saúde).
3. **Integração nativa profunda** com os sistemas internos VerticalParts (Propostas/Visitas/Pós-Venda) com criação/atualização idempotente de tarefas + SSO no portal.
4. **Bloqueio funcional por dependência** (não deixa concluir tarefa bloqueada) — no ClickUp dependência é informativa por padrão.
5. Simplicidade: zero custo por usuário, 100% pt-BR, sem ClickApps para ativar.

## 8. Lacunas priorizadas (recomendação)

**Quick wins (baixo esforço, alto uso diário):**
1. Checklists funcionais (criar/marcar) — o banco já existe.
2. Editar/excluir comentário + reações.
3. Favoritos sincronizados no Supabase (hoje localStorage).
4. `send_notification` das automações gravando no sino (tabela já existe).
5. Watchers reais (seguir tarefa → notificação em comentário/status).
6. Filtros/ordenar reais em Tabela e Calendário semana/dia (botões hoje decorativos).

**Médio esforço, alto impacto:**
7. Inbox de notificações completa (página com abas lidas/não lidas, snooze) + preferências.
8. Scheduler para `due_date_arrives` (cron Supabase/Edge Function) → lembretes de prazo.
9. Tarefas recorrentes.
10. UI para criar/editar grupos de status.
11. Busca full-text server-side (título+descrição+comentários+docs).
12. Lixeira/arquivamento (soft delete).
13. Lista direta no Espaço (sem pasta obrigatória).

**Estruturais (planejar):**
14. RLS server-side de verdade espelhando as alçadas + tirar service role key do frontend (**segurança — mais urgente da lista estrutural**).
15. Realtime em tarefas/comentários (multiusuário ao vivo).
16. Dashboards customizáveis / export PDF-CSV.
17. Time tracking simples (timer + horas por tarefa).
18. Metas/OKRs; Chat; Whiteboards; Formulários; IA — somente se houver demanda real.

---

## Anexos da pesquisa
- Resumo exaustivo dos 41 artigos: `/tmp/clickup_summary_1.md` e `/tmp/clickup_summary_2.md` (ambiente de análise).
- Inventário completo do VP Click: `/tmp/vpclick_inventory.md` (conteúdo refletido neste relatório).
