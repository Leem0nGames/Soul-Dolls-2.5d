# SoulDolls 2.5D — Art Bible

Documento operativo de dirección de arte. Define la identidad visual, el estándar de ingesta de assets y los criterios de revisión.

## 1. Propósito y autoridad

- Este documento es la fuente de verdad para **decisiones visuales**. Las decisiones de producto siguen en `docs/SOULDOLLS_DESIGN.md`; la verdad de implementación sigue siendo el código.
- Si código y este documento difieren, se documenta la diferencia en la sección 10 en lugar de asumir una implementación inexistente.
- No autoriza cambios de mecánicas, arquitectura, combate ni narrativa. Ver `AGENTS.md`.

## 2. Identidad visual

- **Género y tono:** RPG anime ecchi de fantasía oscura, intensidad muy alta, estética *dark kawaii* (oro resonante, violeta arcano, cian de ki sobre tinta de cripta).
- **Perspectiva:** híbrido 2.5D. Overworld con tiles 3D y billboards; combate con escenario 3D y sprites 2D; menús con primitivas de UI planas tipo 16-bit.
- **Estructura:** mundo por capítulos y regiones diseñadas, sin mundo abierto procedural infinito.
- **Regla no negociable:** todo personaje en contenido ecchi es adulto (`AGENTS.md`). La presentación (silueta, proporciones, ropa) debe leerse inequívocamente como adulta; ver sección 7.
- **Regla de acabado:** pixel art nítido para todo asset de juego; nada de gradientes, desenfoque, bisel 3D ni antialiasing en arte de sprite. Las excepciones de VFX/luz están en la sección 8.

## 3. Paleta

### Fuentes (deben coincidir)

| Superficie | Archivo | Uso |
|---|---|---|
| Motor | `src/gfx/Palette.ts:7-87` | `PALETTE` y `hexToNumber` |
| UI/CSS | `src/index.css:5-82` | Tokens `--color-*` de Tailwind v4 |
| UI React | `src/components/ui/palette.ts:7-148` | `BRAND_PALETTE_64`, grupos, `isBrandPaletteHex` |
| Specs de assets | `ASSETS_FALTANTES.md:106-121` | Bloque *STYLE & PALETTE LOCK* para generadores |

- `PALETTE` agrupa **63 valores HEX únicos en 8 grupos** y se documenta como “paleta de 64 colores” (`src/gfx/Palette.ts:3-6`). Mantener esa convención de nombre.
- Grupos: Base (9), Neutros (6), Maderas/Bronce (7), Rojos/Rosas (8), Violetas (8), Cianes/Naturaleza (8), Entorno (10), Acentos UI (8).
- Regla de proporción **80/10/10**: 80 % tonos de entorno/neutros, 10 % color de marca, 10 % acento (oro, cian o violeta).

### Paletas derivadas

- `TYPE_PALETTES` (`src/gfx/Palette.ts:106-163`): 8 tipos × 5 tonos (`outline`, `dark`, `base`, `light`, `accent`). Todo VFX, badge o icono de tipo debe salir de aquí, no de colores libres.
- `CHARACTER_PALETTES` (`src/gfx/Palette.ts:174+`): rol de personaje → `hair/skin/shirt/pants/hat/trim`. Los sprites de personaje deben respetar estos valores.

### Excepciones documentadas (fuera de la paleta de UI)

- Gradientes de shader, post-proceso y niebla atmosférica.
- Cielo y fondos parallax suavizados.
- Efectos elementales que interpolean en espacio lineal.

Toda excepción nueva debe añadirse aquí antes de mezclarla con arte de sprite plano.

## 4. Tipografía y primitivas de UI

- **Tipografía:** monospace de sistema (`src/index.css:103`): `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`.
- **Nitidez:** `image-rendering: pixelated` con fallback `crisp-edges` (`src/index.css:127-128`). No aplicar a imágenes que deban suavizarse (VFX, retratos HD); hoy esas reglas existen como `auto` en `src/index.css:132,136`.
- **Primitivas disponibles** (`src/index.css:150+`): `.px-panel`, `.px-panel-violet`, `.px-panel-crimson`, `.px-panel-cyan`, `.px-panel-ornate`, `.px-card`, `.px-hud-box`, `.px-divider`, `.px-meter-segmented`, `.px-btn-*`, `.px-text-outline`, `.px-text-shadow`.
- **Regla:** una pantalla nueva se compone con estas clases antes de dibujar marcos o botones nuevos. Esquinas a 90°, borde exterior `#050505`, sin sombras difusas.
- **Accesibilidad:** respetar `prefers-reduced-motion` (`src/index.css:887`) en cualquier animación de UI.

