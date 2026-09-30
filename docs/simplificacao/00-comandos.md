# 00 — Comandos de medição (reprodução do baseline)

Todos os números de `01-baseline.md` saíram destes comandos. Rodar de novo deve
dar o mesmo resultado; se der diferente, o baseline está velho.

Data: 2026-09-28 · raiz do repo · PowerShell 5.1

```powershell
# ── 1. Tamanho do codebase ────────────────────────────────────────────
$f = Get-ChildItem -Recurse -File -Include *.go,*.ts,*.tsx -Path backend,frontend |
     Where-Object { $_.FullName -notmatch 'node_modules|\.next|vendor' }
$f.Count
$tot = 0; foreach ($x in $f) { $tot += (Get-Content -LiteralPath $x.FullName).Count }; $tot

# ── 2. Rotas (a métrica mais fácil de errar) ──────────────────────────
(Select-String -Path backend/main.go -Pattern 'mux.HandleFunc').Count   # => 63

# ── 3. Testes Go: contagem E nomes ────────────────────────────────────
(Get-ChildItem -Recurse -File -Filter *_test.go backend).Count          # => 15
(Get-ChildItem -Recurse -File -Filter *_test.go backend |
  Select-String -Pattern '^func Test').Count                           # => 208
# nomes por arquivo (base do gate por fase):
Get-ChildItem -Recurse -File -Filter *_test.go backend | ForEach-Object {
  "--- $($_.Name)"
  Select-String -Path $_.FullName -Pattern '^func (Test\w+)' |
    ForEach-Object { "    $($_.Matches[0].Groups[1].Value)" } }

# ── 4. Papel nutricionista (contagem REAL) ─────────────────────────────
(Get-ChildItem -Recurse -File -Filter *.go backend |
  Select-String -Pattern 'RoleNutritionist').Count                     # => 51
(Get-ChildItem -Recurse -File -Filter *.go backend |
  Select-String -Pattern 'RoleNutritionist' | Group-Object Filename |
  Sort-Object Count -Descending | ForEach-Object { "$($_.Count) $($_.Name)" })

# frontend, implementação (sem testes), case-insensitive:
(Get-ChildItem -Recurse -File -Include *.ts,*.tsx frontend |
  Where-Object { $_.FullName -notmatch 'node_modules|\.next|__tests__|e2e' } |
  Select-String -Pattern 'nutritionist' -CaseSensitive:$false).Count   # => 200

# ── 5. Estruturas de modelo ───────────────────────────────────────────
Select-String -Path backend/models/types.go -Pattern '^\s*\w+\s+\w+(\s+\w+)?\s+`json' |
  ForEach-Object { "L$($_.LineNumber): $($_.Line.Trim())" }

# ── 6. Coleções e regras ──────────────────────────────────────────────
(Get-Content firestore.rules).Count                                    # => 176
Select-String -Path firestore.rules -Pattern 'match /' |
  ForEach-Object { "L$($_.LineNumber): $($_.Line.Trim())" }

# ── 7. Índices ─────────────────────────────────────────────────────────
(Get-Content firestore.indexes.json -Raw | ConvertFrom-Json).indexes.Count   # => 11
(Get-Content firestore.indexes.json -Raw | ConvertFrom-Json).indexes | ForEach-Object {
  $c = if ($_.collectionGroup) { $_.collectionGroup } else { $_.collectionId }
  "{0,-18} {1}" -f $c, (($_.fields | ForEach-Object { "$($_.fieldPath):$($_.order)" }) -join ', ') }

# ── 8. Testes frontend ────────────────────────────────────────────────
# Vitest: 131
(Get-ChildItem -File frontend/__tests__/*.ts,frontend/__tests__/*.tsx | ForEach-Object {
  (Select-String -Path $_.FullName -Pattern "^\s*(it|test)\(").Count } |
  Measure-Object -Sum).Sum
# E2E: 30
(Get-ChildItem -File frontend/e2e/*.spec.ts | ForEach-Object {
  (Select-String -Path $_.FullName -Pattern "^\s*test\(").Count } |
  Measure-Object -Sum).Sum
# Regras: 64 it() em 15 describe()  <-- .gates diz 76 (DIVERGÊNCIA)
"it() = " + (Select-String -Path firestore-tests/rules.test.js -Pattern '^\s*it\(').Count

# ── 9. exports de api.ts (índice, não o corpo) ────────────────────────
(Select-String -Path frontend/lib/api.ts -Pattern "^export (async )?function").Count  # => 63
Select-String -Path frontend/lib/api.ts -Pattern "^export (async )?function" |
  ForEach-Object { "L$($_.LineNumber) $($_.Line.Trim())" }

# ── 10. Modo demo (achado P2) ─────────────────────────────────────────
(Get-ChildItem -Recurse -File -Include *.ts,*.tsx frontend |
  Where-Object { $_.FullName -notmatch 'node_modules|\.next' } |
  Select-String -Pattern 'DEMO_MODE|demoAs|ll_demo_').Count
# por arquivo: api.ts = 67 · auth.tsx = 26 · DemoRoleSwitch = 10 · config.ts = 1
```

## Armadilha registrada

- `Get-Content` **sem `-LiteralPath`** falha em caminhos com `[id]`
  (interpretado como wildcard). 4 arquivos de rota dinâmica não são contados.
  Usar `-LiteralPath`.
- `Get-ChildItem -Recurse -Path firestore-tests` **sem** `-notmatch node_modules`
  despeja `mocha.js` (20.776 linhas) e `js-yaml` no output. Sempre filtrar.
- `Get-Content -Raw` não existe no PowerShell 5.1 neste ambiente
  (erro de binding de parâmetro). Usar `Get-Content` normal.
