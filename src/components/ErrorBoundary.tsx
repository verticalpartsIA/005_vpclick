import React from 'react';

interface ErrorBoundaryState {
  error: Error | null;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /**
   * Quando informado, o fallback vira um cartão fechável (ex.: um modal) em
   * vez de tela cheia — fechar limpa o erro e o app continua de pé por trás,
   * em vez de forçar um reload da página inteira por um problema local.
   */
  onClose?: () => void;
}

/**
 * Rede de segurança: sem isto, qualquer erro de renderização em qualquer
 * lugar da árvore (um campo com dado inesperado, uma menção mal formada,
 * etc.) derruba o React inteiro e vira tela branca sem nenhuma pista do que
 * aconteceu — o único jeito de voltar era um F5 as escuras. Aqui o erro fica
 * visível (com a mensagem, pra reportar) e há um jeito de se recuperar sem
 * perder o resto do app.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Erro não tratado na interface:', error, info.componentStack);
  }

  handleClose = () => {
    this.setState({ error: null });
    this.props.onClose?.();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gray-50/95 p-6 z-[999]">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-gray-100 p-8 text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h1 className="text-lg font-bold text-gray-800 mb-2">Algo deu errado nesta tela</h1>
          <p className="text-sm text-gray-500 mb-6">
            {this.props.onClose
              ? 'Feche e tente de novo. Se continuar, recarregue a página. Detalhe pra reportar ao suporte:'
              : 'Recarregue a página. Se o problema continuar, envie esta mensagem para o suporte:'}
          </p>
          <pre className="text-left text-[11px] text-red-600 bg-red-50 border border-red-100 rounded-lg p-3 mb-6 overflow-x-auto whitespace-pre-wrap break-words">
            {error.message}
          </pre>
          <div className="flex items-center justify-center gap-3">
            {this.props.onClose && (
              <button
                onClick={this.handleClose}
                className="px-6 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-all"
              >
                Fechar
              </button>
            )}
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2.5 bg-orange-500 text-white font-bold rounded-xl hover:brightness-110 shadow-lg shadow-orange-200 transition-all"
            >
              Recarregar página
            </button>
          </div>
        </div>
      </div>
    );
  }
}
