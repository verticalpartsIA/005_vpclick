# RAG do VPClick

## 1. Objetivo e escopo

Este documento especifica a base de conhecimento e a arquitetura de **Geração Aumentada por Recuperação (RAG)** do VPClick. Ele foi elaborado a partir das rotas e estruturas existentes no repositório `verticalpartsIA/005_vpclick` e deve servir simultaneamente como:

- referência funcional das telas;
- política de qualidade e preenchimento dos dados;
- contrato de ingestão e recuperação de conhecimento;
- orientação para implementação de embeddings, busca vetorial e uso de LLM;
- fonte inicial versionada para respostas assistidas por IA.

RAG combina a memória paramétrica de um modelo de linguagem com memória externa recuperável. No VPClick, a resposta não deve depender apenas do conhecimento geral do LLM: deve recuperar registros autorizados do workspace, fornecer evidências e declarar quando não houver informação suficiente.

### 1.1 Escopo real identificado no código

O sistema possui 15 visões de navegação: Dashboard, Lista, Kanban, Calendário, Gantt, Tabela, Administração, Documento, Caixa de entrada, Respostas, Comentários atribuídos, Reuniões, Minhas tarefas, Lembretes e Tarefas recentes. Existem 16 formas de URL quando se conta `/dashboard`, que é apenas um alias aceito para `/`, não uma tela adicional. O Dashboard também possui uma apresentação contextual de Espaço, selecionada por parâmetros de escopo.

As entidades nativas identificadas incluem usuários, workspaces, espaços, pastas, listas, projetos, tarefas, checklists, comentários, anexos, campos personalizados, dependências, documentos, reuniões, itens de ação, equipes, notificações, lembretes, automações, favoritos e logs.

**Limite atual:** o repositório não contém entidades nativas de catálogo de produtos, pedidos comerciais ou ordens operacionais. Esses dados só podem ser tratados pelo RAG quando forem incorporados por tabelas ou integrações explícitas. Até isso ocorrer, o modelo deve responder “fonte não disponível no VPClick”, e nunca inventar produto, preço, saldo, pedido ou ordem.

## 2. Princípios obrigatórios

1. **Permissão antes da similaridade:** aplicar tenant, workspace, usuário, função e escopo autorizado antes de executar a busca semântica.
2. **Evidência antes da resposta:** toda afirmação operacional deve apontar para registros recuperados, com rota, entidade, identificador e data de atualização.
3. **Sem evidência, sem conclusão:** resultados fracos ou conflitantes devem gerar pedido de esclarecimento ou resposta de insuficiência.
4. **Fonte transacional prevalece:** tarefas, reuniões e documentos atuais prevalecem sobre resumos antigos e conteúdo derivado.
5. **Não substituir o sistema de registro:** o LLM pode explicar, resumir e sugerir; alterações exigem ação explícita, autorização e validação das regras de negócio.
6. **Privacidade por construção:** dados pessoais, comentários, anexos e reuniões herdam as mesmas políticas de acesso da origem.
7. **Atualização rastreável:** todo chunk deve conservar `source_id`, versão, checksum, datas e origem.
8. **Citação verificável:** a interface deve permitir abrir a fonte recuperada.
9. **Português do Brasil:** preservar termos da empresa e normalizar apenas para busca, nunca alterando o texto original.
10. **Exclusão efetiva:** ao excluir ou revogar acesso à fonte, remover ou invalidar seus chunks e vetores.

## 3. Mapa canônico das rotas

| Rota | Visão | Tipo | Fonte principal |
|---|---|---|---|
| `/` | Dashboard | fixa | tarefas, listas, usuários, status |
| `/list` | Lista | fixa e contextual | tarefas, campos e lista ativa |
| `/kanban` | Kanban | fixa e contextual | tarefas agrupadas por status |
| `/calendar` | Calendário | fixa e contextual | tarefas e datas |
| `/gantt` | Gantt | fixa e contextual | tarefas, períodos e dependências |
| `/table` | Tabela | fixa e contextual | tarefas e campos personalizados |
| `/admin` | Administração | fixa e restrita | usuários, perfis e acessos |
| `/doc/:docId` | Documento | dinâmica | documentos e hierarquia |
| `/inbox` | Caixa de entrada | fixa e pessoal | notificações |
| `/replies` | Respostas | fixa e pessoal | comentários e respostas |
| `/assigned-comments` | Comentários atribuídos | fixa e pessoal | comentários atribuídos |
| `/meetings` | Reuniões | fixa; aceita `meetingId` | reuniões e itens de ação |
| `/my-tasks` | Minhas tarefas | fixa e pessoal | tarefas atribuídas ao usuário |
| `/reminders` | Lembretes | fixa e pessoal | lembretes e tarefas relacionadas |
| `/recent-tasks` | Tarefas recentes | fixa e pessoal | tarefas recentes |
| `/dashboard` | Dashboard | alias de `/` | mesmas fontes da raiz |

