# Lista de Assets Faltantes — SoulDolls 2.5D

Auditoría completa de los recursos gráficos que actualmente el motor **genera por código (fallback procedural)** y que todavía necesitan un asset pixel-art dedicado para lograr cohesión visual al 100%.

---

## 1. Tiles de Terreno y Fachadas (con su Mapa Normal)
> **Formato recomendado:** Celdas de **`64×64 px`** (sin suavizado/antialiasing, bordes limpios sin márgenes blancos), acompañadas de su **mapa normal tangente OpenGL (`#8080ff` fondo plano, `+X` derecha, `+Y` arriba)**.

### Alta prioridad (visibles directamente en los mapas actuales)
- [ ] **`water` (Frame 1) y `water_1` (Frame 2)** — Agua animada de 2 cuadros (`64×64` c/u + normal map sutil de ondas). Se usa en *Villa Origen*, *Ruta 1*, *Pueblo Bruma* y *Cueva Eco*.
- [ ] **`window`** — Ventana iluminada / vidrio enmarcado (`64×64` + normal map con bisel de marco). Se estampa actualmente de forma procedural en las fachadas de casas, centro, tienda y laboratorio (`BuildingMesher`).
- [ ] **`snow`** — Nieve / escarcha para terreno elevado (`64×64` + normal map suave). Se usa automáticamente por encima de `snowLine` en *Ruta 2* y *Arena Cumbre*.
- [ ] **`stairs`** *(opcional mejora artesanal)* — Escalera de piedra. Hoy se genera superponiendo peldaños sobre el tile `(0,3)` de piedra; crear un tile + normal dedicado mejorará los desniveles.
- [ ] **`door`** *(opcional para separar de vigas)* — Puerta de edificio con marco y picaporte (`64×64` + normal map). Actualmente comparte el tile `(2,2)` (madera con herrajes) con los pilares de madera `log`.

### Prioridad media / variantes
- [ ] **`flowers`** — Tile de césped con flores integrado (`64×64` + normal). Hoy estampa 4 sprites procedurales sobre el césped `(0,0)`.
- [ ] **`tall_grass`** — Tile base debajo de la hierba alta (`64×64` + normal). Hoy usa el césped `(0,0)` con matojos procedurales encima.
- [ ] **`sand`** — Arena / costa (`64×64` + normal). Definido en `DEFAULT_LEGEND` (`'s'`) y bioma `'coast'`.
- [ ] **`leaves`** — Copa/hojas de relleno (`64×64` + normal). Slot reservado en el atlas.

---

## 2. Props 3D / Billboards del Mundo y Batalla (`PropSprites.ts`)
> **Formato recomendado:** PNG transparente (`alpha` limpio), pixel-art nítido, pivote centrado en la base inferior. Hoy estos **13 props** son dibujos procedurales en `24×24` o `32×32`.

### Naturaleza y Cuevas (Alta prioridad)
- [ ] **`boulder`** — Roca / peñasco (`32×32` o `48×48`). Muy presente en *Ruta 2*, *Cueva Eco*, decoración aleatoria y bordes de mapa.
- [ ] **`crystal`** — Cristal arcano brillante (`32×48`). Se usa en *Cueva Eco* y como pickup visible de **Fragmento de Alma** en el suelo.
- [ ] **`flower_patch`** — Macizo de flores silvestres (`32×32`). Usado en *Pueblo Bruma* y decoración de praderas.
- [ ] **`mushroom`** — Hongo pequeño de suelo (`24×24`). Usado en *Ruta 1* y bosques.
- [ ] **`stump`** — Tocón de árbol cortado (`24×24`). Usado en *Ruta 1*.
- [ ] **`cave_entrance`** — Boca de caverna / arco rocoso (`64×64`). Usado en el fondo del escenario de batalla bioma `cave`.

