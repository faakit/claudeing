# Diagnósticos Inteligentes — Base Técnica

Documento de referência para o painel **Diagnóstico Inteligente** do Terminal OBD
(Onix Joy 1.0 2018, flex, via ELM327 BLE). Serve para: (1) registrar quais regras
têm matemática/lógica sólida (**consolidadas**), (2) apontar as regras com falha
que precisam de revisão, e (3) listar novas fórmulas que podemos implementar,
todas baseadas apenas nos sensores que já lemos.

> As regras vivem no array `DIAGNOSTICS` em `index.html`. Cada regra é uma função
> pura `(r, S) => mensagem | null`, onde `r` são as leituras ao vivo e `S` os
> buffers de tendência (`rpmHistory`, `stftHistory`, `sessionHistory`,
> `instConsumptionHistory`, `lastRuntime`, `stdev`).

---

## 1. Sensores e fórmulas de conversão (PIDs)

Todas as fórmulas de *parsing* abaixo seguem o padrão **SAE J1979** e foram
conferidas — estão **corretas**. `A`, `B` são o 1º e o 2º byte de dados.

| Chave | PID | Grandeza | Fórmula | Unid. |
|-------|-----|----------|---------|-------|
| `rpm` | 010C | Rotação | `(256A+B)/4` | RPM |
| `v_speed` | 010D | Velocidade | `A` | km/h |
| `v_coolant` | 0105 | Temp. arrefecimento | `A-40` | °C |
| `v_iat` | 010F | Temp. ar admissão | `A-40` | °C |
| `v_ambient` | 0146 | Temp. ambiente | `A-40` | °C |
| `v_throttle` | 0111 | Posição do acelerador | `A·100/255` | % |
| `v_load` | 0104 | Carga calculada | `A·100/255` | % |
| `v_fuel` | 012F | Nível de combustível | `A·100/255` | % |
| `v_ethanol` | 0152 | Teor de etanol | `A·100/255` | % |
| `v_stft1` | 0106 | Ajuste curto prazo (STFT) | `(A-128)·100/128` | % |
| `v_ltft1` | 0107 | Ajuste longo prazo (LTFT) | `(A-128)·100/128` | % |
| `v_lambda` | 0144 | **Razão λ comandada** | `(256A+B)/32768` | λ |
| `v_map` | 010B | Pressão no coletor (MAP) | `A` | kPa |
| `v_baro` | 0133 | Pressão barométrica | `A` | kPa |
| `v_maf` | 0110 | Fluxo de ar (MAF) | `(256A+B)/100` | g/s |
| `v_timing` | 010E | Avanço de ignição | `A/2-64` | ° |
| `v_runtime` | 011F | Tempo desde a partida | `256A+B` | s |
| `v_mildist` | 0121 | Distância com MIL acesa | `256A+B` | km |
| `v_moduleV` | 0142 | Tensão do módulo (ECU) | `(256A+B)/1000` | V |
| `v_volts` | ATRV | Tensão do sistema | leitura direta | V |
| `milOn`, `dtcCount` | 0101 | MIL + nº de DTCs | bit 7 / bits 0-6 de `A` | — |

> ⚠️ **Atenção ao PID 0144:** ele é a **razão de equivalência *comandada*** (o alvo
> que a ECU pede), **não** o λ *medido* pela sonda. É um valor pensado para
> scanners genéricos (SAE J1979) e nem sempre reflete a mistura real, sobretudo
> em malha aberta (partida a frio, plena carga, corte em desaceleração). Isso
> afeta as regras que tratam esse valor como se fosse leitura de sonda — ver §3.

---

## 2. Veredito rápido das 17 regras atuais

