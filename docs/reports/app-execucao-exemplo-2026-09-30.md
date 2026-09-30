# Execução do programa — funcionalidades do app de referência

## Correção solicitada

A entrega anterior importou a prescrição completa, mas não reproduziu o app de execução de `C:\Users\caiof\OneDrive\Desktop\exemplo\index.html`. O pedido atual autoriza registrar a execução pessoal do aluno. A política anterior de aluno apenas consultar a prescrição continua impedindo editar os treinos, mas não deve impedir registrar cargas, repetições e resultados pessoais.

## Implementado

- Painel React integrado ao detalhe do programa, com paleta creme/terracota/oliva do exemplo, cartões recolhíveis e navegação A–E na ordem do programa atribuído.
- Campos por série: carga, repetições e resultado alternando não marcado → conseguiu → não conseguiu → não marcado. A barra conta somente séries com sucesso.
- Observações pessoais por exercício, com salvamento automático e botão Salvar. A prescrição e observações do professor permanecem intactas.
- Escolha das oito semanas, mantendo os registros separados por semana e treino. Nos programas com a periodização do exemplo: 70%, 70%, 75%, 75%, 82,5%, 82,5%, 90%, Deload 70%.
- PRs de agachamento, elevação pélvica e leg press; sugestão de carga calculada pela porcentagem da semana e arredondada para 0,5 kg. Sem PR informado não se inventa carga.
- Última sessão registrada em semana anterior, mostrando cargas, repetições e resultados.
- Cronômetro por exercício, contando o tempo decorrido, com iniciar/pausar/zerar e opções 1/2/3 minutos. Usa relógio real para compensar atrasos de processamento em abas em segundo plano, para ao atingir o alvo e solicita vibração quando suportada. Não continua após recarregar a página, como o exemplo.
- As opções de cardio, séries, repetições e orientações importadas são preservadas. Links de vídeos HTTPS aparecem quando a prescrição tiver vídeo; a fonte não fornece vídeos.
- Administrador pode abrir e testar o painel na biblioteca. Aluno abre o programa normalmente e já recebe o painel. Em Seus treinos há acesso ao programa completo e botão para executar um treino avulso.
- A consulta estática de todo o programa fica em “Consultar prescrição completa”, recolhida no aluno.

## Armazenamento e limites

O app original usa localStorage, e esta implementação mantém esse modelo: chave versionada com UID autenticado e ID do programa; sessões com semana, ID do treino e identidade do exercício. Contas e programas não compartilham seus registros na interface. Dados recuperados são validados; erro de armazenamento é informado, sem declarar salvamento bem-sucedido.

O progresso permanece neste navegador/dispositivo, sem sincronização em nuvem ou painel de acompanhamento do administrador. Limpar os dados do navegador remove os registros. Quem controla o perfil do navegador consegue inspecionar seu armazenamento local: a separação das chaves não equivale a criptografia. A prescrição continua protegida pela autorização existente da API. Treino avulso e programa completo possuem registros separados; para acompanhar o ciclo e PRs, usar o programa completo.

Esta entrega reproduz as funções de execução; não deve ser descrita como uma cópia visual pixel a pixel. O HTML original não é executado em iframe nem injeta scripts no aplicativo. Os registros do app externo original não são migrados automaticamente.

## Validação local

- Vitest: 129 testes aprovados, 22 arquivos. Cinco testes novos cobrem ciclo de resultado, persistência após remontagem, separação entre contas, semanas/PRs/histórico, cronômetro, validação de dados e erro de salvamento.
- Playwright com emuladores: 31 testes aprovados, incluindo preenchimento real, marcação e recuperação depois de recarregar o programa.
- TypeScript e ESLint aprovados.

## Uso e rollback

Aluno: Programas → Ver o programa → escolher A–E; abrir exercício; preencher carga/reps e tocar no círculo do resultado; abrir Descanso para iniciar o cronômetro. SEM permite mudar semana; PRs permite cadastrar recordes. Na administração: Programas → abrir programa → Abrir app de treino / testar execução. A associação do programa inteiro permanece disponível.