### Mobiliario y Arquitectura de Pueblos (Alta prioridad)
- [ ] **`sign`** — Cartel de madera con poste (`32×32`). Usado en **todos los mapas** (`signs`) y en arenas de batalla.
- [ ] **`well`** — Pozo de piedra con tejadillo (`48×48`). Usado en plazas de *Villa Origen*, *Pueblo Bruma* y bioma `meadow` de batalla.
- [ ] **`pillar`** — Pilar rúnico / columna de arena (`32×64`). Usado en *Arena Cumbre* y en batallas (`mountain`, `cave`, `arena`, `boss`).
- [ ] **`fence`** — Valla de madera horizontal (`32×24`, repetible lateralmente). Usada en *Villa Origen* y *Ruta 1*.
- [ ] **`bench`** — Banco de madera de plaza/ruta (`32×24`). Usado en *Villa Origen*, *Pueblo Bruma* y *Ruta 1*.

### Puntos Interactivos Clave (Alta prioridad)
- [ ] **`capsule_pedestal`** — Altar/pedestal de piedra con Soulpot encima (`32×32`). Representa las SoulDolls iniciales del laboratorio y todos los objetos recogibles del suelo.
- [ ] **`heal_machine`** — Máquina / santuario de restauración de SoulDolls (`32×32` o `48×48`). Usada en el punto de curación de *Arena Cumbre*.

---

## 3. Sprites de Personajes (`PLAYER.jpeg`, `NPC07.jpg`, `NPC08.jpg`)
- [x] **Jugador (`PLAYER.jpeg`)** ya cuenta con hoja `4×4` (4 direcciones × 4 frames de caminata).
- [ ] **Hojas animadas para NPCs por rol (Opcional / Mejora visual)**: Actualmente `NPC07.jpg` y `NPC08.jpg` tienen 16 retratos/poses estáticas cada uno (32 variantes), por lo que los NPCs **no cambian de dirección ni tienen animación al caminar** cuando rotas la cámara. Se beneficiarían de sprites `4×4` (o al menos 4 direcciones `down / left / right / up`) para:
  - `professor` (Profesor)
  - `rival` (Rival)
  - `healer` (Sanadora)
  - `merchant` (Mercader)
  - `leader` (Líderes de Arena / Jefes)
  - `trainer` / `npc`

---

## 4. Iconos de Inventario, Batalla y UI
> Actualmente generados con píxeles básicos `16×16` en `ItemIconGen.ts` y `AssetProvider.ts` (10 siluetas genéricas recoloreadas para 35 ítems).

### Iconos de Menú de Batalla (`16×16` o `24×24` PNG transparente)
- [ ] **`fight`** — Espadas cruzadas / símbolo de combate
- [ ] **`bag`** — Mochila / bolsa de objetos
- [ ] **`party`** — Soulpot / símbolo de equipo
- [ ] **`run`** — Ala / bota veloz de huida

### Iconos de Ítems (`src/data/items.ts` — 35 ítems totales, `16×16` o `24×24` PNG)
Pueden entregarse como un **sprite sheet** ordenado o archivos individuales:
- [ ] **Medicinas (7):** `pocion` (Elixir Ki), `superpocion` (Super Elixir Ki), `hiperpocion` (Hiper Elixir Ki), `antidoto` (Incienso Puro), `despertar` (Campana de Alma), `antiparalizador` (Aceite de Juntas), `revivir` (Núcleo Revivir).
- [ ] **Soulpots (3):** `capsula` (Soulpot), `supercapsula` (Super Soulpot), `ultracapsula` (Ultra Soulpot).
- [ ] **Piedras Evolutivas (6):** `piedra_chispa`, `piedra_brasa`, `piedra_flora`, `piedra_marea`, `piedra_aurora`, `piedra_eclipse`.
- [ ] **Utilidad y Reliquia AR (3):** `repelente`, `cuerda_huida` (Hilo de Retorno), `fragmento_alma`.
- [ ] **Cristales y Equipables (8):** `baya_roble`, `baya_alba`, `baya_pura`, `baya_vigil`, `gema_poder` (Núcleo Brío), `cinta_aguante` (Sello Firme), `pluma_veloz` (Hilo Céfiro), `musgo_vital` (Savia de Resina).
- [ ] **Talismanes de Tipo (8):** `amuleto_brasa`, `amuleto_marea`, `amuleto_flora`, `amuleto_chispa`, `amuleto_roca`, `amuleto_brisa`, `amuleto_umbra`, `amuleto_comun`.