As visões de workspace aceitam contexto por `listId`, `scope=space|folder`, `scopeId`, `mine=1` e `taskId`. Esses parâmetros devem entrar nos metadados de recuperação; não devem ser incorporados cegamente ao texto do chunk.

## 4. Guia por rota

### 4.1 Dashboard — `/` e alias `/dashboard`

**Propósito:** oferecer visão consolidada de tarefas, progresso, status, responsáveis e indicadores. Quando o escopo é um espaço, apresenta a visão geral daquele espaço e sua hierarquia.

**Boas práticas de preenchimento:** manter títulos de tarefas objetivos; responsável principal; lista; status; prioridade; datas e descrição atualizados. Indicadores só são confiáveis quando esses campos estão completos.

**Regras e políticas:** indicadores devem respeitar o escopo e as permissões. Tarefas canceladas não podem ser tratadas como concluídas. Contagens devem vir da fonte transacional, não de uma resposta previamente gerada.

**Dados e catálogos:** tarefas, listas, espaços, pastas, usuários, grupos de status e tags. Produtos, pedidos e ordens não são nativos; quando integrados, devem possuir identificador externo e sistema de origem.

**Histórico:** mudanças de status, responsáveis, prazos e logs de automação explicam variações dos indicadores. Preservar data de corte em todo resumo.

**Uso no RAG:** criar chunks de sumário por workspace, espaço e lista, sempre derivados novamente após eventos relevantes. Recuperar também chunks-fonte das tarefas que sustentam o indicador.

### 4.2 Lista — `/list`

**Propósito:** gerenciar tarefas em formato operacional, com criação rápida, edição, exclusão, duplicação, movimentação em massa e configuração de colunas.

**Boas práticas de preenchimento:** título com verbo e objeto; descrição com contexto e critério de aceite; uma lista responsável; status válido; responsável; prioridade; datas coerentes; tags controladas; campos personalizados conforme o processo.

**Regras e políticas:** validar campos obrigatórios antes de concluir; impedir data final anterior à inicial; registrar operações em massa; preservar vínculo com lista ao duplicar; evitar duplicidades por título, entidade de negócio e período.

**Dados e catálogos:** tarefas, checklists, anexos, comentários, tags, usuários, listas, campos personalizados e valores. Catálogos externos devem ser referenciados por chave, não copiados como texto livre.

**Histórico/pedidos/ordens:** cada tarefa pode representar uma ação associada a pedido ou ordem externa, mas o vínculo deve usar campos estruturados (`source_system`, `external_entity`, `external_id`). Texto isolado não comprova existência do registro.

**Uso no RAG:** chunk principal por tarefa; chunks filhos para checklist, comentários extensos e anexos extraídos. Recuperação híbrida deve combinar termos exatos (número, código, nome) e similaridade semântica.

### 4.3 Kanban — `/kanban`

**Propósito:** visualizar e movimentar tarefas entre estados do fluxo.

**Boas práticas de preenchimento:** estados devem representar etapas inequívocas; limitar trabalho em andamento quando a política do processo definir WIP; justificar bloqueios; manter responsáveis e prioridade visíveis.

**Regras e políticas:** toda transição precisa ser permitida pelo grupo de status (`START`, `ACTIVE`, `DONE`, `CANCELLED`); conclusão deve respeitar obrigatoriedades; automações disparadas por mudança de status devem ser idempotentes.

**Dados e catálogos:** tarefas, grupos/opções de status, listas, usuários e tags. Catálogos de produto ou ordem permanecem referências externas estruturadas.

