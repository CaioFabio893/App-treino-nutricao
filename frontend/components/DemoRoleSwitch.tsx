"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { DEMO_MODE } from "@/lib/config";

/** Botão flutuante (somente modo demo) para alternar entre
 *  a visão do NUTRICIONISTA e a visão do ALUNO (finalizar treino). */
export default function DemoRoleSwitch() {
  const { demoAs, setDemoAs } = useAuth();
  const router = useRouter();

  if (!DEMO_MODE) return null;

  const toggle = () => {
    const next = demoAs === "nutritionist" ? "student" : "nutritionist";
    setDemoAs(next);
    // Home faz o roteamento por role; vai para a raiz para reavaliar.
    router.push("/");
  };

  // Limpa os dados do demo (alunos, treinos, dietas, históricos) e re-seeda.
  const reset = () => {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("ll_demo_")) keysToRemove.push(k);
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
    setDemoAs("nutritionist");
    router.push("/");
    window.location.reload();
  };

  return (
    <>
      <button
        type="button"
        onClick={reset}
        title="Restaurar os dados de demonstração (apaga treinos, dietas e históricos criados no teste)"
        style={{
          position: "fixed",
          bottom: 64,
          right: 16,
          zIndex: 90,
          background: "rgba(0,0,0,.55)",
          color: "#fff",
          border: "1px solid rgba(255,255,255,.25)",
          borderRadius: 999,
          padding: "8px 14px",
          fontSize: 12,
          fontWeight: 600,
          boxShadow: "0 4px 14px rgba(0,0,0,.2)",
          cursor: "pointer",
        }}
      >
        ↺ Resetar demo
      </button>
      <button
        type="button"
        onClick={toggle}
        title={
          demoAs === "nutritionist"
            ? "Ver a tela do aluno (testar finalizar treino)"
            : "Voltar para o painel do nutricionista"
        }
        style={{
          position: "fixed",
          bottom: 16,
          right: 16,
          zIndex: 90,
          background: "var(--terra)",
          color: "#fff",
          border: "none",
          borderRadius: 999,
          padding: "10px 16px",
          fontSize: 13,
          fontWeight: 600,
          boxShadow: "0 4px 14px rgba(0,0,0,.25)",
          cursor: "pointer",
        }}
      >
        {demoAs === "nutritionist" ? "👁 Ver como aluno" : "🔙 Voltar como nutricionista"}
      </button>
    </>
  );
}