### Armazones / Cuerpos Contenedores e Insignias (`src/data/containers.ts`)
- [ ] **Iconos de los 7 Cuerpos Contenedores (`32×32` PNG):** `cuerpo_aprendiz`, `cuerpo_maga`, `cuerpo_priest`, `cuerpo_paladin`, `cuerpo_bruja`, `cuerpo_asesina`, `cuerpo_titan` *(hoy `VesselScreen.ts` solo muestra texto y barras sin ilustración del armazón)*.
- [ ] **Insignias / Medallas de Progreso (`24×24` PNG):** Iconos de las insignias obtenidas al vencer líderes.

---

## 5. Fondos Parallax de Batalla (`BattleStage.ts`)
> Actualmente las siluetas lejanas (`far`: `128×32`) y medias (`mid`: `128×32`) se dibujan con ondas senoidales y rectángulos sólidos.

- [ ] **Siluetas de horizonte (`256×64` PNG transparente, tileable horizontalmente)** por bioma:
  - `meadow` / `forest`: colinas y bosque lejano.
  - `mountain`: picos nevados y cordillera.
  - `cave`: estalactitas/estalagmitas y columnas rocosas.
  - `arena`: columnatas y silueta de coliseo/templo.

---

## 6. Orden de Prioridad Sugerido
1. **Batch 1 (Impacto inmediato en mapas):** `water` (2 frames) + `window` + `snow` (+ sus mapas normales) + `door` separada de `log`.
2. **Batch 2 (Props principales del Overworld):** hoja con `boulder`, `sign`, `well`, `pillar`, `crystal`, `capsule_pedestal`, `heal_machine`, `fence`, `bench`, `stump`, `mushroom`, `flower_patch`, `cave_entrance`.
3. **Batch 3 (UI e Inventario):** sprite sheet de los **35 ítems** + **4 iconos de batalla** + **7 cuerpos contenedores**.
4. **Batch 4 (Pulido extra):** fondos parallax por bioma y hojas direccionales de NPCs clave.

---

## 7. Prompts para Elementos de UI (Estética y Paleta Exacta de 64 Colores)

Todos los prompts de esta sección están diseñados para generar assets de UI **100% coherentes** con la marca de **SoulDolls 2.5D** (`src/index.css` y `src/gfx/Palette.ts`).

### Regla de Estilo Base y Paleta Obligatoria
> Añade (o mantén) este bloque al inicio o final de cada prompt en tu generador de pixel art para asegurar píxeles nítidos, cero desenfoque y colores exactos:

```text
STYLE & PALETTE LOCK:
16-bit dark fantasy RPG pixel art UI asset, clean pixel perfect lines, crisp 1px #050505 ink outlines, flat cel shading, 90-degree sharp corners, NO gradients, NO 3D rendering, NO anti-aliasing, NO blur, NO drop shadow blur, high contrast, sharp pixels, isolated on a solid #FFFFFF white background.
Use STRICTLY this exact 64-color palette:
Base: #14101C, #2A1F2D, #8A6A3B, #E8B84A, #F2E6C9, #5FE3D2, #9B6BFF, #C2234B, #FF8FB8.
Neutrals: #000000, #0B080E, #3D3242, #6B5C70, #A89BA8, #FFF9F0.
Woods/Bronze: #3B2B1A, #5C4227, #A67F46, #F4D073, #FCEDB8, #6E3A1B, #7A4F2E.
Reds/Pink: #4A0B18, #6E0C25, #911934, #E23E66, #F06060, #FFB3CE, #FFD6E4, #FFEBF2.
Violets: #24123B, #3C1C6E, #5E329E, #7F4AD6, #B691FF, #D1BEFF, #F4EFFF, #6C3B8A.
Cyans/Nature: #1B2A2A, #123F3C, #1F6B65, #32A89D, #85EADD, #B8F4EE, #D9FBF7, #2D8C55.
Environment: #10160D, #2A3D24, #4C5C36, #7A8B3F, #453322, #2F3640, #4B5563, #6B778C, #C2A77C, #9E7D5A.
UI Accents: #FF0000, #FFAA00, #00E639, #0077FF, #8F00FF, #FFD700, #FFFFFF, #050505.
```

---

### 7.1 Marcos y Ventanas (9-Slice Frames & Dialog Box)

#### A. Set de 3 Marcos de Panel Principal (`96×96` cada uno, listos para `border-image` 9-slice)
- **Uso en el juego:** `.px-panel` (menús y diálogos), `.px-panel-violet` (bestiario / AR / invocación) y `.px-panel-crimson` (combate / alertas).
```text
Pixel art UI sprite sheet containing 3 modular 9-slice RPG window frames arranged side by side with wide spacing on a solid #FFFFFF white background.
1) Left frame (Primary Gold): square sharp-cornered wooden/bronze frame, outer 1px outline #050505, main border #E8B84A with inner bevel #FCEDB8 on top-left and #8A6A3B/#3B2B1A on bottom-right, dark smoked-wood interior #2A1F2D with subtle pixel rivet corners in #F4D073.
2) Middle frame (Arcane Violet): square sharp-cornered obsidian frame, outer 1px outline #050505, main border #9B6BFF with inner highlight #D1BEFF and shadow #5E329E, deep nightshade interior #24123B with tiny 2px corner rune studs in #5FE3D2.
3) Right frame (Rift Crimson): square sharp-cornered combat frame, outer 1px outline #050505, main border #C2234B with inner highlight #FFB3CE and shadow #6E0C25, dark dried-blood interior #4A0B18 with sharp pixel corner spikes in #E23E66.
Clean pixel perfect lines, flat shading, NO gradients, NO 3D, NO blur, high contrast, sharp pixels, isolated on a solid #FFFFFF white background.
```

#### B. Caja de Diálogo Completa + Placa de Nombre + Cursor (`DialogBox.ts`)
```text
Pixel art RPG dialogue box UI kit on a solid #FFFFFF white background.
Top: a wide horizontal dialogue frame (192x48 px ratio) with crisp #050505 2px outer border, double bronze-gold trim (#E8B84A, #A67F46, #FCEDB8 top highlight, #3B2B1A bottom shade), dark #14101C and #2A1F2D stepped inner fill, ornate 8x8 pixel filigree corners.
Bottom left: a detached speaker nameplate banner with #8A6A3B and #E8B84A frame over #14101C fill.
Bottom right: 2 frames of a tiny bouncing down-arrow dialogue advance icon (12x12 px) in #FFD700, #E8B84A and #050505 outline.
Clean pixel perfect lines, flat shading, NO gradients, NO 3D, NO blur, high contrast, sharp pixels, isolated on a solid #FFFFFF white background.
```

