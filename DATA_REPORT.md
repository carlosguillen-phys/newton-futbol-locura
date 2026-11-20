# DATA_REPORT

Reporte generado por `backend/scripts/profile_data.py`. Los literales vacío, `NA` y `None` cuentan como nulos.

## Resumen general

| Métrica | Valor |
|---|---|
| Archivos de tracking leídos | 122 |
| Filas de tracking (suma de todos los archivos) | 8314178 |
| gameId distintos (unión de todas las fuentes) | 122 |
| gameId distintos en games.csv | 122 |
| gameId distintos en plays.csv | 122 |
| gameId distintos en tracking | 122 |
| Jugadas distintas (gameId+playId) en plays.csv | 8557 |
| Jugadas distintas (gameId+playId) en tracking | 8557 |
| Jugadas distintas (gameId+playId) en pffScoutingData | 8557 |
| Jugadas distintas (unión de las tres fuentes) | 8557 |

## Cobertura temporal y equipos

- Semana mínima: 1
- Semana máxima: 8
- Semanas presentes: 1, 2, 3, 4, 5, 6, 7, 8
- Fecha de juego más temprana: 2021-09-09
- Fecha de juego más tardía: 2021-11-01
- Equipos (32): ARI, ATL, BAL, BUF, CAR, CHI, CIN, CLE, DAL, DEN, DET, GB, HOU, IND, JAX, KC, LA, LAC, LV, MIA, MIN, NE, NO, NYG, NYJ, PHI, PIT, SEA, SF, TB, TEN, WAS

## Columnas y porcentaje de nulos

### games.csv

Filas: 122

| Columna | % nulos |
|---|---|
| gameId | 0.0 |
| season | 0.0 |
| week | 0.0 |
| gameDate | 0.0 |
| gameTimeEastern | 0.0 |
| homeTeamAbbr | 0.0 |
| visitorTeamAbbr | 0.0 |

### plays.csv

Filas: 8557

| Columna | % nulos |
|---|---|
| gameId | 0.0 |
| playId | 0.0 |
| playDescription | 0.0 |
| quarter | 0.0 |
| down | 0.0 |
| yardsToGo | 0.0 |
| possessionTeam | 0.0 |
| defensiveTeam | 0.0 |
| yardlineSide | 1.46 |
| yardlineNumber | 0.0 |
| gameClock | 0.0 |
| preSnapHomeScore | 0.0 |
| preSnapVisitorScore | 0.0 |
| passResult | 0.0 |
| penaltyYards | 91.17 |
| prePenaltyPlayResult | 0.0 |
| playResult | 0.0 |
| foulName1 | 91.4 |
| foulNFLId1 | 91.4 |
| foulName2 | 99.65 |
| foulNFLId2 | 99.65 |
| foulName3 | 99.99 |
| foulNFLId3 | 99.99 |
| absoluteYardlineNumber | 0.01 |
| offenseFormation | 0.08 |
| personnelO | 0.01 |
| defendersInBox | 0.08 |
| personnelD | 0.01 |
| dropBackType | 6.17 |
| pff_playAction | 0.0 |
| pff_passCoverage | 0.0 |
| pff_passCoverageType | 0.0 |

### players.csv

Filas: 1679

| Columna | % nulos |
|---|---|
| nflId | 0.0 |
| height | 0.0 |
| weight | 0.0 |
| birthDate | 13.82 |
| collegeName | 13.34 |
| officialPosition | 0.0 |
| displayName | 0.0 |

### pffScoutingData.csv

Filas: 188254

| Columna | % nulos |
|---|---|
| gameId | 0.0 |
| playId | 0.0 |
| nflId | 0.0 |
| pff_role | 0.0 |
| pff_positionLinedUp | 0.0 |
| pff_hit | 50.0 |
| pff_hurry | 50.0 |
| pff_sack | 50.0 |
| pff_beatenByDefender | 74.46 |
| pff_hitAllowed | 74.46 |
| pff_hurryAllowed | 74.46 |
| pff_sackAllowed | 74.46 |
| pff_nflIdBlockedPlayer | 75.29 |
| pff_blockType | 74.55 |
| pff_backFieldBlock | 74.55 |

### tracking/*.csv (122 archivos)

Filas: 8314178

| Columna | % nulos |
|---|---|
| gameId | 0.0 |
| playId | 0.0 |
| nflId | 4.35 |
| frameId | 0.0 |
| time | 0.0 |
| jerseyNumber | 4.35 |
| team | 0.0 |
| playDirection | 0.0 |
| x | 0.0 |
| y | 0.0 |
| s | 0.0 |
| a | 0.0 |
| dis | 0.0 |
| o | 4.35 |
| dir | 4.35 |
| event | 92.29 |

## Llaves huérfanas

