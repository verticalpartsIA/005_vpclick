import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// ─── Servidor MCP remoto do VP Click ───────────────────────────────────────
// Expõe o gestor de tarefas (spaces, listas, tarefas, checklists,
// comentários, equipes) como ferramentas MCP para que o Claude (claude.ai /
// Claude Code) possa consultar e operar tarefas via um "conector
// personalizado" (Streamable HTTP transport).
//
// Autenticação: chave compartilhada, aceita via header Authorization: Bearer
// <token> OU via query string ?key=<token>. O modo query permite embutir a
// credencial direto na URL do conector do claude.ai — necessário porque o
// domínio compartilhado *.supabase.co aplica CSP sandbox em HTML servido por
// Edge Functions, o que impede qualquer tela de login OAuth de funcionar.
// Sem tela de login, sem OAuth: a primeira requisição já chega autenticada.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const PROTOCOL_VERSION = "2025-06-18";
const SERVER_INFO = { name: "vpclick-mcp", version: "1.0.0" };

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Session-Id, Mcp-Protocol-Version",
};

function jsonResponse(body: unknown, status = 200) {
  const headers = new Headers();
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  for (const [key, value] of Object.entries(CORS_HEADERS)) headers.set(key, value);
  return new Response(new TextEncoder().encode(JSON.stringify(body)), { status, headers });
}

// ─── Acesso a dados (PostgREST via service_role) ───────────────────────────

async function supabaseRest<T>(
  path: string,
  options?: { method?: "GET" | "POST" | "PATCH" | "DELETE" | "HEAD"; body?: unknown; headers?: Record<string, string> },
): Promise<{ data: T; count: number }> {
  const method = options?.method || "GET";
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...options?.headers,
    },
    body: options?.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (!response.ok) {
    const text = await response.text();
    let message = text || `Supabase respondeu com status ${response.status}.`;
    try {
      const parsed = JSON.parse(text) as { message?: string; error?: string };
      message = parsed.message || parsed.error || message;
    } catch {
      // texto simples, mantém message
    }
    throw new Error(message);
  }

  const contentRange = response.headers.get("content-range");
  const count = contentRange ? Number(contentRange.split("/")[1]) || 0 : 0;

  if (method === "HEAD" || response.status === 204) {
    return { data: null as T, count };
  }

  const text = await response.text();
  if (!text) return { data: null as T, count };
  return { data: JSON.parse(text) as T, count };
}

// ─── Autenticação por chave compartilhada (hash em mcp_api_keys) ──────────

async function sha256Hex(input: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function isAuthorized(req: Request, url: URL): Promise<boolean> {
  const header = req.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  const bearerToken = match ? match[1].trim() : "";
  const keyParam = (url.searchParams.get("key") || "").trim();

  for (const token of [bearerToken, keyParam]) {
    if (!token) continue;
    const tokenHash = await sha256Hex(token);
    const { data } = await supabaseRest<Array<{ id: string }>>(
      `mcp_api_keys?select=id&token_hash=eq.${tokenHash}&active=eq.true&limit=1`,
    );
    if (Array.isArray(data) && data.length > 0) return true;
  }
  return false;
}

// ─── Domínio: helpers ───────────────────────────────────────────────────────

async function findUserByEmail(email: string) {
  const { data } = await supabaseRest<Array<{ id: string; email: string; name: string }>>(
    `profiles?select=id,email,name&email=eq.${encodeURIComponent(email)}&limit=1`,
  );
  const user = data?.[0];
  if (!user) throw new Error(`Usuário com email ${email} não encontrado.`);
  return user;
}

async function findTaskById(taskId: string) {
  const { data } = await supabaseRest<Array<{ id: string; title: string; status: string; list_id: string }>>(
    `tasks?select=id,title,status,list_id&id=eq.${encodeURIComponent(taskId)}&limit=1`,
  );
  const task = data?.[0];
  if (!task) throw new Error(`Tarefa ${taskId} não encontrada.`);
  return task;
}

async function findListById(listId: string) {
  const { data } = await supabaseRest<Array<{ id: string; name: string }>>(
    `lists?select=id,name&id=eq.${encodeURIComponent(listId)}&limit=1`,
  );
  const list = data?.[0];
  if (!list) throw new Error(`Lista ${listId} não encontrada.`);
  return list;
}

async function logActivity(taskId: string, userId: string | null, type: string, oldValue: string | null, newValue: string | null) {
  await supabaseRest("task_activities", {
    method: "POST",
    body: [{ task_id: taskId, user_id: userId, type, old_value: oldValue, new_value: newValue }],
  });
}

// ─── Ferramentas MCP ────────────────────────────────────────────────────────

interface ToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (args: Record<string, unknown>) => Promise<unknown>;
}