#### C. Marcos de Cartas SoulDoll por Rareza (`CardAlbumScreen.ts`, 4 variantes)
```text
Pixel art sprite sheet of 4 vertical trading card frames (32x48 px ratio each) lined up horizontally with clear white spacing on a solid #FFFFFF white background.
1) Common card frame: #6B5C70 border, #A89BA8 top trim, #3D3242 bevel, #14101C dark inner window.
2) Rare card frame: #5FE3D2 border, #B8F4EE top highlight, #1F6B65 dark bevel, #1B2A2A inner window, tiny diamond gem at top center in #85EADD.
3) Epic card frame: #9B6BFF border, #D1BEFF highlights, #5E329E shadow, #24123B inner window, arcane twin-horn filigree at top in #B691FF.
4) Legendary card frame: #F4D073 and #E8B84A gold border, #FCEDB8 bright pixel glints, #8A6A3B dark bronze shade, #3B2B1A inner window, royal crown-crest top ornament in #FFD700 and #5FE3D2 center jewel.
Strict #050505 1px outline, flat shading, NO gradients, NO 3D, NO blur, sharp pixels, isolated on a solid #FFFFFF white background.
```

---

### 7.2 Esquinas Ornamentales, Divisores y Placas de Título

#### A. Esquinas Ornamentales 9-Slice y Separadores (`16×16` y `32×32`)
```text
Pixel art RPG UI ornament sheet neatly arranged on a solid #FFFFFF white background:
Row 1: 4 matching ornate bronze-gold corner brackets (top-left, top-right, bottom-left, bottom-right, 16x16 px each) using #E8B84A, #FCEDB8, #8A6A3B, #3B2B1A and #050505 outline, carved soul-key scroll motif.
Row 2: 4 matching arcane violet-cyan corner brackets (16x16 px each) using #9B6BFF, #D1BEFF, #5E329E, #5FE3D2 jewel dot and #050505 outline.
Row 3: 3 horizontal pixel divider bars (64x8 px each) — gold sword-hilt divider (#E8B84A/#8A6A3B), arcane diamond rune divider (#9B6BFF/#5FE3D2), and crimson combat divider (#C2234B/#6E0C25).
Row 4: 2 decorative header ribbon banners with notched swallowtail ends in #2A1F2D fill and #E8B84A trim.
Clean pixel perfect lines, flat shading, NO gradients, NO 3D, NO blur, high contrast, sharp pixels, isolated on a solid #FFFFFF white background.
```

---

### 7.3 Fondos de Menú, Patrones Tileables y Reverso de Carta

#### A. Patrones Tileables Oscuros para Fondos de Menú (`64×64` seamless)
- **Nota:** Para patrones repetibles sin bordes blancos alrededor de cada celda, genera el mosaico contenido dentro de un cuadrado nítido sobre fondo `#FFFFFF` para recortar fácilmente.
```text
Pixel art UI sprite sheet of 3 seamless 64x64 square dark background tiles separated by white space on a solid #FFFFFF white background:
1) Pause & Inventory Menu tile: dark smoked-wood parquet and subtle brick weave in #14101C and #2A1F2D with 1px muted seam lines in #3D3242 and tiny 2px corner studs in #6B5C70.
2) Bestiary & AR Chamber tile: deep arcane obsidian stone grid in #14101C and #24123B with faint geometric rune crosshairs in #3C1C6E and #3D3242 (low contrast so white/gold UI text stays readable).
3) Battle & Boss Arena Panel tile: dark slate-stone masonry in #0B080E and #1B2A2A with muted pixel mortar in #2F3640 and #123F3C.
Strict flat shading, NO gradients, NO 3D, NO blur, sharp 1:1 pixel grid, isolated on a solid #FFFFFF white background.
```

#### B. Banner / Escudo de Pantalla de Título + Reverso de Carta + Pedestal de Armazón
```text
Pixel art UI asset sheet of 3 distinct dark-fantasy elements separated cleanly on a solid #FFFFFF white background:
1) Title Crest Emblem (wide): ornate gothic-arcane crest plaque with crossed ritual keys, #E8B84A/#F4D073 gold wings, #9B6BFF/#5FE3D2 central soul gem, #2A1F2D dark shield backing, #050505 outline (no text).
2) SoulDoll Card Back (vertical 32x48 ratio): #24123B deep violet card with #E8B84A gold pixel border, #9B6BFF symmetrical arcane diamond mandala and #5FE3D2 center star.
3) Empty Vessel Pedestal (`VesselScreen`): dark stone ritual dais in #2F3640, #4B5563, #6B778C with glowing pixel rune ring in #5FE3D2 and #1F6B65 on top.
Clean pixel perfect lines, flat shading, NO gradients, NO 3D, NO blur, sharp pixels, isolated on a solid #FFFFFF white background.
```

