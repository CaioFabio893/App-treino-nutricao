# CONTEXTO — Índice de areas (LOUISE)

> **Leia este arquivo primeiro. Depois leia SO o arquivo da area da tarefa.**
> Nao tente ler o projeto inteiro. Isso estoura o limite de tokens e trava.

## Por que este arquivo existe

O projeto tem ~230 arquivos de codigo. Se a IA ler tudo a cada tarefa, o
primeiro pedido passa de 8.000 tokens e a Groq recusa (429). Com este indice,
a IA le ~1 pagina aqui + 1 nota pequena da area. Cabeca em ~3.500 tokens.

## Duas fontes, nao uma

Este projeto tem **duis** documentos de contexto. Nao confuse:

| Documento | Tamanho | Contem | Quando ler |
|---|---|---|---|
| `docs/progress.md` | ~42KB | **STATUS**: o que ja foi feito, fase atual, pendencias | so quando precisar saber "onde o projeto esta" |
| `contexto/<area>.md` | ~1KB cada | **MAPA**: quais arquivos abrir, conceitos, cuidados | **toda tarefa** |

`progress.md` e grande demais para ler toda vez (42KB = ~10.000 tokens). E
justamente por isso que ele nao deve entrar no `read` automatico do Aider.

O `contexto/` responde a pergunta mais comum ("quais arquivos eu abro para
mexer nisso?"), que e a que trava a tarefa quando nao se sabe.

## Escolha a area

| Se a tarefa e sobre... | Leia |
|---|---|
| treinos, exercicios, series, carga, execucao | `contexto/treinos.md` |
| programas, subdivisoes, ciclos, importacao de PDF | `contexto/programas.md` |
| dieta, nutricao, macros, refeicoes | `contexto/dietas.md` |
| nota, pontuacao, ranking, adesao, grafico | `contexto/scores-ranking.md` |
| comunidade, feed, post, social, compartilhamento | `contexto/social.md` |
| login, cadastro, senha, perfil, permissao | `contexto/auth-perfil.md` |
| aluno, aprovacao, pendente, papel (role) | `contexto/alunos-aprovacao.md` |
| deploy, Cloud Run, config, banco, repositorio | `contexto/infra.md` |

Nao achou a area? Entao e infra ou uma feature nova — le `infra.md` e crie
uma nota nova.

## Como trabalhar (regra fixa)

1. Leia o indice (este arquivo).
2. Leia **so** a nota da area.
3. Abra so os arquivos que a nota lista.
4. Se a nota nao responder a duvida, le o arquivo de codigo necessario.
5. Ao terminar uma tarefa, **atualize a nota da area** com o que mudou.

O passo 5 e o que mantem este sistema util. Sem ele, daqui a um mes as notas
mentem e a IA volta a ler o codigo inteiro.

## Estado geral do projeto

- **Stack:** Go 1.23 (API) + Next.js 16 / React 19 (app) + Firestore + Firebase Auth + Cloud Run
- **Dois papeis so** (`backend/models/types.go`): `admin` e `student`. Nao existe
  `nutritionist` — quem e o profissional agora e o `admin`.
- **Trilha 1 (aluno / `student`):** `frontend/app/(aluno)/` — dashboard, treinos, programas, dietas, ranking, comunidade
- **Trilha 2 (gestao / `admin`):** `frontend/app/admin/` — alunos, aprovacao, planos, treinos, exercicios, dietas, programas, feed, ranking, timeline, usuarios
- **API:** `backend/` — handlers -> service -> repository -> Firestore
- **Testes:** `backend/**/*_test.go`, `frontend/__tests__/`, `frontend/e2e/`, `firestore-tests/`

## Regras que valem em toda parte

- TDD: teste antes da implementacao. Nao escrever codigo sem teste.
- Nunca mexer em `frontend/node_modules`, `backend/vendor`, `.next`.
- Firestore: cuidado com query sem indice e com regra de permissao.
  Qualquer leitura/escrita nova precisa de teste em `firestore-tests/`.
- Antes de qualquer mudanca, rodar os testes e guardar o resultado.