**Histórico:** guardar status anterior, novo status, autor e timestamp. O RAG deve distinguir o estado atual da sequência histórica.

**Uso no RAG:** perguntas como “o que está bloqueado?” devem recuperar estado atual e evidências recentes. Não inferir causa do bloqueio sem descrição, comentário ou dependência que a comprove.

### 4.4 Calendário — `/calendar`

**Propósito:** organizar tarefas por datas, criar atividades em uma data e ajustar agenda.

**Boas práticas de preenchimento:** usar datas ISO na persistência; exibir no fuso do usuário; distinguir início, vencimento e conclusão; evitar prazos sem responsável.

**Regras e políticas:** alterações por arrastar devem persistir e gerar histórico; tarefas sem data não podem aparecer como se estivessem agendadas; conflitos devem ser sinalizados, não resolvidos silenciosamente.

**Dados e catálogos:** tarefas, datas, usuários, listas e status. Datas de pedidos/ordens externas devem conservar tipo do marco: emissão, aprovação, entrega prevista ou entrega real.

**Histórico:** registrar reagendamentos e motivo quando aplicável.

**Uso no RAG:** filtrar datas antes da busca vetorial. Expressões relativas como “hoje” e “próxima semana” devem ser convertidas em intervalo absoluto e fuso explícito.

### 4.5 Gantt — `/gantt`

**Propósito:** analisar cronograma, duração, sobreposição e dependências entre tarefas.

**Boas práticas de preenchimento:** início e fim obrigatórios para itens planejados; dependências justificadas; marcos com duração zero; decompor tarefas longas; manter responsável e percentual/estado coerentes.

**Regras e políticas:** dependências usam `blocks`, `blocked_by` ou `relates_to`; impedir autorreferência e ciclos de bloqueio; não mover automaticamente datas sem política aprovada; destacar caminho crítico apenas quando o cálculo existir.

**Dados e catálogos:** tarefas, datas, dependências, listas, usuários e status.

**Histórico:** versões de cronograma, mudanças de dependência e baseline, se implementada. Sem baseline persistida, o RAG não deve alegar desvio de planejamento.

**Uso no RAG:** recuperar a tarefa consultada, predecessoras e sucessoras em expansão controlada de grafo. Similaridade vetorial sozinha não determina dependência.

### 4.6 Tabela — `/table`

**Propósito:** oferecer análise tabular, edição estruturada e cruzamento de campos padrão e personalizados.

**Boas práticas de preenchimento:** selecionar o tipo correto do campo personalizado; usar opções controladas; valores numéricos e datas sem unidades misturadas; links válidos; responsáveis vinculados a usuários.

**Regras e políticas:** respeitar tipos `TEXT`, `NUMBER`, `DATE`, `DROPDOWN`, `CHECKBOX`, `USER`, `WEBSITE` e demais tipos definidos; validar unicidade quando aplicável; operações em massa precisam de confirmação e auditoria.

**Dados e catálogos:** tarefas, campos personalizados, valores, espaços, pastas, listas, usuários e status. Esta é a visão recomendada para exibir referências estruturadas a produto, pedido e ordem após integração.

**Histórico:** alterações de valor devem conservar antes/depois para campos críticos.

**Uso no RAG:** campos estruturados devem ser filtros e metadados, não apenas texto incorporado. Para números, datas e códigos, priorizar consulta SQL e busca lexical.

### 4.7 Administração — `/admin`

**Propósito:** administrar usuários, funções, acesso por escopo, avatar e credenciais.

**Boas práticas de preenchimento:** nome completo; e-mail corporativo único; função mínima necessária; acesso explícito; revisão periódica de usuários inativos.

**Regras e políticas:** acesso restrito a administrador; princípio do menor privilégio; nunca indexar senha, token, segredo ou credencial; mudanças de função e acesso exigem auditoria; remoção de usuário deve tratar propriedade de registros.

**Dados e catálogos:** perfis, funções, último login e regras de acesso. Esses dados servem para autorização do RAG, não como corpus geral.

**Histórico:** manter concessões, revogações, executor, data e justificativa.

**Uso no RAG:** esta rota define filtros de segurança. O índice não pode ampliar acesso. Respostas administrativas devem ser limitadas a usuários autorizados e mascarar dados desnecessários.