| # | Regra | Condição resumida | Veredito |
|---|-------|-------------------|----------|
| 1 | Vazamento de vácuo | `rpm<1200 & MAP>45 & (STFT>10 ou LTFT>10)` | ✅ Consolidada |
| 2 | Sensor de etanol | `etanol∈{0,100} & \|LTFT\|>15` | 🟡 Ressalva (PID 52) |
| 3 | Termostato aberto | `rpm>1000 & runtime>300 & coolant<80 & LTFT>8` | ✅ Consolidada |
| 4 | Alternador | `rpm>1500 & moduleV<13,5` | ✅ Consolidada |
| 5 | Avanço baixo / detonação | `rpm>3000 & timing<5` | ✅ Consolidada |
| 6 | MAF × carga | `MAF<2 & load>50` | ✅ Consolidada |
| 7 | Mistura rica persistente | `λ<0,9 & (STFT<-10 ou LTFT<-10)` | ⚠️ Revisar (PID 44) |
| 8 | IAT × ambiente | `runtime>300 & \|IAT-amb\|<2 & coolant>80` | ⚠️ Revisar (falso positivo) |
| 9 | MAP = Barométrica (KOEO) | `rpm=0 & \|MAP-baro\|>3` | ✅ Consolidada (forte) |
| 10 | Sonda envelhecida | `\|LTFT\|<3 & desvio(STFT)>8` | ⚠️ Revisar (premissa fraca) |
| 11 | Embreagem (TPS×carga) | `throttle>55 & load<25` | ⚠️ Revisar (transitório) |
| 12 | Embreagem (tendência) | `Δvel>8 & Δrpm<50 & throttle>20` | ⚠️ Revisar (assinatura invertida) |
| 13 | DFCO não atua | `throttle<5 & rpm caindo>100 & rpm>1200 & λ<1,15` | ⚠️ Revisar (PID 44) |
| 14 | Reset da ECU | `runtime < runtime_anterior-2` | ✅ Consolidada (forte) |
| 15 | Consumo de cruzeiro | `vel>40 & throttle<40 & média km/L<7` | 🟡 Ressalva (estimativa) |
| 16 | Marcha lenta instável | `vel=0 & desvio(rpm)>100` | ✅ Consolidada |
| 17 | Luz de injeção (MIL) | `milOn` | ✅ Consolidada (leitura direta) |

**Resumo:** 9 consolidadas · 2 com ressalva · 6 a revisar.

---

## 3. Regras consolidadas (matemática e lógica corretas)

Estas podem ser tratadas como base confiável — a conta está correta e a condição
mapeia bem a falha que descreve.

- **R1 — Vazamento de vácuo.** Em marcha lenta o coletor de um motor aspirado fica
  em depressão (MAP típico ~30–40 kPa). MAP alto no ralenti **com** ajuste de
  combustível positivo (ECU adicionando combustível) é a assinatura clássica de ar
  não medido entrando por uma fenda.
- **R3 — Termostato preso aberto.** Após ~5 min o líquido deveria passar de 80 °C.
  Ficar abaixo disso com LTFT positivo é o comportamento do código **P0128**.
- **R4 — Alternador fraco.** Com o motor acima de 1500 rpm a tensão de carga deve
  ficar em ~13,8–14,4 V. Abaixo de 13,5 V indica carga deficiente. Comparação
  simples com limiar consagrado.
- **R5 — Avanço baixo / detonação.** Acima de 3000 rpm o avanço normal é ~20–40°.
  Menos de 5° indica a ECU recuando o ponto (proteção contra detonação). A
  conversão `A/2-64` está exata.
- **R6 — MAF × carga incoerentes.** Carga calculada alta (>50%) com MAF quase nulo
  (<2 g/s) é contradição física — bom indicador de MAF sub-reportando.
- **R9 — MAP = Barométrica (chave ligada, motor parado). ⭐** Com o motor parado o
  MAP deve ser **igual** à pressão barométrica (ambos absolutos, em kPa). Diferença
  > 3 kPa denuncia descalibração do MAP. É um teste de igualdade física exato —
  o diagnóstico mais robusto do conjunto.
- **R14 — Reset da ECU. ⭐** `runtime` (PID 011F) é monotônico crescente enquanto o
  motor roda. Se ele **retrocede** durante a sessão, houve reinício/reset. Lógica
  exata. (Obs.: uma parada+partida deliberada também dispara — é, de fato, um
  reset.)
- **R16 — Marcha lenta instável.** Com o carro parado, desvio-padrão de RPM > 100
  indica ralenti oscilando. Boa medida estatística de "hunting".
