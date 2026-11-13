# Parte 2 — mudanças e evidências

- A suíte passou a registrar 48 casos aprovados: 19 da API e 29 do app.
- O GitHub Actions executa verificações da API e do app em alterações do repositório.
- A função de sugestões passou de 109 para 23 linhas (78,9% menos linhas); regras fixas criadas a cada chamada passaram de 9 para 0.
- Dois testes manuais com TiDB Cloud passaram. Eles foram executados fora do pipeline.

A comparação com 10 casos é uma reconstrução posterior da baseline, não um resultado medido na Parte 1. Os 78,9% representam redução de linhas da função, não cobertura nem qualidade geral.
