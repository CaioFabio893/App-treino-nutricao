# Simplificação F1 — checkpoint de continuidade

30/09/2026. Codex assumiu também as tarefas OpenCode por autorização do dono.

## Resultado

F1 foi encontrada em andamento na árvore. A remoção existente de pontuação,
ciclo, ranking, perfil público e respectivas telas foi revisada e validada.
Codex removeu constantes mortas de score, complementou testes de segurança
e atualizou a memória para retomada. startOfDay foi preservado em dates.go
porque comunidade ainda depende dele. Treinos, dieta, programas, exercícios,
aprovação, auth, timezone e createdAt mantêm seus contratos.

Regressões adicionadas: endpoints antigos retornam 404; aluno/admin não leem
nem escrevem scores legados via SDK; snapshot antigo com ranking não recria
card no dashboard. FeatureRanking em tipos/snapshots permanece para a F3.

## Evidência executada

| Gate | Resultado |
|---|---|
| Go vet + go test ./... -count=1 | 201 testes top-level PASS; vet limpo |
| Vitest completo | 99/99, 17 arquivos |
| Dashboard após complemento | 5/5 |
| Rules Firestore em emulador | 84/84 (82 restantes + 2 regressões novas) |
| Playwright Auth/Firestore emulados | 28/28, 2,1 min |
| tsc --noEmit / lint / next build | OK |

Contagens foram medidas em execução; não reproduzem estimativas obsoletas do
plano original. Go/Firebase CLI precisaram de execução fora do sandbox para
usar cache/instalação existentes. Não foram instaladas dependências.

## Retomada

Leia PROJECT_STATE.md, .gates e o git log/status. Faça F2 comunidade antes de
F3 planos/features e F5 participante read-only. Use o inventário da fase para
abrir somente arquivos social/feed/posts e dependências diretas. Preserve
segurança/ownership e gates do restante do app. Checkpoint local por fase.

Sem push/deploy, console, rotação de chave ou deleção de dados. D6 continua
pendente; não executar K1 nem apagar coleções. Configs OpenCode preexistentes
devem ficar fora do commit de F1. K6 já registrado no commit 5ddfb52.
