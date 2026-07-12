/**
 * Alinha histórico local (newest-first) com um snapshot da API (`last20Results`).
 * Preserva o buffer antigo quando há sobreposição reconhecível.
 */
export function reconcileHistoryWithApiSnapshot(
  local: readonly number[],
  api: readonly number[],
): number[] {
  if (api.length === 0) return [...local];
  if (local.length === 0) return [...api];

  if (local.length >= api.length) {
    let aligned = true;
    for (let i = 0; i < api.length; i++) {
      if (local[i] !== api[i]) {
        aligned = false;
        break;
      }
    }
    if (aligned) return [...local];
  }

  for (let k = 0; k <= local.length - api.length; k++) {
    let match = true;
    for (let j = 0; j < api.length; j++) {
      if (local[k + j] !== api[j]) {
        match = false;
        break;
      }
    }
    if (match) {
      return [...api, ...local.slice(k + api.length)];
    }
  }

  const maxLen = Math.min(api.length, local.length);
  for (let len = maxLen; len > 0; len--) {
    let ok = true;
    for (let i = 0; i < len; i++) {
      if (api[api.length - len + i] !== local[i]) {
        ok = false;
        break;
      }
    }
    if (ok) {
      return [...api.slice(0, api.length - len), ...local];
    }
  }

  return [...local];
}
