# stake37 — ICE 3 Fatores

Extensão Chrome para **ICE** (mesa **201** · Roulette 2 Extra Time).

## Estratégia

- **Gatilho:** no nº mais recente do histórico, encontra a **última ocorrência** anterior desse nº
- Aposta **cor + altura + paridade** do número imediatamente à **esquerda** dessa ocorrência (**3 un.**)
- Ex.: `[22, 5, 8, 22, …]` → eco do 22 na 4.ª posição → sinal = **8** (3 factores)
- Se o nº sai **em sequência** (ex. `22, 22`), **não** busca eco — espera o próximo número
- Vitória se acertar **≥2** factores
- Derrota parcial (falham 2 / acerta 1) → **+1 gale (×2)** via Dobrar
- Derrota total (falham 3 / zero) → **+2 gales consecutivos (×4)**
- Após derrota **espera nova indicação** (eco do nº novo) com a escala pendente
- Entrada em **unidades** (ficha + Dobrar): modo **auto** ou **manual**
- Auto: a cada **63 vitórias** dobra a entrada (1u → 2u → 4u…); gale 5 com ≥2u → volta a **1u**
- Manual: escolhe 1/2/4/8/16/32u no popup
- Ciclo completo a partir de 1u = **63u** (1+2+4+8+16+32)

Calibrar **📍 Dobrar** no popup antes do REAL.

## Instalação

```bash
npm run extension:ice3f:build
```

Chrome → `chrome://extensions` → Carregar `extension-ice-3fatores/`
