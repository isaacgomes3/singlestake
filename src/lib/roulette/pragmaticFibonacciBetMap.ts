import type { FibonacciZone } from "@/lib/roulette/rotatingRoomFibonacciStrategy";

export type PragmaticFibonacciBetKey = `doz:${1 | 2 | 3}` | `col:${1 | 2 | 3}`;

export type PragmaticFibonacciBetProfile = {
  key: PragmaticFibonacciBetKey;
  appLabel: string;
  textHints: readonly string[];
  dataHints: readonly string[];
  classHints: readonly string[];
};

export const PRAGMATIC_FIBONACCI_BET_PROFILES: Record<
  PragmaticFibonacciBetKey,
  PragmaticFibonacciBetProfile
> = {
  "doz:1": {
    key: "doz:1",
    appLabel: "1.ª Dúzia",
    textHints: ["1ª dúzia", "1a duzia", "1st 12", "1-12", "1–12", "primeira duzia"],
    dataHints: ["dozen1", "DOZEN1", "1st12", "1st_12", "doz1"],
    classHints: ["dozen1", "doz-1", "1st12"],
  },
  "doz:2": {
    key: "doz:2",
    appLabel: "2.ª Dúzia",
    textHints: ["2ª dúzia", "2a duzia", "2nd 12", "13-24", "13–24", "segunda duzia"],
    dataHints: ["dozen2", "DOZEN2", "2nd12", "2nd_12", "doz2"],
    classHints: ["dozen2", "doz-2", "2nd12"],
  },
  "doz:3": {
    key: "doz:3",
    appLabel: "3.ª Dúzia",
    textHints: ["3ª dúzia", "3a duzia", "3rd 12", "25-36", "25–36", "terceira duzia"],
    dataHints: ["dozen3", "DOZEN3", "3rd12", "3rd_12", "doz3"],
    classHints: ["dozen3", "doz-3", "3rd12"],
  },
  "col:1": {
    key: "col:1",
    appLabel: "Coluna 1",
    textHints: ["coluna 1", "column 1", "col 1", "2 to 1"],
    dataHints: ["column1", "COLUMN1", "col1", "col_1"],
    classHints: ["column1", "col-1"],
  },
  "col:2": {
    key: "col:2",
    appLabel: "Coluna 2",
    textHints: ["coluna 2", "column 2", "col 2"],
    dataHints: ["column2", "COLUMN2", "col2", "col_2"],
    classHints: ["column2", "col-2"],
  },
  "col:3": {
    key: "col:3",
    appLabel: "Coluna 3",
    textHints: ["coluna 3", "column 3", "col 3"],
    dataHints: ["column3", "COLUMN3", "col3", "col_3"],
    classHints: ["column3", "col-3"],
  },
};

export function pragmaticFibonacciBetKeyFromZone(zone: FibonacciZone): PragmaticFibonacciBetKey {
  return zone.kind === "dozen" ? `doz:${zone.id}` : `col:${zone.id}`;
}