---

### 7.4 Botones (Normal / Hover / Pressed) y Controles Táctiles

#### A. Hoja de los 5 Botones Principales del Sistema (`px-btn-*`, 3 estados cada uno)
- **Uso en el juego:** `.px-btn-primary`, `.px-btn-secondary`, `.px-btn-arcane`, `.px-btn-success`, `.px-btn-danger` en estados `Normal`, `Hover` y `Pressed`.
```text
Pixel art UI button sprite sheet, 5 rows by 3 columns (Normal, Hover, Pressed states) of wide rectangular 9-slice RPG buttons with sharp square corners and 1px #050505 outlines, neatly spaced on a solid #FFFFFF white background (no text labels):
Row 1 (Primary Gold): Normal=#E8B84A fill, #FCEDB8 top highlight, #8A6A3B bottom bevel; Hover=#F4D073 fill, #FFF9F0 top highlight; Pressed=shifted down 1px, #A67F46 fill, #3B2B1A top inner shadow.
Row 2 (Secondary Stone): Normal=#3D3242 fill, #6B5C70 top highlight, #14101C bottom bevel; Hover=#6B5C70 fill, #A89BA8 top highlight; Pressed=#2A1F2D fill.
Row 3 (Arcane Cyan): Normal=#1F6B65 fill, #5FE3D2 top highlight, #123F3C bottom bevel; Hover=#32A89D fill, #B8F4EE top highlight; Pressed=#1B2A2A fill.
Row 4 (Success Emerald): Normal=#2D8C55 fill, #85EADD top highlight, #10160D bottom bevel; Hover=#00E639/#2D8C55 bright trim; Pressed=#2A3D24 fill.
Row 5 (Danger Crimson): Normal=#C2234B fill, #FFB3CE top highlight, #6E0C25 bottom bevel; Hover=#E23E66 fill, #FFEBF2 top highlight; Pressed=#4A0B18 fill.
Clean pixel perfect lines, flat shading, NO gradients, NO 3D, NO blur, high contrast, sharp pixels, isolated on a solid #FFFFFF white background.
```

#### B. Controles Táctiles Móviles (`TouchControls.ts`: Cruceta D-Pad, Botones A/B/Menú/Hombros)
```text
Pixel art mobile game controller HUD kit arranged neatly on a solid #FFFFFF white background:
1) Square D-pad housing (48x48 px) in #14101C and #3D3242 with 4 directional pads (#2A1F2D idle, #6B5C70 border, #F2E6C9 crisp pixel arrows), plus 1 extra highlighted active arrow state in #E8B84A fill and #FCEDB8 border.
2) Action Button A (square-beveled 28x28 px) in #2D8C55 fill, #85EADD highlight, #10160D shadow, crisp pixel letter "A" in #FFF9F0.
3) Sprint/Cancel Button B (square-beveled 28x28 px) in #C2234B fill, #FFB3CE highlight, #6E0C25 shadow, crisp pixel letter "B" with tiny boot/wing mark in #FFD6E4.
4) Small Menu pill-free square-chamfered button (#14101C fill, #6B5C70 border, 3 horizontal #F2E6C9 lines) and 2 camera-rotate shoulder buttons (left/right curved pixel arrows in #5FE3D2 on #14101C).
All pieces with #050505 1px outlines, flat shading, NO gradients, NO 3D, NO blur, sharp pixels, isolated on a solid #FFFFFF white background.
```

---

### 7.5 Barras de Estado, HUD de Misiones e Integridad de Partes