### 4.8 Documento — `/doc/:docId`

**Propósito:** registrar conhecimento persistente dentro da hierarquia de trabalho.

**Boas práticas de preenchimento:** título único no contexto; introdução com escopo; seções curtas; responsável; versão/data; links para fontes; linguagem normativa diferenciada de exemplos.

**Regras e políticas:** herdar acesso do espaço/pasta/lista; manter versão e autor; sanitizar HTML; não publicar segredo; marcar documento obsoleto em vez de deixá-lo competir com a versão vigente.

**Dados e catálogos:** documentos e hierarquia. Manuais de produto podem ser ingeridos, desde que vinculados ao código e à versão do produto.

**Histórico:** versões, checksum, data de vigência e substituição.

**Uso no RAG:** chunking semântico por título/subtítulo, preservando breadcrumb. Um chunk deve ser compreensível isoladamente e referenciar `docId`, versão e seção.

### 4.9 Caixa de entrada — `/inbox`

**Propósito:** centralizar notificações de menção, atribuição, comentário, automação, resposta, reunião e outros eventos do usuário.

**Boas práticas de preenchimento:** notificações com ator, ação, objeto, horário e destino; evitar mensagens genéricas; agrupar eventos repetitivos.

**Regras e políticas:** conteúdo pessoal e filtrado pelo destinatário; leitura não altera a fonte; exclusão da notificação não elimina tarefa ou comentário; abertura deve levar ao objeto autorizado.

**Dados e catálogos:** notificações, usuários, tarefas, comentários e reuniões.

**Histórico:** criação, leitura, arquivamento/adiamento e objeto de origem.

**Uso no RAG:** usar para perguntas pessoais sobre novidades, com janela temporal. A notificação é evidência de evento, mas a situação atual deve ser confirmada na entidade de origem.

### 4.10 Respostas — `/replies`

**Propósito:** reunir respostas dirigidas ao usuário em discussões de tarefas.

**Boas práticas de preenchimento:** responder no encadeamento correto; citar decisão ou pergunta; usar menções somente quando requer ação; evitar dados sensíveis em texto livre.

**Regras e políticas:** preservar vínculo pai-filho, autor e timestamp; edição não pode apagar trilha crítica; acesso deriva da tarefa.

**Dados e catálogos:** comentários, respostas, tarefas e usuários.

**Histórico:** texto atual, autor, criação, edição e resolução quando disponível.

**Uso no RAG:** recuperar a janela conversacional necessária, não todo o histórico indiscriminadamente. Distinguir pergunta, proposta e decisão confirmada.

### 4.11 Comentários atribuídos — `/assigned-comments`

**Propósito:** controlar comentários que exigem ação de uma pessoa e seu estado de resolução.

**Boas práticas de preenchimento:** ação clara, responsável, prazo quando necessário e critério de resolução.

**Regras e políticas:** apenas resolver quando a ação estiver atendida; registrar quem resolveu e quando; reabertura deve permanecer auditável; não confundir menção informativa com atribuição.

**Dados e catálogos:** comentários atribuídos, tarefas, usuários e notificações.

**Histórico:** atribuição, transferência, resolução e reabertura.

**Uso no RAG:** responder “o que depende de mim?” filtrando usuário e estado antes da recuperação textual.

### 4.12 Reuniões — `/meetings`

**Propósito:** cadastrar reuniões, participantes, salas, pauta, notas, resumo e itens de ação; transformar itens de ação em tarefas.

**Boas práticas de preenchimento:** título, início/fim, fuso, organizador, participantes, pauta, decisões, responsáveis e prazos dos itens de ação. Separar transcrição, resumo, decisão e ação.

**Regras e políticas:** fim posterior ao início; sala sem conflito; participantes autorizados; criação de tarefa deve manter `meetingId` e `actionItemId`; resumos por IA precisam ser rotulados e revisáveis.

**Dados e catálogos:** reuniões, salas, participantes, itens de ação, tarefas, usuários e listas.

**Histórico/pedidos/ordens:** decisões sobre pedidos ou ordens devem conter referência estruturada; uma fala de reunião não altera o registro comercial por si só.

