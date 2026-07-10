import {

  detectIceDuziaTrigger,

  evaluateIceDuziaRound,

  iceMissingDozen,

  icePickExcludedNumbers,

  iceBuildCoveredNumbers,

  iceStakePlanForRecovery,

  tickIceDuziaPlacar,

  defaultIceDuziaMachineState,

  emptyIceDuziaStats,

} from "../src/lib/roulette/iceDuziaEvolutionStrategy.ts";

import { umFatorOppositeFactor, umFatorSharedFactorsBetween } from "../src/lib/roulette/umFatorStrategy.ts";

import { columnOf } from "../src/lib/roulette/streetPairTrigger.ts";



// Exemplo do utilizador: 36 e 22 → Par/Alto, dúzias 2+3, missing 1

const hist = [22, 36, 5, 11, 7, 3, 9, 14, 18, 21];

const t = detectIceDuziaTrigger(hist, () => 0.1);

console.log("trigger", t?.armingDescription);

console.log("dozens", t?.dozen1, t?.dozen2, "missing", t?.missingDozen);

console.log("excluded", t?.excludedNumbers);

console.log("covered", t?.coveredNumbers?.join(","));

console.log("covered count", t?.coveredNumbers?.length);



const shared = umFatorSharedFactorsBetween(22, 36);

const opp = shared.map(umFatorOppositeFactor);

console.log("shared", shared.map((f) => `${f.kind}:${f.value}`).join(","));

console.log("opposite", opp.map((f) => `${f.kind}:${f.value}`).join(","));



const missing = iceMissingDozen(22, 36)!;

const triggerNums = [36, 22] as const;

const excluded = icePickExcludedNumbers(missing, opp[0]!, opp[1]!, hist, triggerNums, () => 0.2);

console.log("manual excluded", excluded);

if (excluded) {

  const covered = iceBuildCoveredNumbers(missing, excluded);

  console.log("covered", covered.length, covered.includes(0));

  // Bloqueio absoluto: nenhum excluído nos últimos 12 nem nas colunas do gatilho

  const recent = new Set(hist.slice(0, 12).filter((n) => n > 0));

  const cols = new Set([columnOf(36)!, columnOf(22)!]);

  for (const n of excluded) {

    if (recent.has(n)) throw new Error(`excluído recente: ${n}`);

    if (cols.has(columnOf(n)!)) throw new Error(`excluído mesma coluna: ${n}`);

  }

  console.log("loss on excluded", evaluateIceDuziaRound(excluded[0]!, t!));

  console.log("win on covered", evaluateIceDuziaRound(covered[1]!, t!));

}



// Histórico cheio de ímpar/baixo na 1ª dúzia → bloqueados; exclusão só fora deles

const protectHist = [1, 3, 5, 7, 9, 11, 22, 36];

const ex2 = icePickExcludedNumbers(missing, opp[0]!, opp[1]!, protectHist, triggerNums, () => 0.5);

console.log("with protect hist excluded", ex2);



// Colunas do gatilho 36 (col 3) e 22 (col 1) → nunca excluir col 1 e 3

const colProtected = icePickExcludedNumbers(missing, opp[0]!, opp[1]!, [], triggerNums, () => 0.3);

console.log("column protect excluded", colProtected);

if (colProtected) {

  for (const n of colProtected) {

    const c = columnOf(n)!;

    if (c === 1 || c === 3) throw new Error(`coluna bloqueada excluída: ${n}`);

  }

}



// Caso 14+1: 35 recente + col 2 do gatilho → 35 nunca excluído; se só 1 livre no pool oposto, completa na dúzia ou null

const hist141 = [14, 1, 26, 17, 3, 22, 35, 21, 26, 3];

const t141 = detectIceDuziaTrigger(hist141, () => 0.7);

console.log("14+1 trigger", t141?.excludedNumbers, t141?.armingDescription);

if (t141?.excludedNumbers.includes(35)) throw new Error("35 não pode ser excluído");



console.log("stake entrada", iceStakePlanForRecovery(0));

console.log("stake fib2", iceStakePlanForRecovery(2));



console.log("win on 0", evaluateIceDuziaRound(0, t!));

console.log("win on 22", evaluateIceDuziaRound(22, t!));



let m = defaultIceDuziaMachineState();

m.lastSpinHead = "1:36";

let s = emptyIceDuziaStats();

const r = tickIceDuziaPlacar([22, 36], m, s);

console.log(

  "armed",

  r.machine.cycle?.dozenUnits,

  r.machine.cycle?.numberUnits,

  r.machine.cycle?.active.coveredNumbers.length,

);


