import React, { useMemo, useState } from "react";
import { z } from "zod";

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
  onBack
}: AdminPanelProps) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    avatar: "https://picsum.photos/seed/new-user/100",
    role: UserRole.COLABORADOR as UserRole,
  });
  const [tempPassword, setTempPassword] = useState(() => generateTempPassword());
  const [error, setError] = useState<string | null>(null);

  const spacesById = useMemo(() => new Map(spaces.map((s) => [s.id, s])), [spaces]);

  const [isLoading, setIsLoading] = useState(false);
  const [resetPasswordUserId, setResetPasswordUserId] = useState<string | null>(null);

  const handleCreateUser = async () => {
    const parsed = createUserSchema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }

    const emailLower = parsed.data.email.toLowerCase();
    const exists = users.some((u) => u.email.toLowerCase() === emailLower);
    if (exists) {
      setError("Já existe um usuário com este email.");
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      await onAdminCreateUser({
        name: parsed.data.name,
        email: parsed.data.email,
        avatar: parsed.data.avatar,
        role: parsed.data.role
      }, tempPassword);

      setTempPassword(generateTempPassword());
      setForm({
        name: "",
        email: "",
        avatar: "https://picsum.photos/seed/new-user/100",
        role: UserRole.COLABORADOR,
      });
      alert('Usuário criado com sucesso!');
    } catch (err: any) {
      setError(err.message || "Erro ao criar usuário.");
    } finally {
      setIsLoading(false);
    }
  };

  const setUserRole = (userId: string, role: UserRole) => {
    onAdminUpdateRole(userId, role);
  };

  const toggleSpace = (userId: string, spaceId: string) => {
    const current = access[userId] || { spaceIds: [], folderIds: [] };
    const isChecking = !current.spaceIds.includes(spaceId);

    let nextSpaceIds = isChecking
      ? [...current.spaceIds, spaceId]
      : current.spaceIds.filter((id) => id !== spaceId);

    const spaceFolderIds = folders.filter(f => f.spaceId === spaceId).map(f => f.id);
    let nextFolderIds = isChecking
      ? [...new Set([...current.folderIds, ...spaceFolderIds])]
      : current.folderIds.filter(id => !spaceFolderIds.includes(id));

    onAdminUpdateAccess(userId, nextSpaceIds, nextFolderIds);
  };

  const toggleFolder = (userId: string, folderId: string, spaceId: string) => {
    const current = access[userId] || { spaceIds: [], folderIds: [] };
    const nextFolderIds = current.folderIds.includes(folderId)
      ? current.folderIds.filter(id => id !== folderId)
      : [...current.folderIds, folderId];

    let nextSpaceIds = current.spaceIds;
    if (!current.folderIds.includes(folderId) && !current.spaceIds.includes(spaceId)) {
      nextSpaceIds = [...current.spaceIds, spaceId];
    }

    onAdminUpdateAccess(userId, nextSpaceIds, nextFolderIds);
  };

  const deleteUser = (userId: string) => {
    onAdminDeleteUser(userId);
  };

  const handleResetPassword = (userId: string) => {
    setResetPasswordUserId(userId);
  };

  const handleSaveNewPassword = async (password: string) => {
    if (resetPasswordUserId) {
      await onAdminUpdatePassword(resetPasswordUserId, password);
    }
  };

  const handleAvatarUpload = async (userId: string, file: File) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}-${Math.random()}.${fileExt}`;
    const filePath = `avatars/${fileName}`;

    try {
      setIsLoading(true);
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      if (data?.publicUrl) {
        await onAdminUpdateAvatar(userId, data.publicUrl);
        alert('Avatar atualizado com sucesso!');
      }
    } catch (err: any) {
      alert('Erro ao fazer upload do avatar: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Painel do Administrador</h2>
          <p className="text-sm text-gray-600">
            Gerenciamento de usuários e permissões de acesso ao sistema.
          </p>
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
        {/* Criar usuário */}
        <div className="rounded-xl border bg-white p-4 lg:col-span-1">
          <h3 className="text-sm font-bold text-gray-900">Criar novo usuário</h3>
          <div className="mt-4 space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-700">Nome</label>
              <input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className="h-10 w-full rounded-md border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--primary-color)]"
                placeholder="Ex.: João Silva"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-700">Email</label>
              <input
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                className="h-10 w-full rounded-md border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--primary-color)]"
                placeholder="ex.: joao@empresa.com"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-700">Avatar (URL)</label>
              <input
                value={form.avatar}
                onChange={(e) => setForm((p) => ({ ...p, avatar: e.target.value }))}
                className="h-10 w-full rounded-md border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--primary-color)]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-700">Papel</label>
              <select
                value={form.role}
                onChange={(e) => setForm((p) => ({ ...p, role: e.target.value as UserRole }))}
                className="h-10 w-full rounded-md border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--primary-color)]"
              >
                <option value={UserRole.ADMIN}>ADMIN</option>
                <option value={UserRole.GESTOR}>GESTOR</option>
                <option value={UserRole.COLABORADOR}>COLABORADOR</option>
              </select>
            </div>

            <div className="rounded-lg border bg-blue-50 p-3">
              <p className="text-xs font-semibold text-blue-700">Senha definida</p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <code className="rounded bg-white px-2 py-1 text-xs text-blue-900 font-bold">{tempPassword}</code>
                <button
                  type="button"
                  onClick={() => setTempPassword(generateTempPassword())}
                  className="text-xs font-semibold text-blue-700 underline"
                >
                  Gerar outra
                </button>
              </div>
              <p className="mt-2 text-[11px] text-blue-600 font-medium">Esta senha será necessária para o primeiro acesso do usuário.</p>
            </div>

            {error && <p className="text-sm font-semibold text-red-600">{error}</p>}

            <button
              type="button"
              onClick={handleCreateUser}
              disabled={isLoading}
              className="h-10 w-full rounded-md bg-[var(--primary-color)] px-4 text-sm font-bold text-[#2c3e50] hover:brightness-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Criando..." : "Criar usuário"}
            </button>
          </div>
        </div>

        {/* Lista de usuários */}
        <div className="rounded-xl border bg-white p-4 lg:col-span-2">
          <h3 className="text-sm font-bold text-gray-900">Usuários</h3>

          <div className="mt-4 space-y-4">
            {users.map((u) => {
              const userAccess = access[u.id] || { spaceIds: [], folderIds: [] };
              const spaceLabels = userAccess.spaceIds
                .map((id) => spacesById.get(id)?.name)
                .filter(Boolean)
                .join(", ");

              return (
                <div key={u.id} className="rounded-lg border p-4 bg-gray-50/30">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b pb-4 mb-4">
                    <div className="flex items-center gap-3">
                      <label className="relative cursor-pointer group">
                        <img src={u.avatar} alt={`Avatar de ${u.name}`} className="h-12 w-12 rounded-full border-2 border-white shadow-sm object-cover" />
                        <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              handleAvatarUpload(u.id, e.target.files[0]);
                            }
                          }}
                        />
                      </label>
                      <div>
                        <p className="text-sm font-bold text-gray-900">{u.name}</p>
                        <p className="text-xs text-gray-600">{u.email}</p>
                        <p className="mt-1 text-[11px] text-gray-400 font-medium bg-gray-100 rounded px-1.5 py-0.5 inline-block">
                          {u.role}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 sm:items-end">
                      <select
                        value={u.role}
                        onChange={(e) => setUserRole(u.id, e.target.value as UserRole)}
                        className="h-9 rounded-md border bg-white px-3 text-xs font-bold outline-none focus:ring-2 focus:ring-[var(--primary-color)] transition-all"
                      >
                        <option value={UserRole.ADMIN}>ADMIN</option>
                        <option value={UserRole.GESTOR}>GESTOR</option>
                        <option value={UserRole.COLABORADOR}>COLABORADOR</option>
                      </select>

                      <div className="flex gap-3 mt-1">
                        <button
                          type="button"
                          onClick={() => handleResetPassword(u.id)}
                          className="text-[11px] font-bold text-orange-500 hover:text-orange-700 transition-colors uppercase tracking-wider"
                        >
                          Alterar Senha
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteUser(u.id)}
                          className="text-[11px] font-bold text-red-500 hover:text-red-700 transition-colors uppercase tracking-wider"
                        >
                          Excluir Usuário
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Controle de Acesso</p>
                      <p className="text-[10px] text-gray-400 italic">Administradores têm acesso total por padrão</p>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {spaces.map((s) => {
                        const isSpaceChecked = userAccess.spaceIds.includes(s.id);
                        const spaceFolders = folders.filter(f => f.spaceId === s.id);

                        return (
                          <div key={s.id} className="bg-white rounded-xl border p-3 shadow-sm group transition-all hover:border-[var(--primary-color)]/30">
                            <label className="flex items-center gap-3 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isSpaceChecked}
                                onChange={() => toggleSpace(u.id, s.id)}
                                className="h-4 w-4 rounded border-gray-300 text-[var(--primary-color)] focus:ring-[var(--primary-color)]"
                              />
                              <span className="text-xs font-bold text-gray-800 flex-1">{s.name}</span>
                            </label>

                            {spaceFolders.length > 0 && (
                              <div className="mt-3 ml-7 space-y-2 border-l-2 border-gray-50 pl-3">
                                {spaceFolders.map(f => {
                                  const isFolderChecked = userAccess.folderIds.includes(f.id);
                                  return (
                                    <label key={f.id} className="flex items-center gap-2 cursor-pointer group/folder">
                                      <input
                                        type="checkbox"
                                        checked={isFolderChecked}
                                        onChange={() => toggleFolder(u.id, f.id, s.id)}
                                        className="h-3.5 w-3.5 rounded border-gray-300 text-[var(--primary-color)] focus:ring-[var(--primary-color)]"
                                      />
                                      <span className={`text-[11px] transition-colors ${isFolderChecked ? 'text-gray-700 font-semibold' : 'text-gray-400'}`}>
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
              );
            })}

            {users.length === 0 && <p className="text-sm text-gray-600 text-center py-10 italic">Nenhum usuário cadastrado.</p>}
          </div>
        </div>
      </div>

      {resetPasswordUserId && (
        <AdminPasswordModal
          userName={users.find(u => u.id === resetPasswordUserId)?.name || "Usuário"}
          onClose={() => setResetPasswordUserId(null)}
          onSave={handleSaveNewPassword}
        />
      )}
    </section>
  );
}
