---
name: souldolls-combat
description: Guía operativa para diseñar, corregir y ampliar el combate por turnos de SoulDolls sin romper la arquitectura, la sincronización de impactos ni la distinción entre encuentros normales y jefes.
---

# Skill — Combate SoulDolls

## Lectura obligatoria
Antes de modificar combate, leer:
- `README.md`
- `AGENTS.md`
- `docs/SOULDOLLS_DESIGN.md`
- `.agents/skills/souldolls-design/SKILL.md`

Después inspeccionar el código real relacionado con la tarea. Esta skill describe contratos y precauciones; no sustituye la implementación.

## Modelo aprobado
- Combate por turnos estilo Pokémon, con decisiones tácticas ligeras.
- Encuentros normales: una SoulDoll activa por bando.
- Jefes: objetivo de hasta tres SoulDolls enemigas activas simultáneamente, con sinergias y acciones coordinadas.
- Estados alterados, afinidades, habilidades, combos y sinergias entre piezas/núcleos deben ser legibles y contrarrestables.
- No convertir el sistema en combate de acción en tiempo real ni en una táctica de cuadrícula.
- La capacidad del grupo/reserva no define cuántas unidades están activas a la vez.

## Estado implementado verificado
En la inspección de referencia del 20/11/2026:
- `src/domain/BattleEngine.ts` conserva un `activeIndex` por bando mediante `BattleSideState` y `getActive()`. Los miembros del grupo enemigo se enfrentan secuencialmente.
- `src/domain/Party.ts` declara `MAX_PARTY_SIZE = 6`; es capacidad de grupo, no despliegue simultáneo.
- `src/scenes/BattleScene.ts` presenta dos estaciones de combate, una para jugador y otra para enemigo. Que exista `isBoss` y una presentación visual de jefe no demuestra soporte de tres enemigos simultáneos.
- `src/domain/BattleImpactSync.ts` extrae los eventos de daño asociados al movimiento para que la escena los presente en el punto de impacto.
- `src/scenes/BattleScene.ts` mantiene HP visual separado mediante `displayedHpByUid` y `displayedActiveUid`; el HUD aplica el daño cuando procesa el evento presentado, no al inicio de la animación.
- `src/data/animations.ts` define roles y metadatos de spritesheets, incluidos `impactFrame`, `cols`, `rows` y `totalFrames`.

Estos hechos son una fotografía del código inspeccionado, no una garantía de que no haya cambiado. Volver a inspeccionar antes de cada tarea.

## Arquitectura y responsabilidades
Mantener las capas separadas:
- **Dominio:** `src/domain/BattleEngine.ts`, `Damage.ts`, `BattleImpactSync.ts`, `Abilities.ts`, `BodyParts.ts`, `TypeChart.ts` y módulos relacionados. Aquí viven reglas, cálculos, orden de acciones y eventos.
- **Datos:** `src/data/moves.ts`, `species.ts`, `animations.ts` y catálogos relacionados. Preferir definiciones data-driven.
- **Presentación/orquestación:** `src/scenes/BattleScene.ts` procesa eventos, coordina animaciones, HUD, cámara y VFX.
- **Render y efectos:** `src/engine/` contiene primitivas visuales y efectos; no debe convertirse en autoridad de reglas de daño.
- **HUD/UI:** `src/ui/` y `src/components/ui/` muestran estado y reciben acciones; no deben recalcular el combate.

No mover reglas de dominio a la escena para resolver un problema visual. No hacer que el motor dependa de Three.js, React o componentes visuales.

## Contrato de secuencia de turno
Al modificar la secuencia, preservar explícitamente:
1. Validación de acción y restricciones (por ejemplo, inmovilización, PP, objetos o cambio).
2. Selección/orden de acciones según prioridad, habilidades y velocidad, con desempate controlado por RNG.
3. Emisión ordenada de eventos que describen lo ocurrido.
4. Resolución de daño, estados, habilidades reactivas, debilitamiento y efectos de fin de turno.
5. La escena presenta cada evento y solo entonces permite continuar la interacción del jugador.

No asumir que el estado interno del motor y el HP que ve el jugador son idénticos durante toda la presentación de un turno. El motor puede resolver el turno por adelantado; la escena mantiene una proyección visual progresiva.

