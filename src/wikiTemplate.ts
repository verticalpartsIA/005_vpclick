// Conteúdo inicial da "Wiki Interna" (Doc raiz + 10 subpáginas), usado pelo
// atalho "Criar Wiki". Serve só de rascunho — cada área ajusta o texto depois.

export const WIKI_INTRO_HTML = `
<h2>Como usar esta wiki</h2>
<p>Esta é a fonte única da verdade da equipe: processos, procedimentos, políticas, manuais de sistema, responsáveis e respostas para as dúvidas que se repetem. Cada subpágina abaixo já vem com um rascunho — quem for dono da área ajusta e completa.</p>
<ul>
<li><strong>Regra de ouro:</strong> se duas pessoas já perguntaram a mesma coisa, a resposta vira página aqui — não fica só na conversa do WhatsApp.</li>
<li><strong>Tom:</strong> direto e prático, sem enfeite. Quem lê está tentando resolver algo agora.</li>
<li><strong>Dono, não arquivo morto:</strong> toda página tem uma pessoa responsável por mantê-la certa.</li>
</ul>
`;

export const WIKI_TEMPLATE_SECTIONS: { title: string; html: string }[] = [
  {
    title: '01. Visão geral da empresa/equipe',
    html: `
<p>Contexto que todo mundo que entra precisa ter — a página que você manda pra alguém no primeiro dia em vez de explicar tudo de novo.</p>
<h3>O que documentar aqui</h3>
<ul>
<li>O que a empresa faz, para quem, e onde cada área entra no negócio.</li>
<li>Organograma real (quem lidera cada área, não só o nome no crachá).</li>
<li>Os espaços/times do VP Click e o que cada um cobre.</li>
<li>Como as áreas se conectam num fluxo ponta a ponta.</li>
</ul>
<h3>Estrutura sugerida de subpáginas</h3>
<ul>
<li>Quem somos e o que fazemos</li>
<li>Organograma</li>
<li>Mapa de áreas e espaços do VP Click</li>
<li>Como as áreas trabalham juntas</li>
</ul>
<h3>Como preencher</h3>
<p>Peça validação de quem lidera Gente &amp; Gestão antes de publicar o organograma — é a página mais citada em onboarding.</p>
`
  },
  {
    title: '02. Processos internos',
    html: `
<p>O caminho que uma coisa percorre entre áreas, de ponta a ponta. Diferente do procedimento (próxima página), que é o passo a passo dentro de uma única tarefa.</p>
<h3>O que documentar aqui</h3>
<ul>
<li>Do orçamento à entrega: proposta → aprovação → requisição de peças → compra → logística → execução → checklist final.</li>
<li>Abertura e resolução de chamado de suporte interno.</li>
<li>Fluxo de aprovação de compra: quem pede, quem aprova, a partir de que valor precisa de segunda aprovação.</li>
<li>Onboarding de novo colaborador.</li>
</ul>
<h3>Estrutura sugerida de subpáginas</h3>
<ul>
<li>Comercial → Entrega</li>
<li>Compras e requisições</li>
<li>Suporte interno (abertura e escalonamento de chamado)</li>
<li>Onboarding e desligamento de colaborador</li>
</ul>
<h3>Como preencher</h3>
<p>Desenhe como lista numerada de etapas, dizendo quem faz e em qual sistema. Documente também a exceção mais comum — é normalmente aí que a dúvida aparece.</p>
`
  },
  {
    title: '03. Procedimentos operacionais',
    html: `
<p>O passo a passo de uma tarefa específica, pra alguém seguir sem precisar perguntar nada no meio.</p>
<h3>O que documentar aqui</h3>
<ul>
<li>Como registrar entrada/saída de item no estoque.</li>
<li>Checklist de segurança antes de um serviço em campo.</li>
<li>Como emitir e conferir nota fiscal de compra.</li>
<li>Passo a passo de fechamento mensal financeiro.</li>
</ul>
<h3>Estrutura sugerida de subpáginas</h3>
<ul>
<li>Estoque e almoxarifado</li>
<li>Segurança em campo</li>
<li>Financeiro — rotinas mensais</li>
<li>Qualidade (ações corretivas, auditoria interna)</li>
</ul>
<h3>Como preencher</h3>
<p>Use lista numerada, um passo por linha, no imperativo. Print de tela vale mais que parágrafo quando o passo depende de clicar em algo específico.</p>
`
  },
  {
    title: '04. Políticas e regras internas',
    html: `
<p>O que é regra fixa da empresa, não sugestão de processo. Só muda com decisão formal de quem é dono dela.</p>
<h3>O que documentar aqui</h3>
<ul>
<li>Política de horário, home office e banco de horas.</li>
<li>Alçadas de aprovação por nível hierárquico.</li>
<li>Regras de segurança do trabalho.</li>
<li>Política de uso de sistemas e dados.</li>
<li>Regras de reembolso e viagem a serviço.</li>
</ul>
<h3>Estrutura sugerida de subpáginas</h3>
<ul>
<li>Jornada de trabalho e ausências</li>
<li>Alçadas de aprovação e compras</li>
<li>Segurança do trabalho</li>
<li>Acesso a sistemas e dados</li>
<li>Reembolso e despesas</li>
</ul>
<h3>Como preencher</h3>
<p>Toda política precisa citar desde quando vale e quem aprovou. Se mudar, não apague a antiga — mova pra "Decisões importantes" com a data.</p>
`
  },
  {
    title: '05. Manuais de sistemas e ferramentas',
    html: `
<p>Como usar cada ferramenta que a equipe realmente usa — não a documentação genérica do fornecedor, "como a gente usa isso aqui".</p>
<h3>O que documentar aqui</h3>
<ul>
<li>VP Click: como criar tarefa, anexar arquivo, prorrogar prazo, usar Kanban/Gantt/Calendário.</li>
<li>Como funciona o login único (SSO) e quem libera acesso a cada módulo.</li>
<li>Rotinas de uso do ERP por área.</li>
<li>Outros sistemas internos: pra que serve cada um e quando usar qual.</li>
</ul>
<h3>Estrutura sugerida de subpáginas</h3>
<ul>
<li>VP Click (uma subpágina por função)</li>
<li>Acessos e SSO</li>
<li>ERP</li>
<li>Outros sistemas internos</li>
<li>Ferramentas de comunicação</li>
</ul>
<h3>Como preencher</h3>
<p>Escreva pensando em "primeira vez usando isso". Prefira 3 passos com print a um parágrafo sem imagem.</p>
`
  },
  {
    title: '06. Perguntas frequentes',
    html: `
<p>As perguntas que chegam toda semana e que já têm resposta pronta em outro lugar da wiki. Um atalho, não conteúdo novo — cada resposta linka pra página completa.</p>
<h3>O que documentar aqui</h3>
<ul>
<li>"Como abro um chamado?" → link pro procedimento.</li>
<li>"Quem aprova compra acima de X?" → link pra alçadas.</li>
<li>"Onde vejo minhas tarefas atrasadas?" → link pro manual do VP Click.</li>
<li>"Quem é o responsável de [área] hoje?" → link pra "Responsáveis por área".</li>
</ul>
<h3>Estrutura sugerida de subpáginas</h3>
<ul>
<li>Por área</li>
<li>Sobre sistemas</li>
<li>Sobre o próprio trabalho</li>
</ul>
<h3>Como preencher</h3>
<p>Regra prática: quando alguém responder a mesma dúvida pela terceira vez num canal de chat, essa pergunta entra aqui na semana seguinte.</p>
`
  },
  {
    title: '07. Responsáveis por área',
    html: `
<p>Quem procurar quando travar em algo, sem precisar perguntar "quem cuida disso mesmo?" num grupo geral.</p>
<h3>O que documentar aqui</h3>
<ul>
<li>Nome + função de quem responde por cada área/espaço do VP Click.</li>
<li>Backup de cada responsável (quem cobre em férias/ausência).</li>
<li>Dono de cada sistema interno.</li>
</ul>
<h3>Estrutura sugerida de subpáginas</h3>
<ul>
<li>Tabela única: Área · Responsável · Backup · Contato</li>
<li>Donos de sistema</li>
</ul>
<h3>Como preencher</h3>
<p>Use tabela, não texto corrido — é página de consulta rápida. Revise a cada mudança de time.</p>
`
  },
  {
    title: '08. Modelos e documentos padrão',
    html: `
<p>Arquivos e formatos prontos pra reusar, em vez de cada pessoa criar do zero (e diferente) toda vez.</p>
<h3>O que documentar aqui</h3>
<ul>
<li>Modelo de proposta comercial.</li>
<li>Modelo de requisição de compra.</li>
<li>Modelo de checklist de execução/entrega.</li>
<li>Modelo de ata de reunião e e-mail padrão pro cliente.</li>
</ul>
<h3>Estrutura sugerida de subpáginas</h3>
<ul>
<li>Comercial</li>
<li>Operacional</li>
<li>Administrativo</li>
</ul>
<h3>Como preencher</h3>
<p>Anexe o arquivo editável (não só um print) e diga em uma linha quando usar cada modelo.</p>
`
  },
  {
    title: '09. Decisões importantes',
    html: `
<p>Registro histórico de "por que fazemos assim" — pra quando alguém novo perguntar "por que não fazemos do outro jeito" e ninguém lembrar o motivo.</p>
<h3>O que documentar aqui</h3>
<ul>
<li>Mudança de fornecedor ou de processo de compra e o motivo.</li>
<li>Adoção de um sistema novo.</li>
<li>Mudança de política (versão anterior arquivada aqui, com data).</li>
<li>Decisões de reestruturação de área.</li>
</ul>
<h3>Estrutura sugerida de subpáginas</h3>
<ul>
<li>Um registro por decisão, mais recente no topo</li>
<li>Cada registro: data · quem decidiu · o que mudou · por quê</li>
</ul>
<h3>Como preencher</h3>
<p>Escreva no momento da decisão, não meses depois. Nunca edite um registro antigo; se mudar de novo, crie um registro novo.</p>
`
  },
  {
    title: '10. Como manter esta wiki atualizada',
    html: `
<p>Uma wiki que ninguém atualiza vira a primeira fonte que as pessoas param de confiar. Esta página existe pra isso não acontecer.</p>
<h3>O que documentar aqui</h3>
<ul>
<li>Quem é o dono geral da wiki (organiza a estrutura, não escreve tudo sozinho).</li>
<li>Um dono por subpágina (o responsável pela área também é dono da página dela).</li>
<li>Uma revisão trimestral: cada dono confirma que a página ainda está certa.</li>
</ul>
<h3>Estrutura sugerida de subpáginas</h3>
<ul>
<li>Donos por seção (tabela)</li>
<li>Calendário de revisão trimestral</li>
<li>Como propor uma página nova</li>
</ul>
<h3>Como preencher</h3>
<p>Regra prática: toda página tem, no topo, "Última revisão: [data] por [nome]". Quem lê e percebe algo errado corrige na hora ou avisa o dono.</p>
`
  }
];