**Uso no RAG:** chunks separados para pauta, notas, transcrição/resumo, decisões e itens de ação. Dar maior peso a decisões aprovadas e tarefas criadas do que a fala não confirmada.

### 4.13 Minhas tarefas — `/my-tasks`

**Propósito:** consolidar tarefas atribuídas ao usuário atual.

**Boas práticas de preenchimento:** responsável principal correto; coatribuídos quando houver; prioridade e prazo; atualização de status; bloqueios documentados.

**Regras e políticas:** visão pessoal calculada da atribuição atual; não duplicar registros; transferência de responsabilidade deve gerar histórico; usuário vê somente escopos autorizados.

**Dados e catálogos:** tarefas e usuários.

**Histórico:** atribuições anteriores não devem aparecer como atuais, mas podem sustentar auditoria.

**Uso no RAG:** filtro obrigatório por usuário autenticado. Consultas de carga devem preferir agregação estruturada e citar as tarefas relevantes.

### 4.14 Lembretes — `/reminders`

**Propósito:** controlar lembretes pessoais e itens de hoje ou atrasados, com possibilidade de convertê-los em tarefa.

**Boas práticas de preenchimento:** texto acionável; data/hora; fuso; preferência de aviso; vínculo à tarefa quando existente.

**Regras e políticas:** estados de concluído/adiado consistentes; conversão em tarefa mantém referência ao lembrete; notificações não podem duplicar indefinidamente; respeitar preferências `on_due`, `10_min_before`, `1_hour_before`, `custom` e `off`.

**Dados e catálogos:** lembretes, tarefas, usuários e listas.

**Histórico:** criação, disparos, adiamentos, conclusão e conversão.

**Uso no RAG:** usar consulta temporal estruturada. Não usar embedding para decidir se um item está atrasado.

### 4.15 Tarefas recentes — `/recent-tasks`

**Propósito:** facilitar o retorno a tarefas vistas ou alteradas recentemente.

**Boas práticas de preenchimento:** não exige cadastro próprio; depende de atividade e timestamps confiáveis.

**Regras e políticas:** “recente” deve ter critério explícito; ordenar por evento real; respeitar acesso revogado; não confundir criação recente com visualização recente.

**Dados e catálogos:** tarefas, atividades e usuário atual.

**Histórico:** último acesso, última alteração ou critério adotado pela implementação.

**Uso no RAG:** útil como sinal de recência para reranking, nunca como autorização nem prova de relevância.

### 4.16 Dashboard de Espaço — `/?scope=space&scopeId=:id`

**Propósito:** apresentar pastas, listas, progresso e tarefas de um espaço específico.

**Boas práticas de preenchimento:** nome e descrição do espaço; estrutura de pastas coerente; listas com propósito não sobreposto; responsáveis e convenções consistentes.

**Regras e políticas:** acesso herdado ou explícito; movimentações entre espaços devem reavaliar permissões e reindexar; agregações limitadas ao espaço.

**Dados e catálogos:** espaço, pastas, listas, tarefas e progresso.

**Histórico:** criação, renomeação, movimentação e mudança de acesso.

**Uso no RAG:** `workspace_id` e `space_id` são filtros prévios. O breadcrumb completo deve acompanhar todo chunk para reduzir ambiguidades entre listas homônimas.

## 5. Catálogos de dados e integrações futuras

### 5.1 Catálogos nativos

| Catálogo | Chave | Uso no RAG |
|---|---|---|
| Usuários/perfis | `user_id` | autorização, responsáveis e menções |
| Espaços | `space_id` | escopo e filtro de segurança |
| Pastas | `folder_id` | hierarquia e breadcrumb |
| Listas | `list_id` | contexto de processo |
| Status | código/ID | filtro exato e regra de transição |
| Tags | `tag_id` | classificação controlada |
| Campos personalizados | `field_id` | metadado tipado e filtro |
| Salas de reunião | `room_id` | agenda e conflito |
| Equipes | `team_id` | atribuição e autorização quando aplicável |

### 5.2 Produtos, pedidos e ordens

Para incorporar esses domínios, criar ou integrar catálogos canônicos, sem utilizar descrições livres como chave:

| Entidade | Campos mínimos |
|---|---|
| Produto | `product_id`, SKU/código, descrição, família, unidade, versão, status, origem, `updated_at` |
| Pedido | `order_id`, número, tipo, cliente/fornecedor, moeda, total, status, emissão, entrega prevista, origem |
| Ordem operacional | `work_order_id`, tipo, ativo/projeto, responsável, prioridade, status, abertura, prazo, conclusão, origem |
| Cliente/fornecedor | `party_id`, documento normalizado, razão social, nome, status, origem |

Toda sincronização deve ser idempotente por `(source_system, external_id)`, conservar payload bruto protegido para auditoria e publicar apenas campos autorizados ao índice.

## 6. Pipeline de ingestão, limpeza e chunking

### 6.1 Fontes

1. Banco transacional Supabase/PostgreSQL.
2. Documentos nativos do VPClick.
3. Comentários, checklists e notas de reunião.
4. Texto extraído de anexos autorizados.
5. Sistemas externos aprovados para produtos, pedidos e ordens.

### 6.2 Eventos de ingestão

- `INSERT` ou `UPDATE`: criar nova versão do documento lógico e atualizar chunks afetados.
- `DELETE`: excluir/tombstonar fonte, chunks e vetores.
- mudança de permissão ou hierarquia: reavaliar ACL antes de disponibilizar o conteúdo.
- mudança apenas estrutural: atualizar metadados sem gerar embedding se o texto não mudou.

### 6.3 Limpeza

1. preservar texto original e uma versão normalizada;
2. remover scripts, estilos, HTML inseguro e boilerplate;
3. normalizar Unicode e espaços, sem destruir acentos;
4. detectar idioma;
5. mascarar segredos, tokens, senhas e dados pessoais não necessários;
6. eliminar duplicatas exatas por checksum e quase duplicatas com revisão;
7. converter datas para ISO 8601 e manter o fuso original;
8. conservar códigos, números de pedidos, SKUs e siglas sem alteração;
9. extrair tabelas como registros com cabeçalhos, não como sequência desconexa;
10. rejeitar conteúdo vazio, ilegível ou sem origem.

### 6.4 Estratégia de chunking

| Fonte | Unidade recomendada | Tamanho inicial | Sobreposição |
|---|---|---:|---:|
| Tarefa | corpo da tarefa | 300–700 tokens | 10–15% se necessário |
| Comentários | thread ou janela coerente | 250–600 tokens | 1 mensagem de contexto |
| Documento | seção/subseção | 400–800 tokens | 10–20% |
| Reunião | pauta, decisão, ação, bloco de notas | 300–700 tokens | por tópico |
| Checklist | grupo lógico | 150–400 tokens | nenhuma ou mínima |
| Anexo | seção/página semântica | 400–900 tokens | 10–15% |
| Catálogo | um registro canônico | 100–400 tokens | nenhuma |
| Pedido/ordem | cabeçalho + blocos de itens/eventos | 300–700 tokens | por entidade |

Os números são parâmetros iniciais e devem ser calibrados com avaliação. Não dividir no meio de uma tabela, decisão, item de checklist ou par pergunta–resposta.

### 6.5 Documento lógico para embedding

```json
{
  "title": "[tipo] título legível",
  "breadcrumb": "Workspace > Espaço > Pasta > Lista",
  "content": "texto normalizado do chunk",
  "facts": ["campos estruturados relevantes"],
  "source_ref": "rota ou deep link verificável"
}
```

Campos de segurança e IDs ficam nos metadados e não devem ser expostos desnecessariamente no texto incorporado.

## 7. Modelo de embedding: texto para vetor

### 7.1 Política de seleção

O modelo deve:

- ter bom desempenho em português e conteúdo multilíngue;
- suportar códigos e termos corporativos;
- oferecer dimensão compatível com o armazenamento;
- permitir reprocessamento versionado;
- ter custo, latência e política de dados aprovados;
- usar o mesmo modelo/versão para documentos e consultas do mesmo índice.

Não fixar neste documento um fornecedor como regra eterna. Registrar `embedding_provider`, `embedding_model`, `embedding_version`, `dimensions` e `embedded_at`. Uma troca de modelo exige novo namespace ou reindexação completa; vetores de espaços incompatíveis não podem ser comparados.

### 7.2 Representação

