# Plano de melhoria da Parte 2

## Baseline reconstruída

A entrega da Parte 1 descreve o Lembriê, registra a dificuldade de abrir o app no celular em 01/10/2026 e propõe um checklist, mas não apresenta resultados numéricos de análise estática nem contagem de testes executados. Para não inventar dados, esta etapa usa uma baseline reproduzível do repositório em `62038b9` (12/11/2026), medida com a mesma busca de casos `it()`/`test()` usada na versão atual. O commit contém 10 casos automatizados. Esta reconstrução não substitui métricas que deveriam ter sido coletadas na Parte 1.

## Problemas escolhidos e metas

| Problema observado | Evidência inicial | Ação planejada | Indicador e método | Meta |
|---|---|---|---|---|
| Comportamentos críticos da API e telas tinham pouca proteção automatizada | 10 casos nos testes versionados em `62038b9`; sem testes HTTP de integração ou testes de componentes | Ampliar a suíte com testes HTTP da API e componentes/telas; executar os comandos existentes de teste e tipos | Contar `it()` e `test()` nos arquivos `*.test.ts` e `*.test.tsx` | Pelo menos 25 casos, todos passando |
| A verificação dependia de execução manual | Nenhum workflow de CI no repositório na baseline | Adicionar GitHub Actions para instalar dependências e executar testes, typecheck e build em `push` e `pull_request` | Arquivo de workflow presente e uma execução verde visível no GitHub | Workflow acionado nos dois eventos; todas as etapas verdes |

## Refatoração planejada

Mover a tabela estática de regras de destino para o escopo do módulo em `server/src/servicos/sugestoes.ts`. O comportamento público será preservado e conferido pela suíte de serviços. Os indicadores serão: (1) quantidade de entradas da tabela criadas por chamada, meta de 9 para 0; (2) linhas da função `sugerirItensDestino`, reduzidas ao retirar a declaração da tabela local. Os valores serão medidos no mesmo arquivo antes e depois.

## Riscos e limites

A maior quantidade de testes protege os fluxos cobertos, mas não comprova o funcionamento físico do BLE, o envio de e-mail nem a integração com banco real. O CI usa dependências do lockfile e não acessa serviços externos. A Parte 1 não forneceu uma medida estática comparável, então nenhuma variação de Sonar ou cobertura será alegada.
