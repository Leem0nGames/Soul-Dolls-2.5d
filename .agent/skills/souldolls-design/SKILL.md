---
name: souldolls-design
description: Fuente operativa de decisiones de producto, límites de alcance y reglas de consistencia para diseñar, implementar o revisar sistemas y contenido de SoulDolls.
---

# Skill — Dirección de diseño SoulDolls

## Lectura obligatoria
Antes de proponer o modificar una mecánica, leer:
- `README.md`
- `docs/SOULDOLLS_DESIGN.md`
- `AGENTS.md`

El documento `docs/SOULDOLLS_DESIGN.md` es la fuente de verdad de las decisiones aprobadas. El código es la fuente de verdad del estado implementado.

## Dirección aprobada
- RPG 2.5D anime ecchi de intensidad muy alta; todos los personajes en contenido ecchi deben ser adultos.
- Protagonista masculino fijo; sin romance/harem como eje central.
- Aventura por capítulos y regiones diseñadas.
- SoulDolls son muñecas artificiales habitadas por almas.
- Personalización avanzada por cabeza, torso, brazos, piernas, núcleo, engarce y accesorios.
- Combate por turnos estilo Pokémon, con táctica ligera, estados, combos y sinergias entre piezas.
- Enemigos normales: una unidad activa por lado.
- Jefes: hasta tres unidades enemigas simultáneas, con sinergias.
- Captura mediante debilitamiento, dispositivo y probabilidad condicionada.
- Progresión clásica por experiencia, niveles, habilidades y evolución.
- Historia principal de 10–15 horas; catálogo objetivo de 50–70 SoulDolls.

## No inferir implementación
- El grupo actual admite hasta seis miembros (`src/domain/Party.ts`), pero esto no define el número de unidades activas.
- El motor actual usa una unidad activa por lado y avanza enemigos secuencialmente. Los jefes de tres enemigos simultáneos son objetivo futuro, no capacidad confirmada.
- Mantener separados los hechos implementados y las metas de diseño.
- No declarar terminados sistemas, contenido, escenas o plataformas sin inspección.

## Reglas para tareas
1. Inspeccionar primero los archivos existentes y localizar la lógica de dominio antes de tocar escenas o UI.
2. Reutilizar catálogos y sistemas actuales; evitar duplicaciones.
3. Mantener la arquitectura y los formatos de guardado salvo solicitud expresa.
4. No convertir el mundo en procedural abierto, el combate normal en multienemigo, el romance en eje central ni la progresión en crafting-only.
5. Para cambios de diseño, indicar alcance, archivos afectados, estado actual y diferencia con el objetivo.
6. Para tareas de documentación, no modificar lógica de juego.
