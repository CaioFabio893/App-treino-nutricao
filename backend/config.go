package main

// Configuração de hardening carregada no boot (fail-fast):
//   - ALLOWED_ORIGIN: obrigatório em produção (GO_ENV=production), nunca "*";
//     default de desenvolvimento/teste = http://localhost:3000.
//   - RATE_LIMIT: default por ambiente (produção 120, dev/teste 600 req/min/IP),
//     override explícito via variável; 0 nunca desativa a proteção em produção.

import (
	"errors"
	"fmt"
	"strconv"
	"time"
)

const (
	envProduction = "production"

	// defaultAllowedOriginDev é a origem padrão quando NÃO é produção.
	// Produção exige ALLOWED_ORIGIN explícito — jamais cai neste default (nem
	// em "*") com GO_ENV=production.
	defaultAllowedOriginDev = "http://localhost:3000"

	// Defaults de rate limit por ambiente (requisições por minuto por IP).
	defaultRateLimitProd = 120
	defaultRateLimitDev  = 600
)

// appConfig concentra as configurações da cadeia de hardening derivadas do
// ambiente. Carregada uma única vez no boot; erro de configuração derruba o
// processo (log.Fatalf) — nunca cai em fallback permissivo.
type appConfig struct {
	allowedOrigin string        // origem(s) exata(s) permitida(s) no CORS
	rateLimit     int           // requisições por IP por janela
	rateWindow    time.Duration // janela do rate limit (1 minuto)
}

// loadConfig resolve as variáveis da cadeia de hardening a partir de um leitor
// de ambiente injetável (os.Getenv em produção; mapa nos testes).
//
// Regras:
//   - GO_ENV=production ⇒ ALLOWED_ORIGIN OBRIGATÓRIO (ausente = erro de boot) e
//     nega "*" (wildcard) em qualquer ambiente.
//   - FORA de produção ⇒ default explícito http://localhost:3000 (nunca "*").
//   - RATE_LIMIT ausente ⇒ default por ambiente (120 produção / 600 dev-test).
//   - RATE_LIMIT definido ⇒ sobrescreve o default; em produção deve ser > 0
//     ("0" desativaria a proteção e é rejeitado).
func loadConfig(getenv func(string) string) (appConfig, error) {
	cfg := appConfig{rateWindow: time.Minute}
	prod := getenv("GO_ENV") == envProduction

	// ── CORS / ALLOWED_ORIGIN ──
	origin := getenv("ALLOWED_ORIGIN")
	switch {
	case origin == "" && prod:
		return cfg, errors.New("ALLOWED_ORIGIN e obrigatorio em producao (GO_ENV=production) — defina o dominio exato do frontend; nao ha fallback")
	case origin == "":
		origin = defaultAllowedOriginDev
	case origin == "*":
		return cfg, errors.New("ALLOWED_ORIGIN nao pode ser '*' (wildcard nao permitido — use o dominio exato do frontend)")
	}
	cfg.allowedOrigin = origin

	// ── RATE LIMIT ──
	rl := getenv("RATE_LIMIT")
	if rl == "" {
		rl = strconv.Itoa(defaultRateLimitDev)
		if prod {
			rl = strconv.Itoa(defaultRateLimitProd)
		}
	}
	n, err := strconv.Atoi(rl)
	if err != nil {
		return cfg, fmt.Errorf("RATE_LIMIT invalido: %q (esperado inteiro positivo)", rl)
	}
	if n < 0 {
		return cfg, fmt.Errorf("RATE_LIMIT invalido: %d (nao pode ser negativo)", n)
	}
	if n == 0 && prod {
		return cfg, errors.New("RATE_LIMIT=0 desativaria a protecao em producao — defina um valor positivo ou remova a variavel para usar o default (120)")
	}
	cfg.rateLimit = n
	return cfg, nil
}