## 5. Densidad de píxel y estándar de ingesta

Medidas verificadas sobre los archivos actuales. Cualquier asset nuevo debe encajar en su fila.

| Categoría | Carpeta | Formato | Medida / rejilla | Notas |
|---|---|---|---|---|
| Hoja base SoulDoll | `public/assets/souldolls/` | WebP con alpha | `1200×896` = 2 vistas `600×896` (frente \| espalda) | `1×2`, nunca animaciones (`1`, `2`) |
| Tiles albedo | `public/assets/tiles_5x5_albedo.png`, `tiles_extra_albedo.png` | PNG | celda `64×64` (`5×5` = 320×320, `5×2` = 320×128) | sin antialias, sin márgenes |
| Normal map | `tiles_*_normal.png` | PNG | misma rejilla | espacio tangente, fondo `#8080ff`, +Y arriba |
| Props / billboards | `public/assets/props/` | PNG alpha | libre, proporción ajustada en código | fondo 100 % transparente |
| Ataques | `public/assets/attacks/` | WebP alpha | `<role>_<pad2_id>.webp`, celda `640×360` (`4×9` o `4×5`) | `aspectRatio = 640/360` |
| Idles | `public/assets/idles/` | WebP alpha | `idle_front_NN.webp` `4×10`, `idle_back_NN.webp` `4×6` | `loop: true`, `fps` 6/8/12 |
| Hoja de personaje | `public/assets/chars/` | PNG | `4×4` (celda no cuadrada, p. ej. `512×704` → `128×176`) | 4 direcciones × 4 frames |
| Personaje jugador | `PLAYER.jpeg` | JPEG | hoja `4×4` | — |
| Alma salvaje | `public/assets/souls/` | WebP | `512×512` | nombre `NN.webp` |
| Mascota / follower | `public/assets/followers/` | WebP | variable (p. ej. `284×429`) | nombre `NN.webp` |
| Iconos de ítem / batalla | `public/assets/items/`, `ui/` | PNG alpha | `64×64` | — |
| Iconos de cuerpo / insignias | pendiente | PNG | `32×32` / `24×24` | ver sección 9 |

### Reglas de ingesta

1. **Rejilla exacta:** `ancho % cols === 0` y `alto % rows === 0`. Si no divide exacto, recortar o reexportar; no ajustar UVs al azar.
2. **Fondo:** limpiar chroma (verde/gris/blanco/negro) y verificar visualmente que no quedan halos ni partes borradas (armas, pelo, estelas).
3. **Alpha:** píxeles con alpha 0 deben tener RGB oscuro (`#14101C`) para evitar flecos claros al filtrar (`src/gfx/SoulDollSheets.ts:10-13`).
4. **Filtro:** las hojas de combate usan `NearestFilter` sin mipmaps (`src/engine/MeleeStabSprite.ts:87-97`, `src/engine/BattleStage.ts:345-348`). Un asset suavizado se verá incorrecto.
5. **Color space:** `SRGBColorSpace`, igual que el resto de texturas de mundo.
6. **Origen de imagen:** `/public/assets/aistudio/` es material fuente no jugable. No se referencia en partidas ni en combate; única excepción: los cargadores de muestra del asistente de `Sprite Studio` (herramienta de autoría), documentados en la sección 10.
7. **Peso:** preferir WebP con alpha para hojas grandes; PNG para iconos y tiles.

### Fallback de ataque

- Especies sin hoja registrada usan `public/assets/attacks/generic_attack_fallback.png` (`src/data/animations.ts:59-60,118-126`), rejilla `5×5` (`25` frames), `aspectRatio: 1`, `impactFrame: 11`.
- Está precargado en `BattleScene` junto al resto del registro (`src/scenes/BattleScene.ts:379-385`).
- Es un asset **genérico**, no una SoulDoll del catálogo. No reutilizar hojas de una especie concreta como sustituto genérico.

## 6. Nombres y mapa de carpetas

