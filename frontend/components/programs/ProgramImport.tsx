"use client";

import { useRef, useState } from "react";
import * as api from "@/lib/api";
import { LOUISE_PROGRAM_EXAMPLE } from "@/lib/program-example";
import type { TrainingProgram, UserProfile } from "@/lib/types";

interface Props {
  getToken: () => Promise<string>;
  students: UserProfile[];
  onImported: (p: TrainingProgram) => void;
  onCancel: () => void;
}

const EXEMPLO = LOUISE_PROGRAM_EXAMPLE;

/**
 * Importação de programa em markdown.
 *
 * O cliente NÃO interpreta o texto: ele só envia o markdown e o backend Go
 * (programmd) cria os treinos e o programa. Isso garante que a importação do
 * app e a do CLI (cmd/programimport) produzam exatamente o mesmo resultado.
 */
export default function ProgramImport({ getToken, students, onImported, onCancel }: Props) {
  const [markdown, setMarkdown] = useState("");
  const [source, setSource] = useState("");
  const [name, setName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const readFile = async (file: File) => {
    setError(null);
    try {
      const text = await file.text();
      setMarkdown(text);
      if (!source) setSource(file.name);
    } catch {
      setError("Não foi possível ler o arquivo.");
    }
  };

  const importProgram = async () => {
    if (!markdown.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const token = await getToken();
      const program = await api.importProgram(
        {
          markdown,
          source: source.trim() || undefined,
          name: name.trim() || undefined,
          studentId: studentId || undefined,
        },
        token
      );
      onImported(program);
    } catch (e) {
      setError(api.friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="btn-row" style={{ marginTop: 0 }}>
        <button type="button" className="btn-sm" onClick={onCancel}>
          ‹ Voltar
        </button>
      </div>

      <div className="page-head">
        <div>
          <h1>Cadastrar programa completo</h1>
          <div className="page-sub">
            Crie todos os treinos A, B, C, D… de uma só vez. Use o programa exemplo completo,
            cole seu programa ou envie um arquivo. Escolha um aluno para associar o conjunto inteiro.
          </div>
        </div>
      </div>

      {error && <div className="err-text">{error}</div>}

      <div className="frm-card">
        <h3>Programa completo</h3>
        <div className="frm-row-inline">
          <div className="frm-row">
            <label>Nome do programa (opcional)</label>
            <input
              value={name}
              placeholder="Usa o título do markdown se vazio"
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="frm-row">
            <label>Origem (opcional)</label>
            <input
              value={source}
              placeholder="Ex.: treino.md"
              onChange={(e) => setSource(e.target.value)}
            />
          </div>
        </div>

        <div className="frm-row">
          <label>Associar todos os treinos a um aluno (opcional)</label>
          <select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            <option value="">Manter na biblioteca (atribuir depois)</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name || s.id}
              </option>
            ))}
          </select>
        </div>

        <div className="frm-row">
          <label>Markdown do programa</label>
          <textarea
            value={markdown}
            rows={12}
            placeholder={EXEMPLO}
            onChange={(e) => setMarkdown(e.target.value)}
            style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12 }}
          />
        </div>

        <div className="btn-row">
          <input
            ref={fileRef}
            type="file"
            accept=".md,.markdown,.txt,text/markdown,text/plain"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void readFile(f);
            }}
          />
          <button type="button" className="btn-sm" onClick={() => fileRef.current?.click()}>
            Enviar arquivo .md
          </button>
          <button type="button" className="btn-sm" onClick={() => { setMarkdown(EXEMPLO); setSource("exemplo/treino.md"); }}>
            Usar programa exemplo completo (A–E)
          </button>
          <button
            type="button"
            className="btn-sm acc"
            disabled={!markdown.trim() || busy}
            onClick={() => void importProgram()}
          >
            {busy ? "Cadastrando…" : "Cadastrar programa completo"}
          </button>
        </div>
      </div>

      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 10, lineHeight: 1.6 }}>
        Formato esperado: um <code>#</code> com o nome do programa, uma linha{" "}
        <code>**Foco: …**</code> com o objetivo e uma seção{" "}
        <code>## TREINO X — Nome</code> por treino, cada uma com uma tabela{" "}
        <code>| # | Exercício | Séries | Reps | Observação |</code>. Blocos de cardio, PRs e
        periodização são preservados literalmente — o cardio vai para a descrição do treino e
        PRs/periodização para as notas do programa. Carga e descanso não aparecem na fonte e
        ficam vazios para você preencher depois.
      </div>
    </div>
  );
}
