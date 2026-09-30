# Lane Groq via Aider

A Groq **nao roda dentro do OpenCode**. O system prompt do OpenCode tem
~11.900 tokens e o tier free da Groq aceita 8.000 por minuto, entao estoura
antes de comecar. No Aider o prompt e pequeno, entao funciona.

Por fora do OpenCode, a Groq e a melhor opcao gratuita em volume:
**1.000 requisicoes/dia** (OpenRouter free da 50) e ~700 tokens/s.

## Como usar

```
cd C:\Users\caiof\OneDrive\Desktop\treino-louise-main
aider-groq
```

Ou direto, sem entrar na conversa:

```
aider-groq --message "crie a funcao X em backend/Y.go e o teste"
```

Para editar so alguns arquivos:

```
aider-groq backend/models/types.go backend/models/types_test.go
```

Se algo der errado:

```
aider-groq-doctor
```

## Modelos

| Modelo | Velocidade | Quando |
|---|---|---|
| `groq/openai/gpt-oss-20b` (padrao) | ~700 tok/s | tarefas comuns, padrao |
| `groq/openai/gpt-oss-120b` | ~390 tok/s | raciocinio mais difícil |

Modelo mais forte na hora:

```
aider-groq --model groq/openai/gpt-oss-120b
```

Os dois tem o mesmo limite de 8.000 tokens/min. O 120b e mais lento, nao maior.

## O limite de 8.000 tokens (a pegadinha)

Se aparecer:

```
Request too large for model `openai/gpt-oss-20b` ... on tokens per minute
(TPM): Limit 8000, Requested 12412
```

Nao troque de modelo. Baixe o contexto:

```
aider-groq --map-tokens 256
```

Medico no Louise (271 arquivos):

| Config | Tokens | Resultado |
|---|---|---|
| map 1024 + CLAUDE.md + agent-routing | 12.412 | estoura |
| map 512 sem contexto extra | 6.419 | funciona |
| map 512 + CLAUDE.md | 3.436 | funciona |

Por padrao o Aider le `CLAUDE.md` e `.opencode/agent-routing.md` (~2.000 tokens
a mais). Isso estoura. Por isso o `.aider.conf.yml` do Louise usa `map-tokens: 512`
e **nao** le o agent-routing por padrao.

Para tarefa sobre custo/roteamento, le na mao:

```
aider-groq --read .opencode/agent-routing.md --map-tokens 256
```

## Cuidados

- **Nunca commita sozinho.** O `.aider.conf.yml` ja tem `auto-commits: false`,
  porque o repo do Louise tem muitos arquivos modificados e um commit automatico
  entraria tudo junto. Se voce quiser commitar, faca na mao depois de conferir.
- **Custo por requisicao:** ~$0.0003. Mil requisicoes = ~30 centavos. Na pratica
  o plano free nao cobra, mas a conta nao cresce.
- O Aider **edita arquivos de verdade**. Confira o diff antes de salvar.
- Antes de mexer em Firestore, Auth ou Cloud Run, peça o diff para revisao.

## Se a Groq cair (429 ou indisponivel)

Nao trava. Use o OpenCode, que tem o plugin de fallback instalado e troca de
modelo sozinho:

- `opencode/big-pickle` (gratis)
- `opencode/mimo-v2.6-flash-free` (gratis)
- `opencode-go/deepseek-v4-pro` (pago, seu plano)
