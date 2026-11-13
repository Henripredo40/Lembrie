# Plano de melhoria da Parte 2

## Baseline

A Parte 1 descreveu critérios e um checklist, mas não registrou resultados executados nem métricas numéricas. A baseline de 10 casos foi reconstruída posteriormente no commit `62038b9` (12/11/2026); não é um resultado da Parte 1.

## Problemas e resultados

| Problema | Ação | Resultado registrado |
| --- | --- | --- |
| Poucos testes automatizados | Ampliar testes de API, componentes e regras do app | 48 casos aprovados: 19 da API e 29 do app |
| Verificação manual | Criar pipeline para testes, tipos e build | GitHub Actions executa verificações da API e do app |
| Regras recriadas a cada chamada | Mover regras fixas para fora da função | 9 regras por chamada passaram a 0; função de 109 para 23 linhas |
| Integração com banco real sem evidência | Executar fluxos temporários no TiDB Cloud | 2 testes manuais aprovados, fora do pipeline |

## Limites

Os 78,9% referem-se apenas à redução de linhas da função. Os testes não comprovam funcionamento físico do Bluetooth, envio de e-mail ou cobertura total do sistema. A Parte 1 não registrou medidas comparáveis.
