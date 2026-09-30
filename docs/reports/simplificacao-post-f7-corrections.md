# Correções adicionais após F7 — calendário e dependências

30/09/2026. Apenas ambiente local.

A seleção de dieta em StudentDietPage e no resumo de alunos do admin usava
new Date().toISOString().slice(0,10), que muda de dia às 21h de Recife.
Por exemplo, 30/09 às 23h59 local já é 01/10 UTC e fazia uma dieta válida
até 30/09 desaparecer antes da hora.

Criado todayDateKey com Intl.DateTimeFormat/formatToParts em America/Recife;
aluno e admin usam o mesmo dia civil. Cabeçalhos e escolha de treino compartilham
APP_TIME_ZONE. Datas de validade das dietas não foram removidas nem migradas.

Quatro cenários de virada UTC/mês/ano/meia-noite local: dois falhavam em Red
com a lógica UTC, todos passaram depois. Teste de tela comprova dieta ainda
visível às 23h59 de Recife. Vitest completo 121/121 em 20 arquivos;
tsc/lint/build OK. E2E final 31/31 em 1,3 min, registrado em .gates.

Retirado recharts de package.json e package-lock.json: não havia mais consumidor
TS/TSX após F1. Remoção offline com --package-lock-only --ignore-scripts;
nenhuma dependência instalada nem script externo executado. Nó físico antigo
pode continuar em node_modules até a próxima instalação limpa normal, mas
não é importado nem declarado no manifesto final. Lockfile perdeu dependências
transitivas exclusivas do pacote. Build confirmou ausência de imports quebrados.

README agora distingue estado local e registro histórico de produção; dados
remotos não foram revalidados. Folha de decisões registra defaults aplicados,
sem preencher respostas humanas. Nenhum deploy, dado real ou Windows alterado.
Uma execução E2E teve formulário remontado enquanto fontes eram limpas
(HMR possível); a repetição sem edição durante a suíte passou integralmente.

Rollback: reverter commit local deste conjunto e repetir validação frontend.
Não há migração de documentos ou alteração remota a desfazer.