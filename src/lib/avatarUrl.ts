// O storage de avatar vive no projeto Supabase do portal (vpsistema), fora
// do VPClick — cada satélite só guarda a URL pública em `profiles.avatar`.
// Vários avatares são fotos originais de celular sem nenhuma compressão
// (1-1,4 MB cada, confirmado via auditoria Lighthouse: eram o maior item de
// payload da página, explicando boa parte do Speed Index ruim).
//
// Não temos (nem devemos ter) acesso de escrita ao storage de outro
// sistema — a correção certa é pedir uma versão redimensionada via Image
// Transformation do Supabase, recurso nativo do storage que já está
// habilitado nesse projeto (confirmado: o mesmo arquivo de 1,4 MB cai pra
// ~24 KB pedindo 128x128 — 98% menor, sem tocar em nenhum arquivo).
const OBJECT_PATH = '/storage/v1/object/public/';
const RENDER_PATH = '/storage/v1/render/image/public/';

// 128px cobre com folga o maior avatar renderizado hoje na UI (56px, o
// tamanho "lg" do Avatar do AdminPanel) considerando telas retina (2x) —
// uma constante única pra toda a UI, mais simples que calibrar por lugar.
const AVATAR_TRANSFORM_SIZE = 128;

// Passa direto (sem transformar) qualquer URL que não seja um objeto público
// de storage do Supabase — placeholder do picsum.photos, vazio/undefined,
// ou qualquer outra origem. Nunca inventa uma URL nova nem muda o
// comportamento de fallback existente em cada chamador.
export function avatarThumb<T extends string | null | undefined>(url: T): T {
  if (!url || !url.includes(OBJECT_PATH)) return url;
  const base = url.replace(OBJECT_PATH, RENDER_PATH);
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}width=${AVATAR_TRANSFORM_SIZE}&height=${AVATAR_TRANSFORM_SIZE}&resize=cover&quality=70` as T;
}
