# Diagnósticos Inteligentes — Base Técnica

Documento de referência para o painel **Diagnóstico Inteligente** do Terminal OBD
(Onix Joy 1.0 2018, flex, via ELM327 BLE). Serve para registrar a base matemática
de cada regra, quais são **consolidadas**, e o caminho de evolução.

> As regras vivem no array `DIAGNOSTICS` em `index.html`. Cada regra é uma função
> pura `(r, S) => mensagem | null`, onde `r` são as leituras ao vivo (`Store.data`)
> e `S` os buffers de tendência (`rpmHistory`, `stftHistory`, `sessionHistory`,
> `instConsumptionHistory`, `lastRuntime`, `stdev`). Adicionar uma regra = adicionar
> um item ao array.

**Estado atual: 21 regras ativas.** A revisão inicial encontrou 6 regras com falha;
todas foram corrigidas ou substituídas, e 7 novas fórmulas foram implementadas
(ver §4 e §5). O histórico completo da revisão está em §6.

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
> em malha aberta (partida a frio, plena carga, corte em desaceleração). As regras
> que o usam (mistura rica, DFCO) foram calibradas para reduzir esse efeito — ver §4.

---

## 2. Regras ativas (21)

Grupo **Mistura / combustível**

| # | Regra | Condição resumida | Base |
|---|-------|-------------------|------|
| 1 | Vazamento de vácuo | `rpm<1200 & MAP>45 & (STFT>10 ou LTFT>10)` | ✅ Consolidada |
| 2 | **Ajuste total (STFT+LTFT)** | `STFT+LTFT > +25%` (pobre) ou `< -25%` (rica) | ✅ Consolidada · N1 |
| 3 | Sensor de etanol | `etanol∈{0,100} & \|LTFT\|>15` | 🟡 Depende do PID 52 |
| 4 | Mistura rica (fora de WOT) | `λ<0,9 & throttle<50 & (STFT<-10 ou LTFT<-10)` | 🟡 λ comandado |
| 5 | DFCO não atua | `throttle<5 & rpm caindo>100 & rpm>1200 & λ<1,15` | 🟡 λ comandado |

Grupo **Temperatura**

| # | Regra | Condição resumida | Base |
|---|-------|-------------------|------|
| 6 | Termostato preso aberto | `rpm>1000 & runtime>300 & coolant<80 & LTFT>8` | ✅ Consolidada |
| 7 | **Superaquecimento** | `coolant>110` (crítico) ou `>105` (alerta) | ✅ Consolidada · N3 |
| 8 | Sensor IAT (parado) | `vel<5 & runtime>300 & coolant>80 & \|IAT-amb\|<2` | ✅ Consolidada · N6 |
| 9 | **Detonação por ar quente** | `IAT>60 & load>70 & timing<10` | ✅ Consolidada · N7 |

Grupo **Ar / eficiência**

| # | Regra | Condição resumida | Base |
|---|-------|-------------------|------|
| 10 | MAF × carga | `MAF<2 & load>50` | ✅ Consolidada |
| 11 | **Eficiência volumétrica** | `carga alta & VE(speed-density) < 65%` | ✅ Consolidada · N2 |
| 12 | Avanço baixo / detonação | `rpm>3000 & timing<5` | ✅ Consolidada |

Grupo **Sensores / plausibilidade**

| # | Regra | Condição resumida | Base |
|---|-------|-------------------|------|
| 13 | MAP = Barométrica (KOEO) | `rpm=0 & \|MAP-baro\|>3` | ✅ Consolidada (forte) |
| 14 | **MAP × acelerador (freio motor)** | `rpm>1500 & throttle<5 & MAP>50` | ✅ Consolidada · N5 |

Grupo **Elétrico**

| # | Regra | Condição resumida | Base |
|---|-------|-------------------|------|
| 15 | Alternador | `rpm>1500 & moduleV<13,5` | ✅ Consolidada |
| 16 | **Saúde da bateria (motor off)** | `rpm=0 & tensão<12,2 V` | ✅ Consolidada · N4 |
| 17 | Reset da ECU | `runtime < runtime_anterior-2` | ✅ Consolidada (forte) |

Grupo **Mecânico / consumo / status**