Rollback do frontend: direcionar 100% do tráfego para `treino-web-00016-juj`, mantendo a chave Firebase atual. Isso oculta o painel, mas não remove o localStorage; voltar à nova versão recupera os registros. Não é necessário alterar backend, regras, contas ou dados de produção. Não apagar chaves de armazenamento como parte do rollback.

## Publicação e correção dos vínculos

Cloud Build `c90c9a09-8cba-49ef-82bd-88f38cd73348` concluído com sucesso. Web `treino-web-00019-xak`, imagem `sha256:433a53a9cdd6935c0106b20912a24441485b0dbe367913483cd8336f5dfe2af0`, publicado após smoke HTTP 200 sem tráfego; depois direcionado a 100% do tráfego. Backend e regras não foram alterados.

Durante a validação, o backend respondeu corretamente 403 ao duplicar o programa: a biblioteca apontava para cinco treinos já atribuídos ao mesmo aluno, mas o próprio programa não tinha aluno. O cadastro desse aluno estava ativo e não havia programa atribuído a ele. Esse estado explicava a ausência do ciclo completo na tela do aluno.

Correção em um único commit atômico do Firestore, com pré-condições de versão para o programa e os cinco treinos:

- Os cinco treinos já atribuídos foram preservados integralmente, com seus IDs e associação existentes.
- Criado `programs/louise-ciclo-2-atribuido`, associado ao mesmo aluno e referenciando os cinco treinos existentes, com periodização e observações originais.
- Criadas cinco cópias de biblioteca `louise-ciclo-2-biblioteca-A` até `E`, sem aluno, e atualizado apenas o vínculo do programa original `louise-ciclo-2` para essas cópias.
- Resultado: dois programas e dez treinos permanentes, mantendo separados o programa do aluno e o modelo reutilizável. Nenhum treino, conta ou documento existente foi excluído.

Backup anterior privado: `%LOCALAPPDATA%/TreinoLouiseOps/2026-09-30-program/before-program-repair-private.json`. Script com pré-condições e validação: `repair-program-association.ps1` na mesma pasta. Não reexecutar: os IDs existentes bloqueiam outra execução. O rollback de frontend não requer desfazer essa reparação. Se for necessário desfazer os vínculos, primeiro conferir se houve edições posteriores e fazer backup atualizado; usar o snapshot apenas para restaurar os campos do programa com pré-condição de versão, preservando todos os documentos criados e treinos existentes. Isso restaura também a inconsistência anterior, portanto não é o rollback recomendado.

As primeiras tentativas de validação de produção foram interrompidas pelo vínculo inconsistente e depois por um seletor incorreto do teste do cronômetro. O seletor foi corrigido no script privado, sem alterações no app por essa falha. Cada tentativa removeu somente suas próprias contas, programas e treinos temporários no bloco `finally`.

Validação final em produção: 13 verificações de navegador aprovadas, incluindo preview administrativo, login do aluno, preenchimento e marcação de séries, recuperação após reload, alternância para falha, PR de 100 kg com sugestões de 70 e 82,5 kg, troca de semana, histórico anterior, cronômetro avançando e pausando, cardio e viewport de 390 px. Associação inteira e leitura autorizada confirmadas para 5 treinos, 30 exercícios e 103 séries. Capturas `workout-player-sets-mobile.png` e `workout-player-mobile.png` na pasta operacional privada; a primeira foi inspecionada visualmente. Nenhuma conta real foi usada para entrar ou teve sua senha alterada.

Conferência após limpeza: 2 contas Auth, 2 perfis, 2 programas e 10 treinos; zero contas/perfis temporários. `treino-web-00019-xak` confirmado com 100% de tráfego, sem tag temporária. O teste é automatizado; não substitui o teste em aparelho físico pelo dono.