#### A. Barras Segmentadas de Vida, Estamina, EXP e Integridad Corporal
```text
Pixel art RPG status bar & meter sprite sheet neatly spaced on a solid #FFFFFF white background:
1) HP Bar Frame (96x14 px) with #050505 border, #E8B84A/#8A6A3B bronze end-caps, #14101C empty track, plus 3 separate flat color fill strips: High HP (#00E639 and #2D8C55 highlight/base), Mid HP (#FFAA00 and #E8B84A), Low HP (#FF0000 and #C2234B).
2) Stamina Bar Frame (80x10 px) with #3D3242/#6B5C70 slate trim, #14101C track, and segmented cyan/gold fill strip (#5FE3D2, #32A89D, #E8B84A).
3) EXP / Ki Bar Frame (96x8 px) with #5E329E/#9B6BFF trim and bright #5FE3D2/#85EADD fill strip.
4) 4-Part Body Integrity Silhouette Diagram (`BattleContainer` / `DollIntegrityView`): crisp pixel-art mannequin split into 4 modular highlighted pieces — Head, Torso, Arms, Legs — shown in healthy (#5FE3D2/#2D8C55), damaged (#FFAA00), and broken (#C2234B/#6E0C25) states with #050505 outlines.
Clean pixel perfect lines, flat shading, NO gradients, NO 3D, NO blur, sharp pixels, isolated on a solid #FFFFFF white background.
```

#### B. Panel Colapsable de Misiones y Flecha Brújula Dinámica (`OverworldScene`)
```text
Pixel art RPG quest tracker & compass HUD icons on a solid #FFFFFF white background:
1) Compact Quest Panel header bar with #24123B fill, #9B6BFF and #E8B84A double pixel trim, small parchment scroll icon (#F2E6C9/#8A6A3B) on the left, and 2 tiny square toggle buttons (collapse chevron down and expand chevron right in #F4D073 on #14101C).
2) 8-direction or rotatable golden Quest Compass Arrow icon (24x24 px) with crisp #050505 outline, #FFD700/#E8B84A arrowhead, #FCEDB8 top facet, #8A6A3B shadow facet, and #5FE3D2 glowing center gem.
3) Quest marker exclamation "!" and completion checkmark icons in #FFD700, #00E639 and #050505 outlines.
Flat shading, NO gradients, NO 3D, NO blur, sharp pixels, isolated on a solid #FFFFFF white background.
```

---

### 7.6 Iconos de UI, Menú, Combate, Tipos, Estados e Insignias

#### A. Iconos de Menú de Batalla (4) + Iconos del Menú de Pausa y HUD (12)
```text
Pixel art 16x16 and 24x24 RPG UI icon sprite sheet arranged in an even grid with generous white spacing on a solid #FFFFFF white background (each icon has crisp 1px #050505 ink outline):
Row 1 — Battle Actions (4 icons):
1. Fight (crossed pixel swords in #F2E6C9/#A89BA8 blades, #E8B84A hilts, #C2234B spark)
2. Bag (leather adventurer satchel in #7A4F2E/#5C4227 with #E8B84A buckle)
3. Party / Soulpot (arcane containment orb in #9B6BFF/#5E329E with #5FE3D2 core and #E8B84A band)
4. Run (winged boot in #B8F4EE/#5FE3D2 wing and #7A4F2E boot)
Row 2 — Pause Menu & Overworld HUD (8 icons):
5. Bestiary Book (#6E0C25/#C2234B cover, #E8B84A clasp, #F2E6C9 pages)
6. SoulDoll Card Album (#9B6BFF/#D1BEFF fanned cards with #F4D073 star)
7. Vessels / Armazones (wooden-porcelain marionette bust in #F2E6C9 and #8A6A3B)
8. Save Floppy/Crystal (#5FE3D2/#1F6B65 floating crystal shrine)
9. Options Gear (#A89BA8/#6B5C70 notched cogwheel)
10. Currency Soul Shard `◈` (#5FE3D2/#85EADD diamond shard with #123F3C shade)
11. Audio On/Off Speaker (#F2E6C9/#E8B84A pixel speaker + soundwaves)
12. Fullscreen Arrows (#5FE3D2 4 outward corner brackets)
Row 3 — Cursors & Indicators (4 icons):
13. Pointing gloved pixel hand cursor (#FFF9F0 glove, #E8B84A cuff)
14. Golden triangle selector arrow (#FFD700/#8A6A3B)
15. Padlock icon (#A67F46/#3B2B1A)
16. Captured SoulDoll star/ribbon tag (#5FE3D2 and #FFD700)
Clean pixel perfect lines, flat shading, NO gradients, NO 3D, NO blur, high contrast, sharp pixels, isolated on a solid #FFFFFF white background.
```

