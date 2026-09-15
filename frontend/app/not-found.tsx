import Link from "next/link";

// Página 404 global: rotas inexistentes e chamadas explícitas a notFound()
// renderizam esta UI (dentro do layout raiz, herdando o CSS global).
export default function NotFound() {
  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="logo-text" style={{ marginBottom: 4 }}>
          Página não encontrada
          <span>Erro 404</span>
        </div>
        <p className="login-sub">
          O endereço que você acessou não existe ou foi movido.
        </p>
        <div className="modal-acts">
          <Link href="/" className="btn-p">
            Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  );
}