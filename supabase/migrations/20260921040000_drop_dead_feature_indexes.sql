-- Limpeza dos 41 índices "nunca usados" apontados pelo advisor de
-- performance do Supabase: revisados um a um (tabela, coluna, se sustenta
-- FK/constraint, se algum código — front-end, edge function ou trigger —
-- de fato lê/escreve por aquela coluna). A maioria pertence a tabelas de
-- recursos ativos (reuniões, quadros, tarefas etc.) com pouco volume de
-- dados ainda — ficam, porque vão passar a ser usados conforme a base
-- cresce. Só os de recursos comprovadamente mortos saem daqui:
--
-- - list_permissions / folder_permissions: tabelas sem nenhuma leitura ou
--   escrita em lugar nenhum do app (list_permissions já identificada como
--   morta numa investigação anterior desta mesma sessão).
-- - automation_logs: automations (a tabela em si) é usada pelo app, mas
--   automation_logs nunca é lido nem escrito por nada — nem front-end, nem
--   trigger, nem edge function.
-- - task_dependencies: schema existe, mas o recurso de "bloqueado por"
--   nunca foi ligado na UI — zero referência em todo o código.
-- - notifications.snoozed_until: campo existe no tipo TypeScript
--   (snoozedUntil) mas nunca é lido nem gravado — feature nunca saiu do
--   papel, o índice parcial (WHERE snoozed_until IS NOT NULL) sempre fica
--   vazio.
-- - user_access.folder_ids / space_ids: os índices GIN nunca podem ser
--   usados pela query real (can_access_folder/can_access_space filtram
--   primeiro por user_id = auth.uid(), que já reduz pra ~1 linha por
--   usuário antes de checar o array — não há nada pra um índice de array
--   acelerar nesse formato de consulta).
-- - rag_documents / rag_chunks: schema da fase 1 de RAG existe, mas nenhuma
--   edge function (nem a ask-ai) nem o front-end nunca consultam essas
--   tabelas — feature nunca foi ligada.
--
-- auth_pins.user_id ficou de fora da limpeza: sem referência no código
-- deste repo, mas também sem uma migration própria que explique a tabela —
-- pode ser usada por um hook de Auth fora deste repo, então não dá pra
-- confirmar que está morta.

drop index if exists public.idx_list_permissions_user_id;
drop index if exists public.idx_folder_permissions_user_id;
drop index if exists public.idx_automation_logs_automation;
drop index if exists public.idx_automation_logs_executed;
drop index if exists public.idx_task_dependencies_depends_on_id;
drop index if exists public.idx_notifications_snoozed_until;
drop index if exists public.idx_user_access_folder_ids;
drop index if exists public.idx_user_access_space_ids;
drop index if exists public.rag_documents_source_idx;
drop index if exists public.rag_documents_active_idx;
drop index if exists public.rag_chunks_document_idx;