O embedding transforma o texto normalizado em vetor numérico. Similaridade semântica aproxima consulta e chunks relacionados, mas não substitui filtros de acesso, joins, datas, valores nem identificadores exatos.

Para o VPClick, recomenda-se busca **híbrida**:

1. filtros SQL/RLS por permissão e escopo;
2. busca lexical/full-text para códigos, nomes e frases;
3. busca vetorial por similaridade;
4. fusão de rankings, por exemplo Reciprocal Rank Fusion;
5. reranking dos candidatos;
6. corte por evidência/score calibrado.

## 8. Vetores e base vetorial (Embedding Store)

Como o projeto já usa Supabase/PostgreSQL, a opção arquitetural preferencial é PostgreSQL com `pgvector`, sujeito à validação de escala e operação.

### 8.1 Esquema lógico sugerido

```sql
create table rag_documents (
  id uuid primary key,
  workspace_id uuid not null,
  source_type text not null,
  source_id text not null,
  source_version text not null,
  title text,
  canonical_url text,
  content_checksum text not null,
  acl jsonb not null,
  source_updated_at timestamptz,
  indexed_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (workspace_id, source_type, source_id, source_version)
);

create table rag_chunks (
  id uuid primary key,
  document_id uuid not null references rag_documents(id) on delete cascade,
  chunk_index integer not null,
  heading_path text[],
  content text not null,
  token_count integer,
  metadata jsonb not null,
  embedding_model text not null,
  embedding_dimensions integer not null,
  embedding vector,
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index, embedding_model)
);
```

Na implementação, declarar `vector(n)` com dimensão compatível com o modelo escolhido. Aplicar RLS também às tabelas RAG. Preferir HNSW para boa relação entre velocidade e recall em leitura; avaliar IVFFlat quando construção mais rápida e menor uso de memória forem prioritários. A decisão deve ser tomada por benchmark com dados reais.

### 8.2 Metadados mínimos por chunk

`workspace_id`, `space_id`, `folder_id`, `list_id`, `source_type`, `source_id`, `source_version`, `owner_id`, `visibility`, `allowed_user_ids/roles` ou política equivalente, `language`, `created_at`, `updated_at`, `valid_from`, `valid_to`, `status`, `canonical_url`, `checksum`, `embedding_model` e `dimensions`.

## 9. Modelos de LLM e orquestração

### 9.1 Responsabilidades do LLM

- interpretar a intenção;
- decompor perguntas compostas;
- produzir consultas e filtros validados;
- sintetizar somente a partir das evidências recuperadas;
- citar fontes e datas;
- apontar divergências e lacunas;
- sugerir próximos passos sem executar mutações não autorizadas.

### 9.2 Seleção de modelo

Usar uma camada de abstração e registrar provedor/modelo por execução. Selecionar por:

- qualidade em português;
- capacidade de seguir instruções e gerar saída estruturada;
- janela de contexto adequada;
- latência e custo;
- suporte a ferramentas;
- requisitos de privacidade e retenção;
- resultados no conjunto de avaliação do VPClick.

Uma estratégia possível é usar modelo menor para classificação, reescrita de consulta e resumo simples, e modelo mais capaz para síntese complexa. O modelo jamais define sozinho autorização ou regra transacional.

### 9.3 Contrato de resposta

Toda resposta operacional deve conter:

1. resposta direta;
2. evidências com título, rota e data;
3. escopo temporal consultado;
4. ressalvas ou conflitos;
5. indicação clara quando a informação não foi encontrada.

## 10. Fluxo de recuperação

1. autenticar usuário;
2. resolver workspace e ACL;
3. classificar intenção: explicação, busca, agregação, comparação ou ação;
4. extrair filtros determinísticos (IDs, status, datas, responsável, escopo);
5. consultar dados estruturados quando a resposta exigir contagem, cálculo ou estado atual;
6. gerar embedding da consulta quando houver componente semântico;
7. recuperar candidatos lexical e vetorialmente dentro do escopo autorizado;
8. expandir relações necessárias (tarefa–comentários, reunião–ações, dependências);
9. reranquear e remover duplicatas;
10. verificar score, atualidade, conflito e cobertura;
11. montar contexto com orçamento de tokens e fontes;
12. gerar resposta fundamentada;
13. validar citações e impedir afirmações sem apoio;
14. registrar telemetria sem armazenar conteúdo sensível desnecessário.