- **R17 — MIL acesa.** Leitura direta do bit 7 do PID 0101. Trivial e correta.

---

## 4. Falhas encontradas (regras a revisar)

### ⚠️ R8 — IAT × ambiente (falso positivo em movimento)
A regra assume que, com o motor quente, a temperatura do ar de admissão deve ficar
**acima** da ambiente (heat soak do cofre). Mas isso só vale **parado/em marcha
lenta**. **Rodando**, IAT ≈ ambiente é o esperado e desejável (ar fresco entrando).
Como a regra não checa velocidade, ela acusa "sensor IAT solto" em qualquer viagem
de estrada.
**Correção:** exigir `v_speed < 5` (condição de heat soak) antes de esperar IAT >
ambiente. Ver proposta **N6**.

### ⚠️ R10 — Sonda envelhecida via desvio do STFT (premissa fraca)
A regra marca "sonda lenta" quando o STFT oscila muito (`desvio>8`) e o LTFT está
perto de zero. O problema: **um STFT que oscila é justamente o comportamento
normal** de uma sonda de banda estreita saudável (ela força a mistura a ziguezaguear
em torno do estequiométrico). O sinal de uma sonda **preguiçosa** é a queda da
**frequência de comutação** (cross counts / tempo de resposta), **não** a
amplitude/desvio. Além disso, o polling é lento (~1 leitura por ciclo de vários
segundos), longe da taxa de comutação da sonda (~1 Hz+), então nem dá para medir
isso de forma confiável aqui. Resultado: a regra tende a disparar em motor
saudável.
**Correção:** remover, ou substituir por uma medida de resposta (exige leitura
rápida e dedicada da tensão da sonda — PID 0114, não lido hoje).

### ⚠️ R12 — Embreagem por tendência (assinatura invertida)
A regra dispara com **velocidade subindo e RPM parado** (`Δvel>8 & Δrpm<50`). Mas
a assinatura real de **embreagem patinando** é o **oposto**: o motor acelera
(RPM sobe rápido) e a velocidade **não** acompanha. "Velocidade sobe e RPM fica
parado" descreve, na prática, uma **troca de marcha para cima** (comportamento
normal), gerando falso positivo.
**Correção:** inverter a lógica — detectar `Δrpm` alto com `Δvel` ~ constante,
acelerador pressionado e carro em movimento (`v_speed>5`). Ainda é difícil separar
de reduções com "ponta-e-tacão"; ver **N-nota** em §5.

### ⚠️ R11 — Embreagem por TPS×carga (transitório)
`throttle>55 & load<25`. A assinatura (acelerador aberto sem a carga acompanhar) é
direcionalmente correta para embreagem patinando, mas o polling lento captura
**transitórios de aceleração** (pisada no acelerador antes do fluxo de ar/carga
subir) como se fossem permanentes. Falso positivo provável em cada arrancada.
**Correção:** exigir a condição sustentada por N ciclos, ou combinar com RPM
subindo e velocidade estável.

### ⚠️ R7 e R13 — uso do λ *comandado* (PID 44) como se fosse medido
Ambas comparam `v_lambda` (PID 0144) contra limiares de mistura:
- **R7** (mistura rica): `λ<0,9` pode ser simplesmente **enriquecimento de plena
  carga** comandado pela ECU (malha aberta) — situação **normal** em aceleração
  forte, quando os ajustes de combustível ficam congelados.
- **R13** (DFCO): durante o corte em desaceleração o λ *comandado* reportado não
  reflete de forma confiável o corte de injeção real.

Como o PID 44 é o valor **comandado** (alvo), não a leitura da sonda, as duas regras
podem enganar.
**Correção:** ou (a) restringir R7 a `throttle` baixo/médio (fora de WOT) para
evitar o enriquecimento normal, ou (b) usar a **sonda de banda larga** (PID 0134,
"razão de equivalência do sensor de O₂"), que é o valor *medido*, se a ECU
suportar. Documentar que hoje o valor é o comandado.

---

## 5. Novas fórmulas propostas (com fontes)

