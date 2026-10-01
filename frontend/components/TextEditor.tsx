"use client";

import { useRef, useState } from "react";
import FormattedText from "./FormattedText";

export default function TextEditor({ value, onChange }: { value: string; onChange: (text: string) => void }) {
  const input = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(false);
  const format = (style: "bold" | "list" | "title") => {
    const area = input.current;
    if (!area) return;
    const start = area.selectionStart, end = area.selectionEnd;
    const selected = value.slice(start, end) || (style === "bold" ? "texto em negrito" : "Texto");
    const formatted = style === "bold" ? selected.split("\n").map(line => line ? `**${line}**` : "").join("\n") : `${start > 0 && value[start - 1] !== "\n" ? "\n" : ""}${selected.split("\n").map(line => `${style === "list" ? "- " : "## "}${line}`).join("\n")}`;
    onChange(value.slice(0, start) + formatted + value.slice(end));
    requestAnimationFrame(() => { area.focus(); area.setSelectionRange(start, start + formatted.length); });
  };
  return <div className="text-editor">
    <div className="editor-toolbar" role="toolbar" aria-label="Formatação do texto">
      <button type="button" className="btn-sm" disabled={preview} onClick={() => format("bold")}><strong>Negrito</strong></button>
      <button type="button" className="btn-sm" disabled={preview} onClick={() => format("title")}>Título</button>
      <button type="button" className="btn-sm" disabled={preview} onClick={() => format("list")}>• Lista</button>
      <button type="button" className="btn-sm" aria-pressed={preview} onClick={() => setPreview(!preview)}>{preview ? "Editar texto" : "Visualizar"}</button>
    </div>
    {preview ? <FormattedText text={value} /> : <textarea ref={input} id="diet-content" className="diet-content-input" rows={14} value={value} onChange={e => onChange(e.target.value)} onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") { e.preventDefault(); format("bold"); } }} placeholder="Cole o conteúdo aqui. Selecione um trecho e toque em Negrito. Use listas, títulos e símbolos para organizar." />}
    <p className="editor-help">Selecione texto para formatar. **negrito**, ## título e - lista aparecem formatados em Visualizar e na tela do aluno. Símbolos e emojis também são aceitos.</p>
  </div>;
}
