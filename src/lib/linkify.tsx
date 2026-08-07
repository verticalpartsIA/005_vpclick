import React from 'react';

// Detecta URLs dentro de um texto solto (descrição de tarefa, nome de anexo
// do tipo link, comentário, etc.) e devolve nós React com essas URLs como <a>
// clicáveis, preservando o resto do texto como está. Pontuação comum no fim
// de frase (. , ; : ! ? ) ] ' ") fica de fora do link.
const LINKIFY_URL_PATTERN = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;

export function linkifyText(text: string): React.ReactNode[] {
  if (!text) return [];
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const regex = new RegExp(LINKIFY_URL_PATTERN);
  while ((match = regex.exec(text)) !== null) {
    let url = match[0];
    let trailing = '';
    while (url.length && /[.,;:!?)\]'"]$/.test(url)) {
      trailing = url.slice(-1) + trailing;
      url = url.slice(0, -1);
    }
    if (!url) { lastIndex = match.index + match[0].length; continue; }
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    const href = url.startsWith('http') ? url : `https://${url}`;
    nodes.push(
      <a
        key={match.index}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 underline hover:text-blue-800"
        onClick={(e) => e.stopPropagation()}
      >
        {url}
      </a>
    );
    if (trailing) nodes.push(trailing);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}
