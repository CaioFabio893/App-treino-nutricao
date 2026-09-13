"use client";

export function LoadingScreen() {
  return (
    <div className="spin-wrap">
      <div className="spinner" />
      <div className="loading-txt">Carregando…</div>
    </div>
  );
}

export default function SetupNeeded() {
  return (
    <div className="setup-card">
      <div className="modal-title">Configuração pendente</div>
      <p>
        Este app ainda não está conectado ao Firebase e à API. Para configurar:
      </p>
      <ol>
        <li>
          Crie o arquivo <code>frontend/.env.local</code> com as chaves do Firebase
          (veja o <code>.env.example</code>).
        </li>
        <li>
          Defina <code>NEXT_PUBLIC_API_URL</code> apontando para o seu backend no
          Cloud Run.
        </li>
        <li>Rode <code>npm run dev</code> novamente.</li>
      </ol>
    </div>
  );
}