#### B. Sheet de 8 Emblemas de Tipo (`src/data/types.ts` — colores exactos)
```text
Pixel art sprite sheet of 8 distinct RPG elemental type badges (20x20 px square or shield emblems, well spaced on a solid #FFFFFF white background), each with 1px #050505 outline and strict flat palette matching:
1. Brasa (Flame): #911934 shield, #E23E66 border, bright #FFF9F0/#F06060 pixel flame.
2. Marea (Water/Wave): #1F6B65 shield, #5FE3D2 border, #D9FBF7/#85EADD curled wave droplet.
3. Flora (Leaf): #2D8C55 shield, #7A8B3F border, #FFF9F0/#85EADD twin sprout leaf.
4. Chispa (Spark/Bolt): #E8B84A shield, #8A6A3B border, sharp #14101C/#FCEDB8 lightning bolt.
5. Roca (Rock/Mountain): #4B5563 shield, #6B778C border, #F2E6C9/#A89BA8 faceted boulder.
6. Brisa (Wind/Feather): #B8F4EE shield, #32A89D border, #14101C/#1F6B65 swirling wind gust.
7. Umbra (Shadow/Crescent): #5E329E shield, #9B6BFF border, #F4EFFF/#D1BEFF crescent moon & eye.
8. Común (Star/Rune): #6B5C70 shield, #A89BA8 border, #F2E6C9/#FFF9F0 four-point star.
Clean pixel perfect lines, flat shading, NO gradients, NO 3D, NO blur, sharp pixels, isolated on a solid #FFFFFF white background.
```

#### C. Sheet de 4 Iconos de Estados Alterados + 4 Medallas / Insignias de Arena
```text
Pixel art RPG UI badge sprite sheet (2 rows of 4 icons, 20x20 px each, evenly spaced on a solid #FFFFFF white background) with 1px #050505 outlines:
Row 1 — Status Conditions:
1. Burn (Quemado): crimson-orange flame icon in #FF0000, #FFAA00, #4A0B18.
2. Poison (Envenenado): bubbling skull/vial drop in #8F00FF, #9B6BFF, #24123B.
3. Paralysis (Paralizado): jagged electric spark bolt in #FFD700, #FFAA00, #3B2B1A.
4. Sleep (Dormido): crisp floating "Zz" letters in #0077FF, #5FE3D2, #14101C.
Row 2 — 4 Arena Progress Badges / Medals (24x24 px each):
5. Ember Crest Medal (#C2234B ruby + #E8B84A gold bezel).
6. Tide Crest Medal (#5FE3D2 cyan teardrop + #F4D073 bezel).
7. Gale/Verdant Crest Medal (#2D8C55 emerald wing + #A67F46 bronze bezel).
8. Summit Soul Medal (#9B6BFF amethyst star + #FFD700 royal crown bezel).
Clean pixel perfect lines, flat shading, NO gradients, NO 3D, NO blur, high contrast, sharp pixels, isolated on a solid #FFFFFF white background.
```

