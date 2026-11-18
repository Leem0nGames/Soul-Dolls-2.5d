---
name: souldoll-animations
description: Pipeline estándar para ingerir, limpiar (fondo verde/gris/sólido), convertir a WebP y registrar animaciones de combate (ataque físico o especial) y fichas SoulDoll en el proyecto mediante lenguaje natural.
---

# Pipeline de Ingesta de Animaciones SoulDoll

Sigue este flujo exactamente cada vez que el usuario suba una imagen o video (`.mp4`/`.webm`) y pida agregar o reemplazar una animación de una SoulDoll en lenguaje natural.

## Regla Crítica de Seguridad de Assets
- **NO sobrescribir** `/public/assets/souldolls/XX.webp` con animaciones de ataque. Esos archivos son exclusivamente hojas base `1×2` (izquierda = frontal, derecha = trasera) de cada criatura.
- Todas las animaciones de combate se guardan en **`/public/assets/attacks/`** en formato **`.webp`** con fondo transparente.
- Para verificar a qué `speciesId` (1–52) corresponde un personaje o consultar qué especies ya tienen animación, revisa:
  - `src/data/species.ts` (IDs 1–50)
  - `public/assets/souldolls/manifest.json` (IDs 1–52)
  - `src/data/animations.ts` (registro actual de animaciones)

## Roles de Animación Soportados
- `'physical_attack'`: Ataques físicos (`move.category === 'physical'`). La SoulDoll avanza hacia el rival, reproduce la hoja junto al objetivo e impacta en `impactFrame`.
- `'special_attack'`: Ataques especiales (`move.category === 'special'`). Si se registra explícitamente, la animación se reproduce en la estación del atacante y lanza los VFX elementales al alcanzar `impactFrame`.

## Flujo de Trabajo

### Caso A: El usuario sube un Video (`.mp4` / `.webm`)
1. Inspeccionar el video con `view_file` y `ffprobe` para identificar:
   - Resolución (`width × height`) y relación de aspecto (`aspectRatio = width / height`).
   - Ventana activa del golpe (`--start`, `--end`) descartando tramos estáticos al inicio y al final.
   - Tipo de fondo (`green` para chroma verde, `grey` para gris).
2. Ejecutar el script CLI para generar el `.webp` limpio (apuntando a ~16–24 frames):
   ```bash
   node scripts/video-to-spritesheet.mjs \
     --input <ruta_video> \
     --output public/assets/attacks/<role>_<pad2_id>.webp \
     --start <seg_inicio> --end <seg_fin> --fps <8_a_12> --cols <4_o_5> --chroma <green|grey>
   ```
3. Abrir el `.webp` generado con `view_file` para confirmar visualmente que:
   - No queda halo verde/gris.
   - No se borraron partes del cuerpo, cabello, armas ni estelas mágicas.
   - Identificar visualmente el índice exacto (0-based) del `impactFrame` (el cuadro donde conecta el golpe o estalla el tajo).

### Caso B: El usuario sube una Imagen Spritesheet (`.png` / `.webp` / `.jpg`)
1. Inspeccionar visualmente la imagen con `view_file` para contar:
   - Columnas (`cols`), filas (`rows`) y cantidad real de frames (`totalFrames`).
   - Cuadro de impacto (`impactFrame`, 0-based).
   - Tipo de fondo (`grey` ~`rgb(180,180,180)`, `green`, `white`, `black`, `auto`, o `none` si ya tiene alpha).
2. Procesar y exportar a `.webp` transparente:
   ```bash
   node scripts/image-to-spritesheet.mjs \
     --input <ruta_imagen> \
     --output public/assets/attacks/<role>_<pad2_id>.webp \
     --cols <cols> --rows <rows> --totalFrames <totalFrames> --chroma <auto|grey|green|white|black|none>
   ```
3. Verificar el `.webp` resultante con `view_file`.

### Registro y Verificación Obligatoria
1. Añadir o actualizar la entrada en `SPECIES_ANIMATION_REGISTRY` dentro de **`src/data/animations.ts`**:
   ```ts
   {
     speciesId: <id>,
     role: '<physical_attack|special_attack>',
     label: 'SoulDoll #<pad2_id> — <Nombre> (<cols>×<rows>)',
     spec: {
       path: '/assets/attacks/<role>_<pad2_id>.webp',
       cols: <cols>,
       rows: <rows>,
       totalFrames: <totalFrames>,
       impactFrame: <impactFrame>,
       aspectRatio: <cellW> / <cellH>,
     },
   }
   ```
2. Verificar siempre antes de responder:
   - `npm test -- --run` (todas las suites pasando).
   - `compile_applet` y `lint_applet` sin errores.
   - `restart_dev_server` si el servidor estaba activo.
