const out = document.getElementById("out");
const dryRunEl = document.getElementById("dryRun");

function render() {
  chrome.storage.local.get(
    ["gogLastBridge", "gogLastContext", "gogLastResults", "gogLastTest", "gogLastScan", "gogPragmaticDryRun"],
    (data) => {
      if (dryRunEl) dryRunEl.checked = data.gogPragmaticDryRun !== false;

      const lines = [];
      const bridge = data.gogLastBridge;
      const ctx = data.gogLastContext;
      const results = data.gogLastResults;

      if (!bridge) {
        lines.push("Sem eventos da app ainda.");
        lines.push("Sala Rotativa → Bot → modo Extensão → Activo");
      } else {
        lines.push(`Último: ${bridge.at}`);
        lines.push("", "Acções:");
        (bridge.actions || []).forEach((a) => {
          lines.push(a.kind === "wait" ? `  ⏳ ${a.reason}` : `  🖱 ${a.target} → ${a.label}`);
        });
      }

      if (ctx?.factor1BetKey) {
        lines.push("", `F1: ${ctx.factor1Label} → ${ctx.factor1BetKey}`);
      }
      if (ctx?.factor2BetKey) {
        lines.push(`F2: ${ctx.factor2Label} → ${ctx.factor2BetKey}`);
      }

      if (results?.length) {
        lines.push("", "Resultado:");
        results.forEach((r) => {
          lines.push(`  ${r.ok ? "✓" : "⚠"} ${r.target}${r.betKey ? ` (${r.betKey})` : ""}: ${r.detail}`);
        });
      }

      if (data.gogLastTest) {
        const t = data.gogLastTest;
        lines.push("", `Teste ${t.betKey}: ${t.ok ? "✓" : "⚠"} ${t.detail}`);
      }

      if (data.gogLastScan?.scans?.length) {
        lines.push("", "Varredura (melhor frame por chave):");
        const best = pickBestScanFrames(data.gogLastScan.scans);
        for (const [key, info] of Object.entries(best)) {
          lines.push(`  ${info.ok ? "✓" : "·"} ${key}: ${info.ok ? `score ${info.score}` : "—"}`);
        }
      }

      out.textContent = lines.join("\n");
    },
  );
}

function pickBestScanFrames(scans) {
  const out = {};
  for (const scan of scans) {
    if (!scan?.report) continue;
    for (const [key, info] of Object.entries(scan.report)) {
      const prev = out[key];
      if (!prev || (info.ok && (info.score ?? 0) > (prev.score ?? 0))) {
        out[key] = info;
      }
    }
  }
  return out;
}

dryRunEl?.addEventListener("change", () => {
  chrome.storage.local.set({ gogPragmaticDryRun: dryRunEl.checked });
});

document.querySelectorAll("button[data-bet]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const betKey = btn.getAttribute("data-bet");
    const label = btn.getAttribute("data-label") ?? betKey;
    chrome.storage.local.set({ gogPragmaticDryRun: dryRunEl?.checked !== false });
    chrome.runtime.sendMessage(
      { kind: "test-bet", betKey, label, dryRun: dryRunEl?.checked !== false },
      () => {
        render();
      },
    );
  });
});

document.getElementById("scan")?.addEventListener("click", () => {
  chrome.runtime.sendMessage({ kind: "scan-bets" }, () => render());
});

render();