const TOOLS: ToolDef[] = [
  {
    name: "list_spaces",
    description: "Lista os Spaces (departamentos) do VP Click, com cor, ícone e contagem de folders.",
    inputSchema: { type: "object", properties: {} },
    handler: async () => {
      const { data } = await supabaseRest("spaces?select=id,name,color,icon,is_system&order=name.asc");
      return { spaces: data };
    },
  },
  {
    name: "list_lists",
    description: "Lista as Lists (quadros de tarefas) do VP Click, opcionalmente filtradas por space ou folder.",
    inputSchema: {
      type: "object",
      properties: {
        space_id: { type: "string" },
        folder_id: { type: "string" },
      },
    },
    handler: async (args) => {
      const params = new URLSearchParams({
        select: "id,name,folder_id,folders(name,space_id,spaces(name))",
        order: "name.asc",
        limit: "200",
      });
      if (args.folder_id) params.set("folder_id", `eq.${args.folder_id}`);
      const { data } = await supabaseRest(`lists?${params.toString()}`);
      let lists = data as Array<Record<string, unknown>>;
      if (args.space_id) {
        lists = lists.filter((l) => (l.folders as Record<string, unknown> | null)?.space_id === args.space_id);
      }
      return { lists };
    },
  },
  {
    name: "list_tasks",
    description: "Lista tarefas com filtros opcionais por lista, status, prioridade, responsável (email) ou busca por texto no título. Recomendado sempre passar list_id ou search para evitar varrer as ~6800 tarefas.",
    inputSchema: {
      type: "object",
      properties: {
        list_id: { type: "string" },
        status: { type: "string" },
        priority: { type: "string" },
        assignee_email: { type: "string", description: "Filtra por responsável principal ou secundário." },
        search: { type: "string", description: "Busca por texto no título." },
        due_before: { type: "string", description: "Data limite (YYYY-MM-DD); retorna tarefas com due_date antes disso." },
        limit: { type: "number", description: "Máximo de resultados (padrão 30, máx 100)." },
      },
    },
    handler: async (args) => {
      const limit = Math.min(Number(args.limit) || 30, 100);
      const params = new URLSearchParams({
        select: "id,title,status,priority,due_date,start_date,list_id,main_assignee_id,tags,created_at",
        order: "created_at.desc",
        limit: String(limit),
      });
      if (args.list_id) params.set("list_id", `eq.${args.list_id}`);
      if (args.status) params.set("status", `eq.${args.status}`);
      if (args.priority) params.set("priority", `eq.${args.priority}`);
      if (args.due_before) params.set("due_date", `lt.${args.due_before}`);
      if (args.search) {
        const term = String(args.search).replace(/[,()]/g, "");
        params.set("title", `ilike.*${term}*`);
      }
      if (args.assignee_email) {
        const user = await findUserByEmail(String(args.assignee_email));
        params.set("or", `(main_assignee_id.eq.${user.id},secondary_assignee_ids.cs.{${user.id}})`);
      }
      const { data, count } = await supabaseRest(`tasks?${params.toString()}`, {
        headers: { Prefer: "count=exact" },
      });
      return { total: count, tasks: data };
    },
  },
  {
    name: "get_task",
    description: "Retorna o detalhe completo de uma tarefa: dados gerais, checklist, comentários, anexos, dependências e atividade recente.",
    inputSchema: {
      type: "object",
      properties: { task_id: { type: "string" } },
      required: ["task_id"],
    },
    handler: async (args) => {
      const taskId = String(args.task_id);
      const { data: tasks } = await supabaseRest<Array<Record<string, unknown>>>(
        `tasks?select=*&id=eq.${encodeURIComponent(taskId)}&limit=1`,
      );
      const task = tasks?.[0];
      if (!task) throw new Error(`Tarefa ${taskId} não encontrada.`);

      const [checklist, comments, attachments, dependsOn, blocks, activity] = await Promise.all([
        supabaseRest(`task_checklists?select=id,text,completed,created_at&task_id=eq.${taskId}&order=created_at.asc`),
        supabaseRest(
          `task_comments?select=id,text,created_at,profiles!task_comments_user_id_fkey(name,email)&task_id=eq.${taskId}&order=created_at.asc`,
        ),
        supabaseRest(`task_attachments?select=id,name,url,type,size,uploaded_at&task_id=eq.${taskId}`),
        supabaseRest(`task_dependencies?select=type,depends_on_id&task_id=eq.${taskId}`),
        supabaseRest(`task_dependencies?select=type,task_id&depends_on_id=eq.${taskId}`),
        supabaseRest(
          `task_activities?select=type,old_value,new_value,created_at,profiles!task_activities_user_id_fkey(name)&task_id=eq.${taskId}&order=created_at.desc&limit=20`,
        ),
      ]);

      return {
        task,
        checklist: checklist.data,
        comments: comments.data,
        attachments: attachments.data,
        depends_on: dependsOn.data,
        blocks: blocks.data,
        recent_activity: activity.data,
      };
    },
  },
  {
    name: "list_teams",
    description: "Lista as Teams (equipes atribuíveis) do VP Click com seus membros.",
    inputSchema: { type: "object", properties: {} },
    handler: async () => {
      const { data: teams } = await supabaseRest<Array<Record<string, unknown>>>(
        "teams?select=id,name,description,color&order=name.asc",
      );
      if (!teams?.length) return { teams: [] };
      const teamIds = teams.map((t) => t.id);
      const { data: members } = await supabaseRest<Array<Record<string, unknown>>>(
        `team_members?select=team_id,profiles!team_members_user_id_fkey(name,email)&team_id=in.(${teamIds.join(",")})`,
      );
      const membersByTeam = new Map<string, unknown[]>();
      for (const m of members) {
        const list = membersByTeam.get(m.team_id as string) ?? [];
        list.push(m.profiles);
        membersByTeam.set(m.team_id as string, list);
      }
      return {
        teams: teams.map((t) => ({ ...t, members: membersByTeam.get(t.id as string) ?? [] })),
      };
    },
  },
  {
    name: "list_users",
    description: "Lista colaboradores com acesso ao VP Click.",
    inputSchema: {
      type: "object",
      properties: { active_only: { type: "boolean" }, search: { type: "string" } },
    },
    handler: async (args) => {
      const params = new URLSearchParams({ select: "id,name,email,role,is_active,created_at", order: "name.asc" });
      if (args.active_only) params.set("is_active", "eq.true");
      if (args.search) {
        const term = String(args.search).replace(/[,()]/g, "");
        params.set("or", `(name.ilike.*${term}*,email.ilike.*${term}*)`);
      }
      const { data } = await supabaseRest(`profiles?${params.toString()}`);
      return { users: data };
    },
  },
  {
    name: "dashboard_summary",
    description: "Resumo executivo: total de tarefas, concluídas, atrasadas, criadas hoje e contagem de spaces/usuários ativos.",
    inputSchema: { type: "object", properties: {} },
    handler: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const count = async (table: string, filters: Record<string, string>) => {
        const params = new URLSearchParams({ select: "id", ...filters });
        const { count } = await supabaseRest(`${table}?${params.toString()}`, {
          method: "HEAD",
          headers: { Prefer: "count=exact" },
        });
        return count;
      };

      const [totalTasks, doneTasks, overdueTasks, createdToday, spaces, activeUsers] = await Promise.all([
        count("tasks", {}),
        count("tasks", { status: "eq.Concluído" }),
        count("tasks", { due_date: `lt.${today}`, status: `not.eq.Concluído` }),
        count("tasks", { created_at: `gte.${startOfDay.toISOString()}` }),
        count("spaces", {}),
        count("profiles", { is_active: "eq.true" }),
      ]);

      return {
        total_tarefas: totalTasks,
        concluidas: doneTasks,
        atrasadas_estimativa: overdueTasks,
        criadas_hoje: createdToday,
        spaces: spaces,
        usuarios_ativos: activeUsers,
        nota: "atrasadas_estimativa considera status = 'Concluído' como referência; listas com nomes de status diferentes podem não ser contadas corretamente.",
      };
    },
  },
  {
    name: "create_task",
    description: "Cria uma nova tarefa em uma lista existente.",
    inputSchema: {
      type: "object",
      properties: {
        list_id: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        status: { type: "string", description: "Ex: 'A fazer'. Deve corresponder a um status válido da lista." },
        priority: { type: "string", description: "Ex: Baixa, Media, Alta, Urgente." },
        assignee_email: { type: "string" },
        due_date: { type: "string", description: "YYYY-MM-DD" },
        tags: { type: "array", items: { type: "string" } },
      },
      required: ["list_id", "title"],
    },
    handler: async (args) => {
      const list = await findListById(String(args.list_id));
      let assigneeId: string | null = null;
      if (args.assignee_email) assigneeId = (await findUserByEmail(String(args.assignee_email))).id;

      const body: Record<string, unknown> = {
        list_id: list.id,
        title: args.title,
        description: args.description ?? "",
      };
      if (args.status) body.status = args.status;
      if (args.priority) body.priority = args.priority;
      if (args.due_date) body.due_date = args.due_date;
      if (args.tags) body.tags = args.tags;
      if (assigneeId) body.main_assignee_id = assigneeId;

      const { data } = await supabaseRest<Array<{ id: string; title: string }>>("tasks", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: [body],
      });
      const created = data?.[0];
      if (!created) throw new Error("A tarefa foi enviada, mas o Supabase não retornou o registro criado.");
      await logActivity(created.id, assigneeId, "created", null, created.title);
      return { task_id: created.id, title: created.title };
    },
  },
  {
    name: "update_task",
    description: "Atualiza campos de uma tarefa existente: título, descrição, status, prioridade, responsável ou data de vencimento.",
    inputSchema: {
      type: "object",
      properties: {
        task_id: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        status: { type: "string" },
        priority: { type: "string" },
        assignee_email: { type: "string" },
        due_date: { type: "string", description: "YYYY-MM-DD" },
      },
      required: ["task_id"],
    },
    handler: async (args) => {
      const task = await findTaskById(String(args.task_id));
      const patch: Record<string, unknown> = {};
      for (const field of ["title", "description", "status", "priority", "due_date"] as const) {
        if (args[field] !== undefined) patch[field] = args[field];
      }
      if (args.assignee_email !== undefined) {
        patch.main_assignee_id = (await findUserByEmail(String(args.assignee_email))).id;
      }
      if (Object.keys(patch).length === 0) throw new Error("Informe ao menos um campo para atualizar.");

      await supabaseRest(`tasks?id=eq.${task.id}`, { method: "PATCH", body: patch });

      if (patch.status && patch.status !== task.status) {
        await logActivity(task.id, null, "status_changed", task.status, String(patch.status));
      }
      return { task_id: task.id, updated: patch };
    },
  },
  {
    name: "add_task_comment",
    description: "Adiciona um comentário a uma tarefa.",
    inputSchema: {
      type: "object",
      properties: { task_id: { type: "string" }, author_email: { type: "string" }, text: { type: "string" } },
      required: ["task_id", "author_email", "text"],
    },
    handler: async (args) => {
      const task = await findTaskById(String(args.task_id));
      const author = await findUserByEmail(String(args.author_email));
      const { data } = await supabaseRest<Array<{ id: string }>>("task_comments", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: [{ task_id: task.id, user_id: author.id, text: args.text }],
      });
      return { comment_id: data?.[0]?.id, task_id: task.id };
    },
  },
  {
    name: "add_checklist_item",
    description: "Adiciona um item de checklist a uma tarefa.",
    inputSchema: {
      type: "object",
      properties: { task_id: { type: "string" }, text: { type: "string" } },
      required: ["task_id", "text"],
    },
    handler: async (args) => {
      const task = await findTaskById(String(args.task_id));
      const { data } = await supabaseRest<Array<{ id: string }>>("task_checklists", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: [{ task_id: task.id, text: args.text, completed: false }],
      });
      return { checklist_item_id: data?.[0]?.id, task_id: task.id };
    },
  },
  {
    name: "toggle_checklist_item",
    description: "Marca ou desmarca um item de checklist como concluído.",
    inputSchema: {
      type: "object",
      properties: { checklist_item_id: { type: "string" }, completed: { type: "boolean" } },
      required: ["checklist_item_id", "completed"],
    },
    handler: async (args) => {
      await supabaseRest(`task_checklists?id=eq.${encodeURIComponent(String(args.checklist_item_id))}`, {
        method: "PATCH",
        body: { completed: Boolean(args.completed) },
      });
      return { checklist_item_id: args.checklist_item_id, completed: Boolean(args.completed) };
    },
  },
];

