package main

// Testes do carregamento de configuração de hardening (loadConfig):
// ALLOWED_ORIGIN obrigatório em produção (sem fallback, sem "*") e defaults de
// rate limit por ambiente, com override explícito via RATE_LIMIT.

import (
	"strings"
	"testing"
)

// getenv monta um leitor de variáveis de ambiente a partir de um mapa
// (injetável — os testes nunca tocam o ambiente real do processo).
func getenv(m map[string]string) func(string) string {
	return func(k string) string { return m[k] }
}

// ── CORS / ALLOWED_ORIGIN ──

// 1. produção sem ALLOWED_ORIGIN → boot rejeitado (sem fallback).
func TestLoadConfigProductionWithoutAllowedOriginFails(t *testing.T) {
	_, err := loadConfig(getenv(map[string]string{"GO_ENV": "production"}))
	if err == nil {
		t.Fatal("produção sem ALLOWED_ORIGIN deveria rejeitar o boot")
	}
	if !strings.Contains(err.Error(), "ALLOWED_ORIGIN") {
		t.Errorf("erro = %q, deveria mencionar ALLOWED_ORIGIN", err.Error())
	}
	if strings.Contains(err.Error(), "*") {
		t.Errorf("erro = %q, não deveria sugerir fallback '*'", err.Error())
	}
}

// 2. produção com origem válida → boot aceito.
func TestLoadConfigProductionWithValidOriginAccepted(t *testing.T) {
	cfg, err := loadConfig(getenv(map[string]string{
		"GO_ENV":         "production",
		"ALLOWED_ORIGIN": "https://app.treinolouise.com",
	}))
	if err != nil {
		t.Fatalf("produção com origem válida deveria passar: %v", err)
	}
	if cfg.allowedOrigin != "https://app.treinolouise.com" {
		t.Errorf("allowedOrigin = %q, want https://app.treinolouise.com", cfg.allowedOrigin)
	}
}

// 3. ALLOWED_ORIGIN=* → rejeitado em qualquer ambiente.
func TestLoadConfigRejectsWildcardOrigin(t *testing.T) {
	for _, env := range []string{"production", "", "development"} {
		_, err := loadConfig(getenv(map[string]string{"GO_ENV": env, "ALLOWED_ORIGIN": "*"}))
		if err == nil {
			t.Fatalf("ALLOWED_ORIGIN=* (GO_ENV=%q) deveria ser rejeitado", env)
		}
		if !strings.Contains(err.Error(), "'*'") && !strings.Contains(err.Error(), "*") {
			t.Errorf("GO_ENV=%q erro = %q, deveria citar o wildcard", env, err.Error())
		}
	}
}

// 4. dev/test sem variável → default http://localhost:3000.
func TestLoadConfigDevDefaultsAllowedOrigin(t *testing.T) {
	for _, env := range []string{"", "development", "test"} {
		cfg, err := loadConfig(getenv(map[string]string{"GO_ENV": env}))
		if err != nil {
			t.Fatalf("GO_ENV=%q sem variáveis deveria funcionar: %v", env, err)
		}
		if cfg.allowedOrigin != "http://localhost:3000" {
			t.Errorf("GO_ENV=%q allowedOrigin = %q, want http://localhost:3000", env, cfg.allowedOrigin)
		}
	}
}

// ALLOWED_ORIGIN explícito em dev também é respeitado (sem default mágico).
func TestLoadConfigDevExplicitOriginRespected(t *testing.T) {
	cfg, err := loadConfig(getenv(map[string]string{"ALLOWED_ORIGIN": "https://dev.example.com"}))
	if err != nil {
		t.Fatalf("dev com origem explícita deveria passar: %v", err)
	}
	if cfg.allowedOrigin != "https://dev.example.com" {
		t.Errorf("allowedOrigin = %q, want https://dev.example.com", cfg.allowedOrigin)
	}
}

// ── RATE LIMIT ──

// 1. default produção = 120 req/min/IP.
func TestLoadConfigProductionDefaultsRateLimit(t *testing.T) {
	cfg, err := loadConfig(getenv(map[string]string{
		"GO_ENV":         "production",
		"ALLOWED_ORIGIN": "https://app.treinolouise.com",
	}))
	if err != nil {
		t.Fatalf("produção deveria passar: %v", err)
	}
	if cfg.rateLimit != 120 {
		t.Errorf("rateLimit = %d, want 120 (default produção)", cfg.rateLimit)
	}
}

// 2. default dev/test = 600 req/min/IP.
func TestLoadConfigDevDefaultsRateLimit(t *testing.T) {
	cfg, err := loadConfig(getenv(map[string]string{}))
	if err != nil {
		t.Fatalf("dev deveria passar: %v", err)
	}
	if cfg.rateLimit != 600 {
		t.Errorf("rateLimit = %d, want 600 (default dev/test)", cfg.rateLimit)
	}
}

// 3. RATE_LIMIT explícito sobrescreve o default do ambiente.
func TestLoadConfigExplicitRateLimitOverridesDefault(t *testing.T) {
	prod, err := loadConfig(getenv(map[string]string{
		"GO_ENV":         "production",
		"ALLOWED_ORIGIN": "https://app.treinolouise.com",
		"RATE_LIMIT":     "10",
	}))
	if err != nil {
		t.Fatalf("produção com RATE_LIMIT=10 deveria passar: %v", err)
	}
	if prod.rateLimit != 10 {
		t.Errorf("produção rateLimit = %d, want 10 (override)", prod.rateLimit)
	}

	dev, err := loadConfig(getenv(map[string]string{"GO_ENV": "development", "RATE_LIMIT": "10"}))
	if err != nil {
		t.Fatalf("dev com RATE_LIMIT=10 deveria passar: %v", err)
	}
	if dev.rateLimit != 10 {
		t.Errorf("dev rateLimit = %d, want 10 (override)", dev.rateLimit)
	}
}

// 4. produção com RATE_LIMIT=0 → rejeitado (0 nunca significa "sem proteção"
// em produção).
func TestLoadConfigProductionRejectsZeroRateLimit(t *testing.T) {
	_, err := loadConfig(getenv(map[string]string{
		"GO_ENV":         "production",
		"ALLOWED_ORIGIN": "https://app.treinolouise.com",
		"RATE_LIMIT":     "0",
	}))
	if err == nil {
		t.Fatal("RATE_LIMIT=0 em produção deveria rejeitar o boot (proteção desativada)")
	}
	if !strings.Contains(err.Error(), "RATE_LIMIT") {
		t.Errorf("erro = %q, deveria mencionar RATE_LIMIT", err.Error())
	}
}

// RATE_LIMIT não numérico → erro claro em qualquer ambiente (config quebrada
// não vira silent-disable como antes).
func TestLoadConfigRejectsGarbageRateLimit(t *testing.T) {
	for _, env := range []string{"production", ""} {
		_, err := loadConfig(getenv(map[string]string{"GO_ENV": env, "RATE_LIMIT": "abc", "ALLOWED_ORIGIN": "https://x.com"}))
		if err == nil {
			t.Fatalf("RATE_LIMIT=abc (GO_ENV=%q) deveria falhar", env)
		}
	}
}