| # | Regra | Condição resumida | Base |
|---|-------|-------------------|------|
| 18 | Embreagem patinando | `g=rpm/vel sobe >30% & rpm sobe & vel ~ estável` | ✅ Consolidada (corrigida) |
| 19 | Marcha lenta instável | `vel=0 & desvio(rpm)>100` | ✅ Consolidada |
| 20 | Consumo de cruzeiro | `vel>40 & throttle<40 & média km/L<7` | 🟡 Depende da estimativa |
| 21 | Luz de injeção (MIL) | `milOn` | ✅ Consolidada (leitura direta) |

**Resumo:** 17 consolidadas · 4 com ressalva declarada (3/4/5/20). Nenhuma regra
com falha aberta.

---

## 3. Detalhe das regras consolidadas

- **Vazamento de vácuo (1).** Em marcha lenta o coletor de um motor aspirado fica em
  depressão (MAP ~30–40 kPa). MAP alto no ralenti com ajuste positivo = ar não
  medido entrando.
- **Ajuste total STFT+LTFT (2 · N1).** O melhor indicador de mistura é a *soma* dos
  ajustes: `|total| ≤ 10%` normal; `> ±25%` sustentado é a faixa que acende a MIL
  (P0171 pobre / P0172 rica).
- **Termostato preso aberto (6).** Após ~5 min o líquido deve passar de 80 °C;
  ficar abaixo com LTFT positivo é o padrão do **P0128**.
- **Superaquecimento (7 · N3).** Faixa normal 90–105 °C; alerta > 105 °C, crítico
  > 110 °C.
- **Sensor IAT parado (8 · N6).** Só espera IAT > ambiente **com o carro parado**
  (heat soak do cofre). A guarda `vel<5` elimina o falso positivo em estrada.
- **Detonação por ar quente (9 · N7).** Ar de admissão quente sob carga alta com
  avanço recuado qualifica o risco de detonação por temperatura.
- **MAF × carga (10).** Carga alta com MAF quase nulo é contradição física → MAF
  sub-reportando.
- **Eficiência volumétrica (11 · N2).** Ver a fórmula completa em §5. VE < 65% em
  carga alta = restrição (filtro/escape/válvulas/distribuição).
- **Avanço baixo (12).** Menos de 5° acima de 3000 rpm indica a ECU recuando o
  ponto (proteção contra detonação).
- **MAP = Barométrica com motor parado (13). ⭐** Teste de igualdade física exato;
  diferença > 3 kPa denuncia MAP descalibrado.
- **MAP × acelerador no freio motor (14 · N5).** Acelerador fechado em rotação alta
  deve gerar alta depressão (MAP baixo); MAP alto = borboleta presa/suja ou
  MAP/TPS com defeito.
- **Alternador (15).** Motor > 1500 rpm deve carregar a ~13,8–14,4 V; < 13,5 V =
  carga deficiente.
- **Saúde da bateria motor off (16 · N4).** Em repouso: ≥12,6 V ~100%, 12,4 V ~75%,
  12,2 V ~50%, ≤12,0 V descarregada.
- **Reset da ECU (17). ⭐** `runtime` é monotônico; se retrocede, houve
  reinício/reset.
- **Embreagem patinando (18).** Ver §4 (regra corrigida). Assinatura correta:
  relação `rpm/velocidade` sobe (motor acelera) sem a velocidade acompanhar.
- **Marcha lenta instável (19).** Desvio-padrão de RPM > 100 com o carro parado.
- **MIL (21).** Leitura direta do bit 7 do PID 0101.

---

## 4. Correções aplicadas (regras que tinham falha)

