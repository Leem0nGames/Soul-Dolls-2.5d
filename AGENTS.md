# AGENTS.md — Reglas para agentes de SoulDolls

Antes de editar:
1. Lee `README.md` y `docs/SOULDOLLS_DESIGN.md`.
2. Inspecciona los archivos reales relacionados con la tarea; no deduzcas la implementación a partir de documentación solamente.
3. Identifica la capa correcta: `src/domain/` reglas, `src/data/` catálogos, `src/scenes/` flujo jugable, `src/engine/` Three.js, `src/components/ui/` y `src/ui/` interfaz, `src/save/` persistencia.
4. Reutiliza sistemas existentes. No migres de stack, no reinicies el proyecto y no dupliques sistemas.

## Fuente de verdad
- Las decisiones de producto aprobadas están en `docs/SOULDOLLS_DESIGN.md`.
- El código fuente es la fuente de verdad para afirmar qué está implementado.
- Si diseño y código difieren, documenta la diferencia. No alteres arquitectura o comportamiento por inferencia.
- Si README, skills o este archivo discrepan con el documento de diseño, actualízalos para alinearlos.

## Reglas de diseño que no deben romperse
- RPG anime ecchi de intensidad muy alta, con personajes adultos en todo contenido ecchi.
- Protagonista masculino fijo; romance no central.
- Mundo por capítulos y regiones diseñadas; no mundo abierto procedural infinito.
- SoulDolls: muñecas artificiales habitadas por almas, personalización avanzada por piezas.
- Combate por turnos estilo Pokémon con táctica ligera, estados, combos y sinergias.
- Encuentros normales: una SoulDoll activa por bando.
- Jefes y encuentros especiales: tres SoulDolls aliadas activas, cada una con una acción por ronda; el enemigo puede ser un jefe individual o hasta tres enemigos. Sinergias por afinidades, piezas, núcleos, habilidades o linajes. No asumir que ya está implementado.
- Captura: debilitar + dispositivo + probabilidad condicionada.
- Progresión principal: niveles, experiencia, habilidades y evolución; crafting complementario.
- Alcance objetivo: historia principal de 10–15 horas y 50–70 SoulDolls.

## Precisión sobre el combate y el grupo
- `MAX_PARTY_SIZE = 6` en `src/domain/Party.ts` es capacidad de grupo, no número de unidades activas en combate.
- El `BattleEngine` actual mantiene una unidad activa por lado y procesa el grupo enemigo secuencialmente.
- No cambies esta mecánica en una tarea documental. Para implementar combate grupal, diseña una expansión localizada y compatible: tres aliadas en jefes/encuentros especiales, con uno o hasta tres enemigos; conserva el 1 contra 1 normal.

## Proceso de cambios
- Mantén los cambios pequeños, localizados y compatibles con partidas guardadas.
- Antes de editar, informa qué archivos vas a tocar y por qué.
- No hagas refactors, migraciones ni cambios colaterales no solicitados.
- No afirmes que una prueba, build, despliegue o playtest pasó si no lo ejecutaste y observaste.
- Ejecuta solo las verificaciones adecuadas al alcance. Para documentación pura, revisa enlaces, rutas y consistencia; no hace falta ejecutar toda la suite.
- Si una comprobación falla, corrige el problema antes de declarar la tarea terminada.
- Resume archivos modificados, decisiones aplicadas, discrepancias detectadas y verificaciones ejecutadas.

## Skills interoperables
- Las skills canónicas y descubribles por Gemini CLI y OpenCode están en `.agents/skills/`.
- Para diseño, sistemas o contenido SoulDolls: consulta `.agents/skills/souldolls-design/SKILL.md`.
- Para reglas, turnos, daño e impactos: consulta `.agents/skills/souldolls-combat/SKILL.md`.
- Para ingerir o registrar spritesheets y animaciones: consulta `.agents/skills/souldoll-animations/SKILL.md`.
- La carpeta histórica `.agent/skills/` se conserva por compatibilidad con herramientas anteriores; si se modifica una skill, mantener ambas copias sincronizadas o migrar explícitamente la herramienta que la consume.