const TOOLS_BY_NAME = new Map(TOOLS.map((t) => [t.name, t]));

// ─── JSON-RPC / MCP plumbing (Streamable HTTP, sem estado de sessão) ──────

function rpcResult(id: unknown, result: unknown) {
  return { jsonrpc: "2.0", id, result };
}

function rpcError(id: unknown, code: number, message: string) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

async function handleMessage(msg: Record<string, unknown>) {
  const { method, id, params } = msg as { method?: string; id?: unknown; params?: Record<string, unknown> };

  if (method === "initialize") {
    return rpcResult(id, {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: { tools: {} },
      serverInfo: SERVER_INFO,
    });
  }

  if (method === "notifications/initialized" || method === "notifications/cancelled") {
    return null;
  }

  if (method === "ping") {
    return rpcResult(id, {});
  }

  if (method === "tools/list") {
    return rpcResult(id, {
      tools: TOOLS.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })),
    });
  }

  if (method === "tools/call") {
    const name = String(params?.name ?? "");
    const tool = TOOLS_BY_NAME.get(name);
    if (!tool) {
      return rpcResult(id, { content: [{ type: "text", text: `Ferramenta desconhecida: ${name}` }], isError: true });
    }
    try {
      const result = await tool.handler((params?.arguments as Record<string, unknown>) ?? {});
      return rpcResult(id, { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return rpcResult(id, { content: [{ type: "text", text: `Erro: ${message}` }], isError: true });
    }
  }

  if (id === undefined) return null; // notificação desconhecida: ignora
  return rpcError(id, -32601, `Método não suportado: ${method}`);
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "not_found" }, 404);
  }

  if (!(await isAuthorized(req, url))) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(rpcError(null, -32700, "Parse error"), 400);
  }

  if (Array.isArray(body)) {
    const results = (await Promise.all(body.map((m) => handleMessage(m as Record<string, unknown>)))).filter(
      (r) => r !== null,
    );
    if (results.length === 0) return new Response(null, { status: 202, headers: CORS_HEADERS });
    return jsonResponse(results);
  }

  const result = await handleMessage(body as Record<string, unknown>);
  if (result === null) return new Response(null, { status: 202, headers: CORS_HEADERS });
  return jsonResponse(result);
});
