/**
 * O pacote `ws` usa opcionalmente `bufferutil` (nativo). Quando o Nitro faz bundle de `ws`,
 * `bufferUtil.mask` deixa de existir → `TypeError: bufferUtil$1.mask is not a function`.
 * Forçar fallback JS antes de qualquer `import "ws"`.
 */
if (!process.env.WS_NO_BUFFER_UTIL) process.env.WS_NO_BUFFER_UTIL = "1";
if (!process.env.WS_NO_UTF_8_VALIDATE) process.env.WS_NO_UTF_8_VALIDATE = "1";
