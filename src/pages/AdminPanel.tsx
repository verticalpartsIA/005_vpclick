import React, { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import {
  ChevronDown,
  ChevronUp,
  Search,
  UserPlus,
  Key,
  Trash2,
  Camera,
  ShieldCheck,
  Users,
  RefreshCw,
} from "lucide-react";

import { Folder, Space, User, UserRole } from "@/types";
import { supabase } from "@/lib/supabase";
import AdminPasswordModal from "@/components/AdminPasswordModal";

type UserAccess = Record<string, { spaceIds: string[]; folderIds: string[] }>;

const createUserSchema = z.object({
  name: z.string().trim().min(2, "Informe um nome").max(80, "Nome muito longo"),
  email: z.string().trim().email("Email inválido").max(255, "Email muito longo"),
  avatar: z.string().trim().url("Avatar deve ser uma URL").max(2048, "URL muito longa"),
  role: z.nativeEnum(UserRole),
});

type AdminPanelProps = {
  spaces: Space[];
  folders: Folder[];
  users: User[];
  access: UserAccess;
  onAdminUpdateRole: (userId: string, role: UserRole) => Promise<void>;
  onAdminUpdateAccess: (userId: string, spaceIds: string[], folderIds: string[]) => Promise<void>;
  onAdminDeleteUser: (userId: string) => Promise<void>;
  onAdminCreateUser: (user: Partial<User>, password?: string) => Promise<User>;
  onAdminUpdateAvatar: (userId: string, avatarUrl: string) => Promise<void>;
  onAdminUpdatePassword: (userId: string, newPassword: string) => Promise<void>;
  onBack: () => void;
};

function generateTempPassword(length = 10) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#$%";
  let out = "";
  for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

const ROLE_COLORS: Record<UserRole, string> = {
  [UserRole.ADMIN]:        "bg-purple-100 text-purple-700 border-purple-200",
  [UserRole.GESTOR]:       "bg-blue-100 text-blue-700 border-blue-200",
  [UserRole.COLABORADOR]:  "bg-gray-100 text-gray-600 border-gray-200",
};

const ROLE_LABEL: Record<UserRole, string> = {
  [UserRole.ADMIN]:       "Admin",
  [UserRole.GESTOR]:      "Gestor",
  [UserRole.COLABORADOR]: "Colaborador",
};

// ─── Avatar com initials fallback ─────────────────────────────
function UserAvatar({ user, size = "md" }: { user: User; size?: "sm" | "md" | "lg" }) {
  const [err, setErr] = useState(false);
  // Volta a tentar carregar a imagem quando a URL do avatar mudar
  useEffect(() => { setErr(false); }, [user.avatar]);
  const initials = user.name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  const sz = size === "sm" ? "h-8 w-8 text-xs" : size === "lg" ? "h-14 w-14 text-base" : "h-10 w-10 text-sm";
  const colors = ["bg-violet-500","bg-blue-500","bg-emerald-500","bg-amber-500","bg-rose-500","bg-indigo-500"];
  const bg = colors[user.name.charCodeAt(0) % colors.length];

  if (err || !user.avatar) {
    return (
      <span className={`${sz} rounded-full ${bg} flex items-center justify-center font-bold text-white ring-2 ring-white shadow-sm`}>
        {initials}
      </span>
    );
  }
  return (
    <img
      src={user.avatar}
      alt={user.name}
      onError={() => setErr(true)}
      className={`${sz} rounded-full object-cover ring-2 ring-white shadow-sm`}
    />
  );
}

export default function AdminPanel({
  spaces,
  folders,
  users,
  access,
  onAdminUpdateRole,
  onAdminUpdateAccess,
  onAdminDeleteUser,
  onAdminCreateUser,
  onAdminUpdateAvatar,
  onAdminUpdatePassword,
  onBack,
}: AdminPanelProps) {
  // ── Criar usuário ──────────────────────────────────────────
  const [form, setForm] = useState({
    name: "",
    email: "",
    avatar: "https://picsum.photos/seed/new-user/100",
    role: UserRole.COLABORADOR as UserRole,
  });
  const [tempPassword, setTempPassword] = useState(() => generateTempPassword());
  const [formError, setFormError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // ── Lista de usuários ──────────────────────────────────────
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [resetPasswordUserId, setResetPasswordUserId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const filteredUsers = useMemo(() => {
    const q = search.toLowerCase().trim();
    const base = !q
      ? users
      : users.filter(
          (u) =>
            u.name.toLowerCase().includes(q) ||
            u.email.toLowerCase().includes(q) ||
            u.role.toLowerCase().includes(q)
        );
    return [...base].sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));
  }, [users, search]);

  const toggle = (id: string) => setExpandedId((prev) => (prev === id ? null : id));

  // ── Handlers ──────────────────────────────────────────────
  const handleCreateUser = async () => {
    const parsed = createUserSchema.safeParse(form);
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }
    const emailLower = parsed.data.email.toLowerCase();
    if (users.some((u) => u.email.toLowerCase() === emailLower)) {
      setFormError("Já existe um usuário com este email.");
      return;
    }
    setIsCreating(true);
    setFormError(null);
    try {
      await onAdminCreateUser(
        { name: parsed.data.name, email: parsed.data.email, avatar: parsed.data.avatar, role: parsed.data.role },
        tempPassword
      );
      setTempPassword(generateTempPassword());
      setForm({ name: "", email: "", avatar: "https://picsum.photos/seed/new-user/100", role: UserRole.COLABORADOR });
    } catch (err: any) {
      setFormError(err.message || "Erro ao criar usuário.");
    } finally {
      setIsCreating(false);
    }
  };

  const toggleSpace = (userId: string, spaceId: string) => {
    const current = access[userId] || { spaceIds: [], folderIds: [] };
    const isChecking = !current.spaceIds.includes(spaceId);
    const spaceFolderIds = folders.filter((f) => f.spaceId === spaceId).map((f) => f.id);
    const nextSpaceIds = isChecking
      ? [...current.spaceIds, spaceId]
      : current.spaceIds.filter((id) => id !== spaceId);
    const nextFolderIds = isChecking
      ? [...new Set([...current.folderIds, ...spaceFolderIds])]
      : current.folderIds.filter((id) => !spaceFolderIds.includes(id));
    onAdminUpdateAccess(userId, nextSpaceIds, nextFolderIds);
  };

  const toggleFolder = (userId: string, folderId: string, spaceId: string) => {
    const current = access[userId] || { spaceIds: [], folderIds: [] };
    const nextFolderIds = current.folderIds.includes(folderId)
      ? current.folderIds.filter((id) => id !== folderId)
      : [...current.folderIds, folderId];
    let nextSpaceIds = current.spaceIds;
    if (!current.folderIds.includes(folderId) && !current.spaceIds.includes(spaceId)) {
      nextSpaceIds = [...current.spaceIds, spaceId];
    }
    onAdminUpdateAccess(userId, nextSpaceIds, nextFolderIds);
  };

  const handleAvatarUpload = async (userId: string, file: File) => {
    const fileExt = file.name.split(".").pop();
    const filePath = `avatars/${userId}-${Math.random()}.${fileExt}`;
    setUploadingId(userId);
    try {
      const { error: uploadError } = await supabase.storage.from("avatars").upload(filePath, file);
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
      if (data?.publicUrl) await onAdminUpdateAvatar(userId, data.publicUrl);
    } catch (err: any) {
      alert("Erro ao fazer upload do avatar: " + err.message);
    } finally {
      setUploadingId(null);
    }
  };

  // ── Render ─────────────────────────────────────────────────
  return (
    <section className="space-y-6">
      {/* Header */}
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Painel do Administrador</h2>
          <p className="text-sm text-gray-500">Gerenciamento de usuários e permissões de acesso ao sistema.</p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="rounded-md border bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          Voltar
        </button>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ── Col 1: Criar usuário ───────────────────────────── */}
        <div className="rounded-xl border bg-white p-5 shadow-sm lg:col-span-1 self-start">
          <div className="flex items-center gap-2 mb-5">
            <div className="p-1.5 rounded-lg bg-[var(--primary-color)]/15">
              <UserPlus className="w-4 h-4 text-[var(--primary-color)]" />
            </div>
            <h3 className="text-sm font-bold text-gray-900">Novo usuário</h3>
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600">Nome</label>
              <input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className="h-9 w-full rounded-lg border bg-gray-50 px-3 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-[var(--primary-color)]"
                placeholder="Ex.: João Silva"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600">Email</label>
              <input
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                className="h-9 w-full rounded-lg border bg-gray-50 px-3 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-[var(--primary-color)]"
                placeholder="joao@empresa.com"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600">Avatar (URL)</label>
              <input
                value={form.avatar}
                onChange={(e) => setForm((p) => ({ ...p, avatar: e.target.value }))}
                className="h-9 w-full rounded-lg border bg-gray-50 px-3 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-[var(--primary-color)]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600">Papel</label>
              <select
                value={form.role}
                onChange={(e) => setForm((p) => ({ ...p, role: e.target.value as UserRole }))}
                className="h-9 w-full rounded-lg border bg-gray-50 px-3 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-[var(--primary-color)]"
              >
                <option value={UserRole.ADMIN}>ADMIN</option>
                <option value={UserRole.GESTOR}>GESTOR</option>
                <option value={UserRole.COLABORADOR}>COLABORADOR</option>
              </select>
            </div>

            {/* Senha temporária */}
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
              <p className="text-xs font-semibold text-blue-700">Senha para primeiro acesso</p>
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <code className="rounded bg-white px-2 py-1 text-xs text-blue-900 font-bold tracking-wider border border-blue-100">
                  {tempPassword}
                </code>
                <button
                  type="button"
                  onClick={() => setTempPassword(generateTempPassword())}
                  className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800"
                >
                  <RefreshCw className="w-3 h-3" />
                  Nova
                </button>
              </div>
            </div>

            {formError && (
              <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs font-semibold text-red-600">
                {formError}
              </p>
            )}

            <button
              type="button"
              onClick={handleCreateUser}
              disabled={isCreating}
              className="h-10 w-full rounded-lg bg-[var(--primary-color)] px-4 text-sm font-bold text-[#2c3e50] hover:brightness-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isCreating ? "Criando..." : "Criar usuário"}
            </button>
          </div>
        </div>

        {/* ── Col 2+3: Lista de usuários ─────────────────────── */}
        <div className="rounded-xl border bg-white shadow-sm lg:col-span-2 overflow-hidden">
          {/* Cabeçalho */}
          <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-gray-100">
                <Users className="w-4 h-4 text-gray-600" />
              </div>
              <h3 className="text-sm font-bold text-gray-900">Usuários</h3>
              <span className="ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-500">
                {filteredUsers.length}
              </span>
            </div>

            {/* Campo de pesquisa */}
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome, email ou papel..."
                className="h-9 w-full rounded-lg border bg-gray-50 pl-9 pr-3 text-xs outline-none focus:bg-white focus:ring-2 focus:ring-[var(--primary-color)]"
              />
            </div>
          </div>

          {/* Lista */}
          <div className="divide-y">
            {filteredUsers.length === 0 && (
              <p className="py-12 text-center text-sm text-gray-400 italic">
                {search ? "Nenhum usuário encontrado." : "Nenhum usuário cadastrado."}
              </p>
            )}

            {filteredUsers.map((u) => {
              const isOpen = expandedId === u.id;
              const userAccess = access[u.id] || { spaceIds: [], folderIds: [] };
              const accessCount = userAccess.spaceIds.length;
              const isAdmin = u.role === UserRole.ADMIN;

              return (
                <div key={u.id} className="group">
                  {/* ── Linha compacta (sempre visível) ───────── */}
                  <button
                    type="button"
                    onClick={() => toggle(u.id)}
                    className={`w-full flex items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-gray-50 ${
                      isOpen ? "bg-gray-50" : ""
                    }`}
                  >
                    {/* Avatar */}
                    <div className="relative shrink-0">
                      <UserAvatar user={u} size="md" />
                      {isAdmin && (
                        <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-purple-600 p-0.5 ring-1 ring-white">
                          <ShieldCheck className="w-2.5 h-2.5 text-white" />
                        </span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{u.name}</p>
                      <p className="text-xs text-gray-500 truncate">{u.email}</p>
                    </div>

                    {/* Badge papel */}
                    <span
                      className={`shrink-0 hidden sm:inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                        ROLE_COLORS[u.role]
                      }`}
                    >
                      {ROLE_LABEL[u.role]}
                    </span>

                    {/* Acesso count */}
                    {!isAdmin && (
                      <span className="shrink-0 hidden sm:inline-flex items-center gap-1 text-[11px] text-gray-400">
                        <span className="font-bold text-gray-600">{accessCount}</span> espaço{accessCount !== 1 ? "s" : ""}
                      </span>
                    )}
                    {isAdmin && (
                      <span className="shrink-0 hidden sm:inline-flex text-[11px] text-purple-500 font-medium">
                        acesso total
                      </span>
                    )}

                    {/* Chevron */}
                    <span className="shrink-0 text-gray-400 transition-transform">
                      {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </span>
                  </button>

                  {/* ── Painel expandido ───────────────────────── */}
                  {isOpen && (
                    <div className="border-t bg-gray-50/60 px-5 py-4 space-y-5">
                      {/* Ações rápidas */}
                      <div className="flex flex-wrap items-center gap-3">
                        {/* Avatar upload */}
                        <label className="relative cursor-pointer">
                          <div className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors shadow-sm">
                            {uploadingId === u.id ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin text-gray-500" />
                            ) : (
                              <Camera className="w-3.5 h-3.5 text-gray-500" />
                            )}
                            Alterar foto
                          </div>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              if (e.target.files?.[0]) handleAvatarUpload(u.id, e.target.files[0]);
                              // Permite selecionar o mesmo arquivo novamente
                              e.target.value = "";
                            }}
                          />
                        </label>

                        {/* Papel */}
                        <select
                          value={u.role}
                          onChange={(e) => onAdminUpdateRole(u.id, e.target.value as UserRole)}
                          className="h-9 rounded-lg border bg-white px-3 text-xs font-bold outline-none focus:ring-2 focus:ring-[var(--primary-color)] shadow-sm"
                        >
                          <option value={UserRole.ADMIN}>ADMIN</option>
                          <option value={UserRole.GESTOR}>GESTOR</option>
                          <option value={UserRole.COLABORADOR}>COLABORADOR</option>
                        </select>

                        {/* Senha */}
                        <button
                          type="button"
                          onClick={() => setResetPasswordUserId(u.id)}
                          className="flex items-center gap-1.5 rounded-lg border bg-white px-3 py-2 text-xs font-semibold text-amber-600 hover:bg-amber-50 hover:border-amber-200 transition-colors shadow-sm"
                        >
                          <Key className="w-3.5 h-3.5" />
                          Alterar senha
                        </button>

                        {/* Excluir */}
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Excluir ${u.name}? Esta ação não pode ser desfeita.`)) {
                              onAdminDeleteUser(u.id);
                              setExpandedId(null);
                            }
                          }}
                          className="flex items-center gap-1.5 rounded-lg border bg-white px-3 py-2 text-xs font-semibold text-red-500 hover:bg-red-50 hover:border-red-200 transition-colors shadow-sm ml-auto"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Excluir
                        </button>
                      </div>

                      {/* Controle de Acesso */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">
                            Controle de Acesso
                          </p>
                          {isAdmin && (
                            <span className="text-[11px] text-purple-500 font-medium italic">
                              Admins têm acesso total por padrão
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {spaces.map((s) => {
                            const isSpaceChecked = isAdmin || userAccess.spaceIds.includes(s.id);
                            const spaceFolders = folders.filter((f) => f.spaceId === s.id);
                            const checkedFolders = spaceFolders.filter((f) =>
                              isAdmin || userAccess.folderIds.includes(f.id)
                            );

                            return (
                              <div
                                key={s.id}
                                className={`rounded-xl border bg-white p-3 shadow-sm transition-all ${
                                  isSpaceChecked
                                    ? "border-[var(--primary-color)]/40 bg-[var(--primary-color)]/5"
                                    : "hover:border-gray-300"
                                }`}
                              >
                                <label className={`flex items-center gap-2.5 ${isAdmin ? "cursor-default" : "cursor-pointer"}`}>
                                  <input
                                    type="checkbox"
                                    checked={isSpaceChecked}
                                    disabled={isAdmin}
                                    onChange={() => !isAdmin && toggleSpace(u.id, s.id)}
                                    className="h-4 w-4 rounded border-gray-300 accent-[var(--primary-color)]"
                                  />
                                  <span className="text-xs font-bold text-gray-800 flex-1 leading-tight">
                                    {s.name}
                                  </span>
                                  {spaceFolders.length > 0 && (
                                    <span className="text-[10px] text-gray-400 font-medium">
                                      {checkedFolders.length}/{spaceFolders.length}
                                    </span>
                                  )}
                                </label>

                                {spaceFolders.length > 0 && (
                                  <div className="mt-2.5 ml-6 space-y-1.5 border-l-2 border-gray-100 pl-3">
                                    {spaceFolders.map((f) => {
                                      const checked = isAdmin || userAccess.folderIds.includes(f.id);
                                      return (
                                        <label
                                          key={f.id}
                                          className={`flex items-center gap-2 ${isAdmin ? "cursor-default" : "cursor-pointer"}`}
                                        >
                                          <input
                                            type="checkbox"
                                            checked={checked}
                                            disabled={isAdmin}
                                            onChange={() => !isAdmin && toggleFolder(u.id, f.id, s.id)}
                                            className="h-3 w-3 rounded border-gray-300 accent-[var(--primary-color)]"
                                          />
                                          <span
                                            className={`text-[11px] leading-tight ${
                                              checked ? "text-gray-700 font-medium" : "text-gray-400"
                                            }`}
                                          >
                                            {f.name}
                                          </span>
                                        </label>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Modal senha */}
      {resetPasswordUserId && (
        <AdminPasswordModal
          userName={users.find((u) => u.id === resetPasswordUserId)?.name || "Usuário"}
          onClose={() => setResetPasswordUserId(null)}
          onSave={async (pwd) => {
            await onAdminUpdatePassword(resetPasswordUserId, pwd);
          }}
        />
      )}
    </section>
  );
}