Huérfanas de A respecto a B = llaves de A que no existen en B; el porcentaje es sobre las llaves distintas de A.

| Llave | Dirección A→B | Llaves en A | Huérfanas | % huérfanas | Dirección B→A | Llaves en B | Huérfanas | % huérfanas |
|---|---|---|---|---|---|---|---|---|
| gameId | games → plays | 122 | 0 | 0.0 | plays → games | 122 | 0 | 0.0 |
| gameId | games → tracking | 122 | 0 | 0.0 | tracking → games | 122 | 0 | 0.0 |
| gameId | plays → tracking | 122 | 0 | 0.0 | tracking → plays | 122 | 0 | 0.0 |
| gameId+playId | plays → pffScoutingData | 8557 | 0 | 0.0 | pffScoutingData → plays | 8557 | 0 | 0.0 |
| gameId+playId | plays → tracking | 8557 | 0 | 0.0 | tracking → plays | 8557 | 0 | 0.0 |
| gameId+playId | pffScoutingData → tracking | 8557 | 0 | 0.0 | tracking → pffScoutingData | 8557 | 0 | 0.0 |
| nflId | players → pffScoutingData | 1679 | 0 | 0.0 | pffScoutingData → players | 1679 | 0 | 0.0 |
| nflId | players → tracking | 1679 | 0 | 0.0 | tracking → players | 1679 | 0 | 0.0 |
| nflId | pffScoutingData → tracking | 1679 | 0 | 0.0 | tracking → pffScoutingData | 1679 | 0 | 0.0 |

`nflId` de tracking excluye las filas del balón (nflId nulo).

## Continuidad de frameId

Un track es una combinación gameId+playId+nflId (el balón, con nflId nulo, es un track por jugada). Es continuo si sus frameId son enteros consecutivos desde 1, sin repetidos.

| Tracks | No continuos | % no continuos |
|---|---|---|
| 196811 | 0 | 0.0 |

## Valores únicos por columna

### passResult (plays)

| Valor | Conteo |
|---|---|
| C | 4620 |
| I | 2755 |
| S | 543 |
| R | 449 |
| IN | 190 |

### offenseFormation (plays)

| Valor | Conteo |
|---|---|
| SHOTGUN | 5481 |
| EMPTY | 1396 |
| SINGLEBACK | 1189 |
| I_FORM | 298 |
| PISTOL | 154 |
| JUMBO | 30 |
| (nulo) | 7 |
| WILDCAT | 2 |

### pff_passCoverage (plays)

| Valor | Conteo |
|---|---|
| Cover-3 | 2665 |
| Cover-1 | 2011 |
| Cover-2 | 1085 |
| Quarters | 1033 |
| Cover-6 | 805 |
| Red Zone | 376 |
| Cover-0 | 270 |
| 2-Man | 200 |
| Bracket | 47 |
| Prevent | 32 |
| Goal Line | 25 |
| Miscellaneous | 8 |

### pff_passCoverageType (plays)

| Valor | Conteo |
|---|---|
| Zone | 5588 |
| Man | 2481 |
| Other | 488 |

### pff_role (pffScoutingData)

| Valor | Conteo |
|---|---|
| Coverage | 57765 |
| Pass Block | 46057 |
| Pass Route | 39513 |
| Pass Rush | 36362 |
| Pass | 8557 |

### event (tracking)

| Valor | Conteo |
|---|---|
| (nulo) | 7673352 |
| ball_snap | 196236 |
| pass_forward | 173604 |
| autoevent_ballsnap | 86641 |
| autoevent_passforward | 85882 |
| play_action | 45471 |
| run | 10902 |
| qb_sack | 10373 |
| pass_arrived | 8441 |
| autoevent_passinterrupted | 4623 |
| man_in_motion | 4071 |
| line_set | 3220 |
| shift | 3059 |
| pass_tipped | 2553 |
| first_contact | 1840 |
| qb_strip_sack | 1334 |
| pass_outcome_incomplete | 920 |
| pass_outcome_caught | 529 |
| fumble | 391 |
| fumble_offense_recovered | 253 |
| handoff | 230 |
| huddle_break_offense | 69 |
| tackle | 69 |
| penalty_flag | 46 |
| dropped_pass | 23 |
| lateral | 23 |
| out_of_bounds | 23 |

### officialPosition (players)

| Valor | Conteo |
|---|---|
| WR | 210 |
| CB | 192 |
| DE | 142 |
| OLB | 136 |
| RB | 126 |
| T | 122 |
| TE | 121 |
| DT | 114 |
| G | 99 |
| ILB | 81 |
| FS | 72 |
| SS | 69 |
| QB | 60 |
| C | 55 |
| NT | 34 |
| MLB | 27 |
| FB | 15 |
| DB | 2 |
| LB | 2 |
