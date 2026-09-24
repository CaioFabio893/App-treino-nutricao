// Mapeamento de códigos de erro do Firebase Auth para mensagens amigáveis
// em português (login e cadastro). Nunca expõe stack trace/detalhes internos.

export function friendlyAuthError(code?: string, fallback = "Não foi possível concluir. Tente novamente."): string {
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "E-mail ou senha incorretos.";
    case "auth/email-already-in-use":
      return "Esse e-mail já está cadastrado.";
    case "auth/weak-password":
      return "Senha muito fraca (mínimo 6 caracteres).";
    case "auth/invalid-email":
      return "E-mail inválido.";
    case "auth/too-many-requests":
      return "Muitas tentativas — aguarde um pouco.";
    case "auth/network-request-failed":
      return "Falha de conexão.";
    case "auth/account-exists-with-different-credential":
      // Conta legada da V1 criada por provedor diferente (ex.: Google).
      return "Já existe uma conta com este e-mail. Fale com a nutricionista para recuperar o acesso.";
    default:
      return fallback;
  }
}

/**
 * Mapeamento dos erros de recuperação de senha.
 *
 * Retorna `null` quando o erro NÃO deve aparecer para o usuário — é o caso de
 * `auth/user-not-found`: o Firebase informa quando o e-mail não existe, mas
 * exibir mensagem diferente revelaria a existência da conta (enumeração de
 * usuários). Nesse caso o fluxo segue o caminho de sucesso genérico.
 */
export function friendlyResetError(code?: string): string | null {
  switch (code) {
    case "auth/user-not-found":
    case "auth/missing-email":
      // Anti-enumeração: trata como sucesso genérico.
      return null;
    case "auth/invalid-email":
      return "E-mail inválido.";
    case "auth/network-request-failed":
      return "Falha de conexão. Verifique sua internet e tente novamente.";
    case "auth/too-many-requests":
      return "Muitas tentativas — aguarde um pouco e tente novamente.";
    default:
      return "Não foi possível enviar a recuperação. Tente novamente.";
  }
}