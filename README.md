# Monstrix — RPG Táctico 2.5D de Criaturas

Proyecto educativo de RPG por turnos y coleccionismo de criaturas para navegadores móviles y escritorio, construido con **TypeScript estricto + Vite + Three.js**. Todo el arte pixel-art, sprites, texturas de mapa y audio chiptune se genera de forma **100% procedural** en tiempo de ejecución.

## Cómo ejecutar

```bash
npm install
npm run dev      # Servidor local en http://localhost:3000
npm run test     # Pruebas unitarias con Vitest
npm run lint     # Verificación estricta de TypeScript
npm run build    # Compilación de producción
```

## Arquitectura

Dependencia unidireccional estricta: `data → domain → scenes → engine/ui`.

```
src/
├── core/      Game, Loop (60 Hz + ahorro 30 FPS), EventBus, SceneStack, Rng (mulberry32), Input
├── domain/    Lógica pura sin Three.js ni DOM: BattleEngine, Damage, TypeChart, Catch, Experience, Evolution, Shop, TerrainRules
├── data/      Tipos (8), Movimientos (40), Especies (18), Objetos (15), Entrenadores, Tablas de encuentro, 6 Mapas con relieve (48×48 / 56×48)
├── gfx/       Paletas, ProceduralTiles (atlas 256×256 con paredes/tejados/terreno), CreatureSpriteGen (32×32 frente/dorso), CharacterSprites, PropSprites, AssetProvider
├── engine/    PixelRenderer (427×240 + escalado dinámico), CameraRig (3.ª persona baja con giro L/R de 90°), TerrainMesher (16×16 con sombreado por pendiente), BuildingMesher (edificios 3D low-poly), SkyBackdrop (cielo degradado y nubes), BillboardBatch (InstancedMesh), Tween
├── ui/        DialogBox, Menu, BattleHud, PartyScreen, BagScreen, SummaryScreen, TouchControls (D-pad relativo + L/R), EndingModal
├── scenes/    TitleScene, OverworldScene, BattleScene, EvolutionScene, ShopScene
├── audio/     Synth WebAudio + pistas chiptune en bucle
├── save/      SaveManager + migraciones versionadas en localStorage
└── i18n/      Tabla centralizada en español (es.ts)
```

## Cómo ampliar el contenido (Data-Driven)

- **Añadir una especie**: agrega una entrada en `src/data/species.ts` definiendo sus tipos, estadísticas base, `archetype`, `features`, `learnset` y `evolutions`. El generador procedural creará sus sprites frente/dorso automáticamente.
- **Añadir un movimiento**: agrega la definición en `src/data/moves.ts`.
- **Añadir o editar un mapa**: crea un archivo en `src/data/maps/` usando `mapBuilder.ts` (`grid` ASCII, `heights` 0–9, `buildings`, `props`, `decoration`, `warps`, `npcs`, `encounters`) y regístralo en `src/data/maps/index.ts`.

## Notas de rendimiento (móviles de gama baja)

- Render interno a ~427×240 px escalado con `image-rendering: pixelated` y ajuste dinámico de resolución (0.6–1.0) según tiempo medio de cuadro.
- Malla de terreno por altura fusionada en chunks de 16×16 (`TerrainMesher`) con sombreado por pendiente precalculado en colores de vértice, sin luces dinámicas (`MeshBasicMaterial`) y niebla de distancia.
- Edificios 3D low-poly combinados en un único `BufferGeometry` usando el mismo atlas ≤256×256, y props naturales sembrados por semilla agrupados mediante `InstancedMesh` con rotación por lote.
- Pausa automática en `visibilitychange` y soporte para modo ahorro de batería (30 FPS).

## Nota legal

Este proyecto tiene fines estrictamente educativos. Todas las criaturas, nombres, mapas, mecánicas, sprites procedurales y pistas musicales son propiedad original creada para este proyecto, sin utilizar marcas, diseños ni recursos externos.