Ordenadas por **valor × solidez**, todas usando **apenas sensores que já lemos**
(exceto onde indicado). As duas primeiras são as de maior retorno.

### N1 — Ajuste de combustível total (STFT + LTFT) ⭐ consolidável
O melhor indicador de mistura vem da **soma** dos dois ajustes, não deles isolados:

```
FT_total = STFT + LTFT           (%)
```

- `|FT_total| ≤ 10%` → normal.
- `FT_total > +20…25%` sustentado → **mistura pobre** (faixa do código P0171):
  vazamento de vácuo, MAF sub-reportando, bomba/injetores fracos.
- `FT_total < -20…25%` → **mistura rica** (P0172): injetor vazando, pressão de
  combustível alta, MAF super-reportando.

Sensores: `v_stft1` (0106) + `v_ltft1` (0107). Limiar de ±25% é o usado pela
maioria dos fabricantes para acender a MIL; a faixa saudável é ±10%.
*Fontes:* Innova, AA1Car, OBD-Codes (ver §6).

### N2 — Eficiência Volumétrica (VE) por speed-density × MAF ⭐
Cruza MAF medido com o fluxo teórico calculado por *speed-density* (lei dos gases).
Com `IAT_K = IAT + 273,15` (K), `MAP` em kPa, `V_disp = 1,0 L`:

```
IMAP     = (RPM × MAP) / (IAT_K × 2)
MAF_100% = IMAP × V_disp × 0,05807          (g/s, para VE=100%)
           └─ 0,05807 = M_ar / (R × 60) = 28,97 / (8,314 × 60)
VE(%)    = 100 × MAF_medido / MAF_100%
```

Uso diagnóstico:
- **Em carga alta** (MAP > ~80% da barométrica, próximo de WOT) a VE deve ficar em
  **75–90%**. VE < ~65% → restrição de admissão (filtro de ar entupido), escape
  obstruído (catalisador), folga de válvulas ou distribuição/corrente adiantada.
- **Divergência MAF × speed-density** persistente (> ~20%, assumindo VE nominal)
  → sensor **MAF** ou **MAP** com defeito (cross-check entre os dois).

Sensores: `v_maf` (0110), `v_map` (010B), `rpm` (010C), `v_iat` (010F);
`V_disp=1,0 L` é conhecido do carro.
*Fontes:* GMTuners, Lightner (obd2guru), TunerTools, HP Academy.

### N3 — Superaquecimento / temperatura fora de faixa ⭐ consolidável (hoje ausente)
Não temos nenhum alerta de motor **quente** — só o de termostato preso aberto.

```
coolant > 105 °C  → alerta de superaquecimento
coolant > 110 °C  → crítico (risco de dano)
```

Complemento ao R3 (preso aberto): `coolant` não atingir 80 °C após `runtime>600 s`
com `rpm>800` reforça o diagnóstico de termostato travado aberto.
Sensores: `v_coolant` (0105), `v_runtime` (011F).
*Fontes:* HP Academy, VehicleFreak (faixa normal 90–105 °C; MIL/alerta ~110 °C).

### N4 — Saúde da bateria (motor desligado) ⭐ consolidável
Com o motor parado (`rpm=0`, alternador sem carregar), a tensão em repouso indica
o estado de carga:

```
moduleV ≥ 12,6 V → ~100%      12,4 V → ~75%
moduleV  12,2 V → ~50%        ≤ 12,0 V → descarregada / fraca
```

Alerta quando `rpm=0 & moduleV < 12,2 V`. Complementa o R4 (que cobre o caso
"motor rodando"). Sensores: `v_moduleV` (0142) ou `ATRV`.

### N5 — Plausibilidade MAP × acelerador em desaceleração
No "freio motor" (acelerador fechado, RPM alto), o coletor deve estar em **alta
depressão** (MAP baixo). Se com `throttle<5 & rpm>1500` o `MAP` estiver alto
(> ~50 kPa), há incoerência entre borboleta e MAP → corpo de borboleta preso/suja
ou sensor MAP/TPS com defeito.
Sensores: `v_throttle` (0111), `v_map` (010B), `rpm` (010C).