| Regra original | Falha | Correção implementada |
|----------------|-------|-----------------------|
| **Sonda envelhecida** (desvio do STFT) | Premissa invertida: STFT oscilando é comportamento *normal*; envelhecimento é frequência de comutação, não amplitude — e o polling é lento demais. | **Removida.** Precisaria de leitura rápida da tensão da sonda (PID 0114). |
| **Embreagem (TPS×carga)** e **Embreagem (tendência)** | A 1ª pegava transitório de aceleração; a 2ª tinha **assinatura invertida** (acusava trocas de marcha). | **Fundidas numa única regra** baseada na relação de transmissão instantânea `g = rpm/velocidade`: só acusa quando `g` sobe >30%, o RPM sobe e a velocidade fica ~estável, com o carro em movimento e acelerador aplicado. |
| **IAT × ambiente** | Falso positivo em movimento (IAT ≈ ambiente é normal rodando). | Adicionada a guarda `v_speed < 5` (regra 8 / N6). |
| **Mistura rica** (λ comandado) | Disparava no enriquecimento normal de plena carga (WOT). | Adicionada a guarda `throttle < 50` para excluir WOT (regra 4). |
| **DFCO** (λ comandado) | O λ comandado não confirma o corte de injeção real. | Mantida com a **ressalva documentada** de que usa o λ comandado (regra 5). Confirmação exige λ medido (PID 0134). |

---

## 5. Fórmulas das novas regras (implementadas)

### N1 — Ajuste de combustível total (STFT + LTFT) — *regra 2*
```
FT_total = STFT + LTFT           (%)
```
- `|FT_total| ≤ 10%` → normal.
- `FT_total > +25%` sustentado → mistura pobre (P0171): vazamento de vácuo, MAF
  sub-reportando, bomba/injetores fracos.
- `FT_total < -25%` → mistura rica (P0172): injetor vazando, pressão alta, MAF
  super-reportando.

*Fontes:* Innova, AA1Car, OBD-Codes.

### N2 — Eficiência Volumétrica (speed-density × MAF) — *regra 11*
Com `IAT_K = IAT + 273,15` (K), `MAP` em kPa, `V_disp = 1,0 L`:
```
IMAP     = (RPM × MAP) / (IAT_K × 2)
MAF_100% = IMAP × V_disp × 0,05807          (g/s, para VE=100%)
           └─ 0,05807 = M_ar / (R × 60) = 28,97 / (8,314 × 60)
VE(%)    = 100 × MAF_medido / MAF_100%
```
Só avaliada sob carga (`MAP ≥ 80% da barométrica`). VE < 65% → restrição de
admissão (filtro), escape obstruído (catalisador), folga de válvulas ou
distribuição fora de ponto. (Validado: cenário 5000 rpm / MAP 95 / IAT 70 °C /
MAF 20 g/s ⇒ VE ≈ 50%.)

*Fontes:* GMTuners, Lightner (obd2guru), TunerTools, HP Academy.

### N3 — Superaquecimento — *regra 7*
```
coolant > 110 °C → crítico      coolant > 105 °C → alerta
```
*Fontes:* HP Academy, VehicleFreak (faixa normal 90–105 °C).

### N4 — Saúde da bateria (motor desligado) — *regra 16*
```
rpm = 0 & tensão < 12,0 V → descarregada      < 12,2 V → carga baixa (~50%)
```
Usa `moduleV` (0142) ou, na falta, `ATRV`.

### N5 — Plausibilidade MAP × acelerador (freio motor) — *regra 14*
```
rpm > 1500 & throttle < 5 & MAP > 50 kPa → incoerência
```

### N6 — Correção do sensor IAT (guarda de velocidade) — *regra 8*
```
v_speed < 5 & runtime > 300 & coolant > 80 & |IAT - ambiente| < 2
```

### N7 — Risco de detonação por ar de admissão quente — *regra 9*
```
IAT > 60 °C & load > 70% & timing < 10°
```

### Embreagem patinando (corrigida) — *regra 18*
```
g = rpm / max(velocidade, 1)
Dispara: g_final > 1,3 × g_inicial  &  Δrpm > 300  &  Δvelocidade < 5
         &  velocidade em movimento (>15) &  throttle > 30
```

---

## 6. Evolução futura (precisa de PIDs que ainda não lemos)

- **Eficiência do catalisador**: exige a sonda **pós-catalisador** (PIDs de O₂ do
  sensor 2). Uma sonda traseira que "copia" a dianteira indica catalisador gasto
  (base do P0420).
- **λ medido real**: PID 0134 (razão de equivalência do sensor de O₂, banda larga)
  — o valor *medido*, que eliminaria as ressalvas das regras 4 e 5.
- **Tempo de resposta da sonda**: PID 0114 (tensão do O₂) lido em alta taxa —
  permitiria reintroduzir a detecção de sonda envelhecida de forma correta.

---

## 7. Fontes

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
