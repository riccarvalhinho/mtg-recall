# data/

Os dados do MTG Recall. **Isto é a base de dados** — não há outra. Ver
`docs/adr/0002-dados-json-versionados.md` e `data-model.md`.

| Pasta | O que lá está |
|---|---|
| `schema/` | O contrato. Validado a cada push pelo `npm run validate` |
| `events/` | Um torneio por ficheiro, com os matches lá dentro |
| `taxonomies/opponents.json` | Os adversários, referenciados por id a partir dos matches |

Quem escreve aqui é a app no telemóvel, através da Contents API do GitHub (ADR 0004). Editar um
ficheiro à mão também funciona e é perfeitamente legítimo — corrigir o nome de um adversário ou uma
data errada é mais rápido no computador. Depois de mexer, correr:

```bash
npm run validate
```

Duas regras que a validação impõe e que é fácil esquecer: o campo `id` de um evento tem de ser igual
ao nome do ficheiro, e todo o `opponentId` tem de existir em `taxonomies/opponents.json`.
