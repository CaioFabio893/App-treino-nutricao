import { describe, expect, it } from "vitest";
import { friendlyAuthError, friendlyResetError } from "@/lib/auth-errors";

describe("friendlyAuthError — mapeamento de erros do Firebase (login/cadastro)", () => {
  it("mapeia credenciais inválidas para mensagem genérica de e-mail/senha", () => {
    expect(friendlyAuthError("auth/invalid-credential")).toBe("E-mail ou senha incorretos.");
    expect(friendlyAuthError("auth/wrong-password")).toBe("E-mail ou senha incorretos.");
    expect(friendlyAuthError("auth/user-not-found")).toBe("E-mail ou senha incorretos.");
  });

  it("mapeia os demais códigos conhecidos", () => {
    expect(friendlyAuthError("auth/email-already-in-use")).toBe("Esse e-mail já está cadastrado.");
    expect(friendlyAuthError("auth/weak-password")).toBe("Senha muito fraca (mínimo 6 caracteres).");
    expect(friendlyAuthError("auth/invalid-email")).toBe("E-mail inválido.");
    expect(friendlyAuthError("auth/too-many-requests")).toBe("Muitas tentativas — aguarde um pouco.");
    expect(friendlyAuthError("auth/network-request-failed")).toBe("Falha de conexão.");
  });

  it("usa fallback para código desconhecido ou ausente", () => {
    expect(friendlyAuthError("auth/whatever")).toBe("Não foi possível concluir. Tente novamente.");
    expect(friendlyAuthError(undefined)).toBe("Não foi possível concluir. Tente novamente.");
    expect(friendlyAuthError(undefined, "Fallback custom.")).toBe("Fallback custom.");
  });
});

describe("friendlyResetError — recuperação de senha com anti-enumeração", () => {
  it("retorna null para e-mail inexistente (não revela a conta)", () => {
    expect(friendlyResetError("auth/user-not-found")).toBeNull();
    expect(friendlyResetError("auth/missing-email")).toBeNull();
  });

  it("mapeia erros exibíveis", () => {
    expect(friendlyResetError("auth/invalid-email")).toBe("E-mail inválido.");
    expect(friendlyResetError("auth/network-request-failed")).toBe(
      "Falha de conexão. Verifique sua internet e tente novamente."
    );
    expect(friendlyResetError("auth/too-many-requests")).toBe(
      "Muitas tentativas — aguarde um pouco e tente novamente."
    );
  });

  it("usa fallback para código desconhecido", () => {
    expect(friendlyResetError("auth/whatever")).toBe(
      "Não foi possível enviar a recuperação. Tente novamente."
    );
  });
});