/**
 * Formato .prime — backup encriptado do painel Playtech.
 * Magic: "+P\n" + versão (bytes 3-4) + payload binário.
 */

export type PrimeBackupInfo = {
  magic: string;
  versionByte: number;
  subVersionByte: number;
  payloadBytes: number;
  entropy: number;
  isEncrypted: boolean;
};

export function readPrimeFile(raw: string): Buffer {
  const text = raw.trim();
  if (!text) throw new Error("Ficheiro .prime vazio");
  try {
    return Buffer.from(text, "base64");
  } catch {
    throw new Error("Conteúdo .prime inválido (esperado base64)");
  }
}

export function analyzePrimeBuffer(buf: Buffer): PrimeBackupInfo {
  const magic = buf.subarray(0, 3).toString("utf8");
  const freq = new Array<number>(256).fill(0);
  for (const b of buf) freq[b]++;
  const entropy = -freq
    .filter((f) => f > 0)
    .reduce((s, f) => {
      const p = f / buf.length;
      return s + p * Math.log2(p);
    }, 0);

  return {
    magic,
    versionByte: buf[3] ?? 0,
    subVersionByte: buf[4] ?? 0,
    payloadBytes: Math.max(0, buf.length - 5),
    entropy,
    isEncrypted: entropy > 6.2 || magic !== "+P\n",
  };
}

export function assertPrimeBackup(buf: Buffer): PrimeBackupInfo {
  const info = analyzePrimeBuffer(buf);
  if (info.magic !== "+P\n") {
    throw new Error(`Magic inválido: ${JSON.stringify(info.magic)} (esperado "+P\\n")`);
  }
  return info;
}

/** Tentativa de decode — preencher quando tivermos o algoritmo do painel. */
export function decodePrimePayload(_buf: Buffer): unknown {
  throw new Error(
    "Formato .prime encriptado — use IMPORTAR CONFIG no painel Playtech, ou envie o código de decrypt do bot.",
  );
}
