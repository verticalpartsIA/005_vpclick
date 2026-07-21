import { toast } from 'sonner';

// Deploy é estático (build sobrescreve os arquivos direto no servidor, sem
// invalidação de CDN/versionamento) — uma aba deixada aberta pode continuar
// rodando o bundle antigo por horas/dias depois de uma atualização. Este
// módulo verifica periodicamente `version.json` (gerado a cada build pelo
// plugin em vite.config.ts) e avisa o usuário quando uma versão mais nova
// foi publicada, sem forçar o reload (evita perder algo que a pessoa esteja
// digitando).
const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutos
const FIRST_CHECK_DELAY_MS = 15 * 1000; // dá um tempo antes da primeira checagem

interface VersionInfo {
  buildTime: string;
  commit: string;
}

function formatUpdateMessage(buildTime: string): string {
  const d = new Date(buildTime);
  if (isNaN(d.getTime())) return 'Este site foi atualizado.';
  const date = d.toLocaleDateString('pt-BR');
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `Este site foi atualizado em ${date} às ${time}h`;
}

export function startVersionCheck(): () => void {
  let notified = false;
  const currentBuildTime = __APP_BUILD_TIME__;

  const check = async () => {
    if (notified) return;
    try {
      const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return;
      const info: VersionInfo = await res.json();
      if (info.buildTime && info.buildTime !== currentBuildTime) {
        notified = true;
        toast.message(formatUpdateMessage(info.buildTime), {
          description: 'Atualize a página para usar a versão mais recente.',
          duration: Infinity,
          action: {
            label: 'Atualizar agora',
            onClick: () => window.location.reload(),
          },
        });
      }
    } catch {
      // Rede instável/offline — tenta de novo no próximo ciclo, sem incomodar.
    }
  };

  const firstCheckTimer = setTimeout(check, FIRST_CHECK_DELAY_MS);
  const interval = setInterval(check, CHECK_INTERVAL_MS);
  const onVisibilityChange = () => {
    if (document.visibilityState === 'visible') check();
  };
  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('online', check);

  return () => {
    clearTimeout(firstCheckTimer);
    clearInterval(interval);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('online', check);
  };
}