### N6 — Correção do R8 (IAT com guarda de velocidade)
Reescrever a regra do sensor IAT para só esperar IAT > ambiente **quando o carro
está parado** e o motor quente (condição de heat soak):

```
v_speed < 5  &  runtime > 300  &  coolant > 80  &  |IAT - ambiente| < 2
```

Elimina o falso positivo em estrada e mantém a detecção do sensor "colado" na
ambiente com o motor fervendo parado.

### N7 — Risco de detonação por ar de admissão quente
Ar de admissão quente sob carga eleva o risco de detonação. Cruzar `IAT` alto
(> ~60 °C) **com** carga alta (`load>70`) **e** avanço recuado (`timing` baixo)
reforça e qualifica o R5 (distingue "detonação por ar quente" de "por octanagem").
Sensores: `v_iat` (010F), `v_load` (0104), `v_timing` (010E).

> **Nota sobre embreagem (R11/R12):** com os sensores disponíveis, a separação
> confiável entre *patinação de embreagem*, *troca de marcha* e *aceleração em
> ponto morto* é intrinsecamente difícil (faltaria uma relação marcha =
> `rpm/velocidade` estável ao longo do tempo). A abordagem mais robusta é calcular
> a **relação de transmissão instantânea** `g = rpm / max(v_speed,1)` e sinalizar
> quando `g` **sobe abruptamente** e permanece elevada com o carro em movimento e
> acelerador aplicado — isso sim é a assinatura de patinação. Fica como evolução
> futura de N-nível.

### Precisam de PIDs que ainda não lemos (evolução futura)
- **Eficiência do catalisador**: exige a sonda **pós-catalisador** (PIDs de O₂
  do sensor 2). Uma sonda traseira que "copia" a dianteira indica catalisador
  gasto (base do P0420).
- **λ medido real**: PID 0134 (razão de equivalência do sensor de O₂, banda larga)
  — o valor *medido*, que corrigiria as ressalvas de R7/R13.
- **Tempo de resposta da sonda**: PID 0114 (tensão do O₂) lido em alta taxa.

---

## 6. Fontes

**Ajuste de combustível (fuel trim):**
- Innova — *Reading Fuel Trim in Live Data*: <https://www.innova.com/blogs/fix-advices/reading-fuel-trim-in-live-data>
- AA1Car — *What Is Fuel Trim?*: <https://www.aa1car.com/library/what_is_fuel_trim.htm>
- OBD-Codes — *What are fuel trims all about?*: <https://www.obd-codes.com/faq/fuel-trims.php>

**Speed-density / Eficiência Volumétrica:**
- GMTuners — *MAF, MAP, and IAT Sensors*: <http://www.gmtuners.com/tech/MAF_MAP_IAT.htm>
- Lightner (obd2guru) — *MAP- and MAF-Based Air/Fuel Flow Calculator*: <https://www.lightner.net/obd2guru/IMAP_AFcalc.html>
- TunerTools — *Load Control and Calculation*: <https://tunertools.com/pages/load-control-and-calculation>
- HP Academy — *Air Flow and Volumetric Efficiency*: <https://www.hpacademy.com/forum/efi-tuning/show/air-flow-and-volumetric-efficiency-3/>

**PID 44 (razão de equivalência comandada):**
- Wikipedia — *OBD-II PIDs*: <https://en.wikipedia.org/wiki/OBD-II_PIDs>
- CSS Electronics — *OBD2 PID Overview (J1979)*: <https://www.csselectronics.com/pages/obd2-pid-table-on-board-diagnostics-j1979>

**Temperatura de arrefecimento:**
- HP Academy — *Engine Coolant Temperatures: What Is Safe?*: <https://www.hpacademy.com/technical-articles/coolant-temperatures-what-is-safe-quick-tech/>
- VehicleFreak — *Average Coolant Temp*: <https://vehiclefreak.com/average-coolant-temp-whats-a-normal-temperature/>

---

*Aviso: todas as regras são heurísticas de apoio baseadas em PIDs OBD-II genéricos.
Elas apontam direção de investigação e não substituem a confirmação com scanner de
fábrica ou por um mecânico antes de qualquer troca de peça.*