## 11. Regras de negócio para respostas e ações

- Contagem, soma, atraso e duração devem vir de consulta estruturada, não do cálculo implícito do LLM.
- Estado atual prevalece sobre histórico; histórico deve ser rotulado com data.
- “Concluído” exige status atual compatível; comentário dizendo “feito” não basta.
- “Atrasado” exige prazo anterior ao instante de corte e status não final.
- Uma decisão de reunião não altera tarefa, pedido ou ordem até a atualização transacional correspondente.
- Um item excluído, inacessível ou obsoleto não pode aparecer no contexto.
- Escrita, edição, movimentação ou exclusão requer confirmação de objeto, campos, autorização e resultado da API.
- Toda ação assistida deve registrar usuário, intenção, entrada, resultado e identificadores afetados.

## 12. Segurança, LGPD e governança

- Classificar conteúdo por sensibilidade.
- Aplicar minimização de dados e propósito legítimo.
- Não enviar ao provedor do modelo conteúdo além do necessário.
- Mascarar CPF, documentos, credenciais, dados bancários e informações pessoais quando não forem essenciais.
- Respeitar retenção, exclusão, acesso e correção na fonte e no índice.
- Proteger logs e prompts contra vazamento.
- Tratar conteúdo recuperado como dado, nunca como instrução; ignorar prompt injection presente em documentos.
- Permitir auditoria de qual fonte sustentou cada resposta.
- Executar testes de isolamento entre usuários, espaços e workspaces.

## 13. Avaliação e observabilidade

Criar conjunto de perguntas reais por rota com resposta esperada, fonte correta e permissões. Medir:

- Recall@k e precisão da recuperação;
- MRR/nDCG quando houver ranking de referência;
- fidelidade da resposta às evidências;
- correção das citações;
- taxa de resposta sem suporte;
- vazamento entre escopos (meta obrigatória: zero);
- atualidade após atualização/exclusão;
- latência p50/p95;
- custo por consulta;
- taxa de “não encontrado” correta;
- desempenho por português, códigos e números.

Executar testes específicos para homônimos, tarefas duplicadas, documentos obsoletos, datas relativas, comentários conflitantes, mudança de acesso e tentativa de prompt injection.

## 14. Critérios de aceite da primeira versão

- [ ] RLS/ACL aplicada antes da recuperação.
- [ ] Ingestão idempotente de documentos, tarefas, comentários e reuniões.
- [ ] Exclusão e revogação refletidas no índice.
- [ ] Chunking preserva hierarquia e fonte.
- [ ] Busca híbrida disponível.
- [ ] Respostas apresentam deep links verificáveis.
- [ ] Consultas numéricas usam SQL.
- [ ] Modelo recusa resposta sem evidência suficiente.
- [ ] Catálogos externos não são inventados quando ausentes.
- [ ] Avaliação cobre todas as rotas.
- [ ] Logs registram versões de embedding, retriever e LLM.
- [ ] Testes de isolamento e segurança aprovados.

## 15. Fontes e rastreabilidade

### Fontes do projeto

- Navegação, rotas e composição das visões: [`src/App.tsx`](../src/App.tsx)
- Entidades e tipos do domínio: [`src/types.ts`](../src/types.ts)
- Migração base do banco: [`supabase_migrations.sql`](../supabase_migrations.sql)
- Migrações complementares: arquivos `supabase_migration_*.sql` na raiz

### Referências conceituais e técnicas

- Wikipédia em português, “Geração aumentada por recuperação”: <https://pt.wikipedia.org/wiki/Gera%C3%A7%C3%A3o_aumentada_por_recupera%C3%A7%C3%A3o>
- Lewis et al. (2020), “Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks”: <https://arxiv.org/abs/2005.11401>
- pgvector, documentação oficial: <https://github.com/pgvector/pgvector>

## 16. Registro da análise

- Repositório analisado: `verticalpartsIA/005_vpclick`
- Branch analisada: `main`
- Commit-base: `75ab47828cab290fba320f7338080b1890ceabe1`
- Data do documento: 2026-08-29
- Natureza: especificação inicial; propostas futuras estão explicitamente separadas das funcionalidades existentes.