- **Combate:** `<role>_<pad2_id>.webp` en `public/assets/attacks/`, `role ∈ {physical_attack, special_attack}`; id a 2 dígitos (`01`, `15`).
- **Idle:** `idle_front_<pad2_id>.webp` / `idle_back_<pad2_id>.webp` en `public/assets/idles/`.
- **Hoja base:** `<pad2_id>.webp` en `public/assets/souldolls/`, `1×2`, solo vistas estáticas. **Nunca** una hoja de ataque aquí (`.agents/skills/souldoll-animations/SKILL.md:17`).
- **Almas y followers:** `<pad2_id>.webp` en `souls/` y `followers/`. No usar prefijos (`soul_10.webp` fue eliminado por duplicado).
- **Registro único:** `SPECIES_ANIMATION_REGISTRY` en `src/data/animations.ts:133-164` es la fuente de verdad. Un archivo sin entrada es un huérfano; una entrada sin archivo es un error.
- **Rol coherente con el nombre:** si el rol registrado es `special_attack`, el archivo debe llamarse `special_attack_<id>.webp` y viceversa.
- **Presupuesto de personajes:** 50–70 SoulDolls (`AGENTS.md`). No crear assets fuera de ids válidos (`SOULDOLL_MAX_SHEET_ID = 52` en `src/gfx/SoulDollSheets.ts:2`).

## 7. Reglas de personajes y SoulDolls

- **Edad:** todos los personajes en contenido ecchi son adultos. Cues obligatorios: proporciones adultas, silueta madura, altura y complexión consistentes con el resto del elenco. Nada que pueda leerse como menor.
- **Personalización por piezas:** la identidad de una SoulDoll se compone por piezas/ranuras (cuerpo, cabeza, ropa, accesorios). Los assets de pieza deben ser intercambiables y compartir iluminación, contorno y escala.
- **Contorno:** línea de tinta `#050505` en UI; en sprites de personaje, contorno oscuro dentro de la paleta (`cryptInk`, `abyssInk`, `driedBlood`).
- **Legibilidad a escala de combate:** el sprite se evalúa al tamaño que ocupa en `BattleScene`, no a resolución de autor. Silueta y arma deben leerse a ese tamaño.
- **Variedad controlada:** la diferenciación entre 50–70 SoulDolls debe venir de silueta, paleta de tipo, arma y linaje; evitar clones con cambio de color.

## 8. VFX, luz y parallax (híbrido intencional)

- **Nítido (pixel art):** tiles, props, sprites de personaje, hojas de ataque e idle, iconos, marcos de UI. `NearestFilter`, sin mipmaps.
- **Suave (shader/post-proceso):** VFX de habilidad (`src/engine/AbilityVfxSystem.ts:155-157`), atmósfera (`src/engine/OverworldAtmosphere.ts:84`), cielo (`src/engine/SkyBackdrop.ts:28`), banners y fondos de batalla (`src/engine/BattleStage.ts:387-439`). `LinearFilter` intencional.
- No “arreglar” la mezcla de filtros: es una decisión de estilo. Lo que sí debe arreglarse es usar arte plano (pixel) con filtro lineal o arte suave con filtro nearest.
- **Parallax de batalla:** los fondos lejanos/medios están generados por código (ondas y rectángulos). Cuando lleguen las siluetas dedicadas (`ASSETS_FALTANTES.md:84-91`) deben ser tileables horizontalmente, `256×64`, transparentes y por bioma (`meadow/forest`, `mountain`, `cave`, `arena`).

## 9. Iconos y badges pendientes

Estado real verificado contra `ASSETS_FALTANTES.md`:

- **Presentes:** 25 iconos de ítem, 4 iconos de batalla (`battle_fight/bag/party/run`, `64×64`), 6 piedras evolutivas, 3 utilidades, 8 equipables, 8 talismanes de tipo.
- **Ausentes:** 7 medicinas, 3 Soulpots, 7 iconos de cuerpo contenedor (`32×32`), 4 medallas/insignias (`24×24`), siluetas parallax por bioma.
- **Cuerpos contenedores:** `WorkshopView.tsx` los muestra solo como texto (`getBodyContainer(...).name`, `:477`, `:501`); no hay ilustración del armazón.
- **Emblemas de tipo:** la paleta y los 8 tipos están definidos (`src/gfx/Palette.ts:106-163`); falta la hoja de iconos final. Mientras no exista, cualquier color de tipo en UI debe salir de `TYPE_PALETTES`.
- **Insignias:** deben representar progreso de líder de arena. No inventar insignias fuera de las regiones definidas en el diseño.

