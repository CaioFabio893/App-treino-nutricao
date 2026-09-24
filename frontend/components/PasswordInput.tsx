"use client";

import { useState } from "react";

interface PasswordInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  /** autoComplete do browser: "current-password" (login) | "new-password" (cadastro). */
  autoComplete?: string;
  placeholder?: string;
  minLength?: number;
  required?: boolean;
  /** Marca aria-invalid no input (erro de validação relacionado ao campo). */
  invalid?: boolean;
  /** id do elemento de erro associado (aria-describedby). */
  describedBy?: string;
  autoFocus?: boolean;
}

/**
 * Campo de senha com botão de mostrar/ocultar. O estado de visibilidade é
 * interno e independente por instância (abrir a senha não abre a confirmação).
 *
 * O botão é um <button type="button"> real (a11y) com aria-label dinâmico
 * ("Mostrar senha"/"Ocultar senha") e alvo de toque confortável (~38px).
 */
export default function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  placeholder,
  minLength,
  required,
  invalid,
  describedBy,
  autoFocus,
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="pw-field">
      <input
        id={id}
        name={id}
        type={visible ? "text" : "password"}
        className="pw-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        minLength={minLength}
        required={required}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        autoFocus={autoFocus}
        style={{ fontSize: 16 }}
      />
      <button
        type="button"
        className="pw-toggle"
        aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
        onClick={() => setVisible((v) => !v)}
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}

function EyeIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}