## Regla crítica: daño sincronizado con impacto
- Nunca mostrar la reducción de HP antes del impacto visual del ataque.
- `move_use` inicia la presentación del movimiento; la escena debe resolver el impacto en el frame configurado (`impactFrame`) o en el punto temporal equivalente de la animación de fallback.
- Mantener la extracción y presentación de daños mediante `BattleImpactSync.ts` y el flujo existente de `BattleScene.ts`; inspeccionar ambos antes de cambiarlo.
- `takeMoveImpactDamageEvents()` agrupa los eventos de daño previos al siguiente límite de evento. No alteres sus límites sin revisar multi-hit, reacciones, texto, debilitamientos y movimientos consecutivos.
- Los VFX de impacto, reacción del rig, flash/shake y actualización de HP deben coincidir en el mismo punto de impacto.
- Si no existe spritesheet específico, el fallback también debe producir un único impacto coherente y no adelantar el daño.
- Los movimientos de estado, fallos, cambios, captura, daño residual, clima y fin de turno tienen secuencias distintas: no forzar todos a usar la animación de ataque físico.
- Al tocar esta secuencia, inspeccionar también `src/domain/MeleeStabTiming.ts`, `src/data/animations.ts` y los consumidores de eventos correspondientes.

## Diseño futuro de jefes multi-enemigo
El despliegue de hasta tres enemigos simultáneos es una meta aprobada, no una función que se pueda dar por existente. Cuando el usuario solicite implementarlo:
1. Diseñar primero un cambio localizado al modelo de estado del bando enemigo; no reutilizar un único `activeIndex` como si representara tres unidades.
2. Mantener intacto el flujo normal de una unidad activa por lado.
3. Definir objetivos de cada acción, selección de objetivo, orden de turnos y resolución de acciones simultáneas/encadenadas.
4. Definir cómo se muestran HP, estados, piezas dañadas, selección de objetivo y animaciones de cada enemigo sin solapar estaciones ni ocultar información.
5. Diseñar sinergias explícitas, telegráficas y contrarrestables; no conceder acciones extra implícitas ni ataques combinados sin reglas visibles.
6. Tratar cambios de tipos/interfaces/eventos como una evolución compatible y revisar serialización/guardado solo si el estado de combate se persiste.
7. No convertir encuentros normales ni equipos de entrenadores comunes en multienemigo por accidente.

No implementar esta expansión durante una tarea documental o de animación. Primero presentar el alcance y los archivos afectados.

## Reglas de implementación
- No confundir `MAX_PARTY_SIZE` con unidades activas.
- No duplicar fórmulas de daño, afinidades, estados, habilidades, captura o experiencia.
- Mantener RNG determinista y pasar por las abstracciones existentes; no introducir `Math.random()` en reglas.
- Respetar datos y partidas guardadas; no cambiar esquemas persistidos sin una migración explícita.
- No inventar tipos, propiedades, eventos o funciones antes de comprobar sus definiciones.
- Cambios pequeños y localizados. No refactorizar el motor completo para corregir un error puntual.
- Para una discrepancia visual, inspeccionar primero el evento y su consumidor antes de alterar la fórmula de dominio.

## Verificación adecuada
Elegir pruebas enfocadas al cambio:
- Dominio/orden de turnos: pruebas de `BattleEngine`, prioridad, estados, habilidades y daño.
- Sincronización: pruebas de `BattleImpactSync` y pruebas/escenarios de `BattleScene` disponibles.
- Animaciones: validar metadatos, rutas, frame de impacto y fallback.
- Jefes multi-enemigo: cubrir 1, 2 y 3 enemigos, muerte/cambio de objetivo, turnos, estados, sinergias y fin de batalla; además, confirmar que los encuentros normales siguen siendo 1 contra 1.
- Ejecutar lint, tests o build solo según el alcance y reportar exactamente qué se ejecutó. No afirmar playtest visual sin haberlo realizado.

## Respuesta al usuario
Explicar brevemente qué comportamiento se observó, qué capa se modificó, qué se mantuvo intacto y qué comprobaciones se ejecutaron. El usuario no programa: dar pasos claros y prompts copiables si necesita continuar en su entorno.