Prompts de generación y bloque *PALETTE LOCK*: `ASSETS_FALTANTES.md:102-299`.

## 10. Checklist de revisión y registro de discrepancias

### Checklist antes de integrar arte

- [ ] El asset respeta la rejilla exacta de su categoría (sección 5).
- [ ] Fondo 100 % transparente, sin halos ni restos de chroma.
- [ ] Colores dentro de la paleta de marca o excepción documentada en la sección 3.
- [ ] Contorno y escala coherentes con assets vecinos de la misma carpeta.
- [ ] Nombre según sección 6 y entrada en `SPECIES_ANIMATION_REGISTRY` cuando aplique.
- [ ] Ningún archivo huérfano añadido; ningún archivo referenciado eliminado.
- [ ] Se ve correctamente a tamaño de combate, no solo a tamaño de autor.
- [ ] Si representa a un personaje en contenido ecchi, se lee inequívocamente como adulto.
- [ ] Actualizado `ASSETS_FALTANTES.md` si cambia el inventario.

### Registro de discrepancias (auditoría de arte)

| # | Diferencia | Estado |
|---|---|---|
| 1 | `special_attack_15.webp` mide `2570×1812`; la rejilla `4×5 @ 640×360` esperaría `2560×1800`. | **Aceptado como tolerancia.** El error de UV es ≈0.4 % horizontal y ≈0.7 % vertical (imperceptible) porque las UVs se calculan en fracción (`src/domain/MeleeStabTiming.ts:65-97`). No se reexporta para evitar recompresión sin ganancia visual. La regla de rejilla exacta se aplica a todo asset nuevo. |
| 2 | La entrada de la especie #15 estaba registrada como `physical_attack` con archivo `special_attack_15.webp`. | **Resuelto:** rol cambiado a `special_attack` (`src/data/animations.ts:158-163`). El ataque físico de #15 sigue resolviendo la misma hoja vía fallback de rol (`getSpeciesAttackSpec`, `:216-230`). |
| 3 | El fallback de ataque vivía en `/assets/aistudio/` y se cargaba en runtime. | **Resuelto:** movido a `public/assets/attacks/generic_attack_fallback.png`; constantes renombradas a `GENERIC_ATTACK_FALLBACK_*`. |
| 4 | `SOULDOLL_PORTRAIT_PLACEHOLDER_PATH` apuntaba a `/assets/aistudio/004-portrait-frame_5c78ef77.png` y no se usaba en ningún sitio de `src/`. | **Resuelto:** constante eliminada. El PNG permanece como material fuente no jugable. |
| 5 | Huérfanos en carpetas de runtime: `souldolls/15_attack.png`, `souls/soul_10.webp`, `followers/follower_10.webp`. | **Resuelto:** eliminados. Los archivos válidos son `souldolls/15.webp`, `souls/10.webp`, `followers/10.webp`. |
| 6 | `Sprite Studio` (`QuickInspectorTab.tsx:73-84`) mantiene cols/rows/frames/impact en estado local y no persiste metadatos. | **Abierto:** es una herramienta de previsualización, no de autoría. No produce registros de producción. |
| 7 | El asistente de `Sprite Studio` carga medios de muestra desde `/assets/aistudio/*` (`CreateAnimationWizard.tsx:34-36`). | **Excepción aceptada:** herramienta de autoría, no combate ni partida. El arte jugable no depende de esa carpeta. |
| 8 | Fondos parallax de batalla siguen siendo procedurales. | **Abierto:** pendiente de assets por bioma (sección 8). |
| 9 | Faltan iconos de medicinas, Soulpots, cuerpos contenedores e insignias. | **Abierto:** ver sección 9. |
| 10 | Limpieza de alpha y lectura adulta no se pueden validar por inspección de archivos. | **Abierto:** requiere QA visual renderizado o playtest. |

### Documentos relacionados

- `docs/SOULDOLLS_DESIGN.md` — decisiones de producto.
- `ASSETS_FALTANTES.md` — inventario de faltantes y prompts de generación.
- `.agents/skills/souldoll-animations/SKILL.md` — flujo de ingesta de animaciones.
- `AGENTS.md` — reglas de trabajo y capas del proyecto.
