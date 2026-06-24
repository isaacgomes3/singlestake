# Roulette Macao (DGA Pragmatic)

A app inclui a mesa **Roulette Macao** no lobby ao vivo, ao lado de Auto / Speed / Roulette 1, com as mesmas funções (histórico local, Ruas 9%, URL do casino por mesa, etc.).

## Chave DGA (`tableKey`)

O identificador numérico **varia por operador**. Para o `ROULETTE_CASINO_ID` por defeito deste repositório (`ppcdk00000005148`), a mesa **Roulette Macao** na DGA corresponde à chave **206** (confirmado com `npm run dga:inspect-table-names` e `npm run dga:verify-macao`).

1. Lista IDs disponíveis para o teu `ROULETTE_CASINO_ID`:

   ```bash
   npm run dga:list-tables
   ```

2. Confirma que recebes `last20Results` para esse id (por defeito **206**):

   ```bash
   npm run dga:verify-macao
   ```

   Opcional no `.env`: `ROULETTE_MACAO_TABLE_ID=…` (e o mesmo em `VITE_ROULETTE_MACAO_TABLE_ID`).

2b. Para mapear nomes → IDs no teu casino:

   ```bash
   npm run dga:inspect-table-names
   ```

3. Ou sonda IDs à mão:

   ```bash
   DGA_PROBE_IDS=198,199,200,201,202,203 npm run dga:probe-spins
   ```

## Variáveis de ambiente

| Variável | Onde |
|----------|------|
| `VITE_ROULETTE_MACAO_TABLE_ID` | Build Vite (browser) — mesmo significado que a chave DGA |
| `ROULETTE_MACAO_TABLE_ID` | Node / scripts / SSR, se não usares só o Vite |

Se nenhuma estiver definida, usa-se **206** (Macao no casino por defeito do repo).

Se o cartão **mostrava giros e deixou de mostrar**, verifique se não tem `VITE_ROULETTE_MACAO_TABLE_ID` / `ROULETTE_MACAO_TABLE_ID` com um id **errado** (ex. 201): o histórico grava-se na chave que o **servidor** usa (SSE); o lobby agora **alinha** o quarto cartão ao `ready.tableIds` quando o id configurado não coincide com a lista ao vivo.

## Servidor / SSE

`parseRouletteTableIdsFromEnv()` faz merge com `LOBBY_FIXED_TABLE_IDS`, que já inclui a Macao. Não é obrigatório acrescentar manualmente a mesa em `ROULETTE_TABLE_IDS` a menos que queiras **outra** ordem (a primeira id continua a ser a «mesa principal» para espelho / Ruas).
