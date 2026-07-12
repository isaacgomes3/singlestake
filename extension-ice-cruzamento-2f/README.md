# stake37 — ICE Cruzamento 2 Fatores

Extensão Chrome para **ICE** (mesa **201** · Roulette 2 Extra Time).

## Estratégia

- Compara as posições críticas **11** e **22** no histórico
- Alerta os **2 factores em comum** quando o par partilha:
  - **cor/altura**, ou
  - **paridade/altura**, ou
  - **cor/paridade**
- Se partilham **3** factores → prioriza **cor/paridade**
- Aposta esses 2 factores no tapete
- Após derrota/empate/janela perdida: **fecha** a indicação; gale fica para o **próximo** match 11/22
- **Indicação única** — não reutiliza factores antigos quando o histórico avança
- Vitória: zera gale
- **Zero** = derrota (gale normal)
- Gales até **5** via **Dobrar** (1 ficha/factor + N× Dobrar)

## Instalação

```bash
npm run extension:ice2f:build
```

Chrome → `chrome://extensions` → Carregar `extension-ice-cruzamento-2f/`

Popup fixo (ícone da extensão) — não fecha ao clicar na mesa.
