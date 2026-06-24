/**
 * Mostra o que `parseRouletteTableIdsFromEnv` devolve **sem** `ROULETTE_TABLE_IDS` nem `ROULETTE_TABLE_ID`
 * (fallback = `LOBBY_FIXED_TABLE_IDS` do lobby).
 *
 * Não carrega `.env` — para ver o efeito do teu `.env`, comenta as linhas `delete` abaixo ou corre com dotenv.
 *
 * Uso: npm run roulette:print-table-ids
 */
delete process.env.ROULETTE_TABLE_IDS;
delete process.env.ROULETTE_TABLE_ID;

const { parseRouletteTableIdsFromEnv } = await import("../src/lib/server/rouletteSocket.ts");
const { LOBBY_FIXED_TABLE_IDS } = await import("../src/lib/roulette/lobbyTables.ts");

const ids = parseRouletteTableIdsFromEnv();
console.log("parseRouletteTableIdsFromEnv() (env ROULETTE_* limpo neste processo):");
console.log(" ", ids.join(", "));
console.log("LOBBY_FIXED_TABLE_IDS (referência):");
console.log(" ", [...LOBBY_FIXED_TABLE_IDS].join(", "));
console.log(ids.length === LOBBY_FIXED_TABLE_IDS.length ? "\nOK: fallback = lobby completo." : "\nAviso: listas diferem.");
