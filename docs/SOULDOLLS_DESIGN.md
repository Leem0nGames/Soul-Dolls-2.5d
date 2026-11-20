# SoulDolls — Dirección de diseño aprobada

**Estado:** decisiones de producto aprobadas el 20 de noviembre de 2026.  
**Tipo de documento:** fuente de verdad de diseño; no describe automáticamente el estado implementado del código.

## 1. Visión

SoulDolls es un RPG 2.5D de fantasía oscura y estética anime ecchi muy marcada. El jugador controla a un protagonista masculino fijo y explora una aventura estructurada por capítulos. El núcleo de colección gira alrededor de muñecas artificiales habitadas por almas: las SoulDolls.

La experiencia debe equilibrar exploración, captura, combate, historia y construcción/personalización. Ninguno de esos pilares debe convertirse en un añadido irrelevante.

La dirección visual conserva fantasía oscura kawaii, magia y bronce, escenarios 3D con personajes y criaturas pixel-art billboard, cámara superior en perspectiva y soporte móvil + PC. Paleta de referencia: tinta `#14101C`, bronce `#8A6A3B`, Ki `#5FE3D2`, Alma `#9B6BFF`.

## 2. Decisiones de diseño confirmadas

| Área | Decisión aprobada |
|---|---|
| Identidad | RPG anime ecchi de intensidad muy alta |
| Mundo | Aventura por capítulos, con regiones diseñadas y progresión narrativa controlada |
| Protagonista | Masculino fijo |
| Romance | No es un eje central; evitar convertir el juego en simulador romántico o harem |
| Elenco | Personajes adultos; humor pícaro, coqueteo y situaciones sugerentes pueden formar parte del tono |
| SoulDolls | Muñecas artificiales habitadas por almas |
| Personalización | Avanzada por piezas: cabeza, torso, brazos, piernas, núcleo, engarce de alma y accesorios |
| Combate | Por turnos estilo Pokémon, con decisiones tácticas, estados, combos y sinergias entre piezas |
| Encuentros normales | Un enfrentamiento individual: una SoulDoll activa por bando |
| Jefes | Hasta tres SoulDolls enemigas simultáneas, con sinergias y acciones coordinadas |
| Captura | Debilitar al objetivo, usar un dispositivo y resolver una probabilidad condicionada |
| Historia | Trama principal por capítulos más misiones secundarias |
| Progresión | Clásica: niveles, experiencia, estadísticas, habilidades y evoluciones |
| Duración | Aproximadamente 10–15 horas para la historia principal |
| Escala | Objetivo de 50–70 SoulDolls, varias regiones y variedad de jefes |

## 3. Pilares jugables

### 3.1 Exploración y capítulos
- La estructura global es por capítulos y regiones diseñadas.
- Cada región debe aportar identidad visual, personajes, encuentros, secretos, misiones y un objetivo narrativo.
- No convertir el proyecto en un mundo abierto procedural infinito ni cambiarlo a una progresión sandbox.
- Puede haber variación local de encuentros, recompensas o secretos si respeta la estructura por capítulos.

### 3.2 SoulDolls y construcción
- Cada SoulDoll representa un alma vinculada a un cuerpo artificial.
- Las piezas intercambiables tienen valor funcional y visual.
- Las piezas pueden influir en estadísticas, resistencias, habilidades y sinergias.
- La personalización es avanzada por slots; no se requiere un editor libre de proporciones o geometría.
- La fabricación complementa la progresión clásica; no debe reemplazar niveles y experiencia como vía principal.

### 3.3 Combate
- El modelo base es por turnos, con lectura clara de turnos, acciones, estados y resultados.
- Los encuentros normales son individuales: una unidad activa por lado.
- Los jefes pueden desplegar hasta tres unidades enemigas a la vez. Sus sinergias deben ser legibles, telegráficas y contrarrestables.
- Incorporar ventajas elementales, estados alterados, combos y sinergias de piezas/núcleos.
- No transformar el combate en un sistema de cuadrícula táctica ni en acción en tiempo real.
- La capacidad del equipo de reserva no equivale al número de unidades activas simultáneamente.

### 3.4 Captura
- Debilitar a la SoulDoll salvaje.
- Usar un dispositivo/objeto de captura.
- Resolver la probabilidad con factores como vida restante, estado, rareza y modificadores del dispositivo.
- Las condiciones especiales pueden reservarse para almas raras, eventos o misiones.

### 3.5 Narrativa y personajes
- La historia principal avanza por capítulos.
- Las misiones secundarias amplían regiones, personajes y mundo.
- El protagonista es masculino y fijo.
- No diseñar el bucle principal alrededor de rutas románticas, conquista o un harem.
- El tono ecchi puede expresarse mediante diseños, vestuario, humor y situaciones sugerentes, manteniendo adultos a todos los personajes que participen en contenido ecchi.

### 3.6 Progresión
- La progresión principal es clásica: experiencia, niveles, estadísticas, habilidades y evolución.
- La fabricación y las piezas son una capa de personalización/optimización.
- Objetivo de duración de historia principal: 10–15 horas.
- Objetivo de catálogo: 50–70 SoulDolls; priorizar variedad y calidad por encima del volumen.

## 4. Distinción obligatoria: diseño objetivo vs implementación actual

Este documento expresa decisiones aprobadas, no afirma que todas estén implementadas.

Hechos verificados en el código consultado:
- `src/domain/Party.ts` define actualmente `MAX_PARTY_SIZE = 6`. Es la capacidad del grupo/partida, no una autorización para desplegar seis unidades simultáneamente.
- `src/domain/BattleEngine.ts` mantiene un índice activo por bando (`activeIndex`) y procesa un objetivo activo por lado. Los enemigos de un grupo se enfrentan de forma secuencial al caer el activo.
- Por tanto, los jefes con hasta tres enemigos simultáneos y sus sinergias son un objetivo de diseño futuro; no deben describirse como una capacidad ya implementada.
- El README registra actualmente 50 especies en el catálogo. El objetivo aprobado es llegar a 50–70 SoulDolls; no inventar especies ni afirmar que el rango completo ya existe.
- La implementación actual incluye sistemas de captura, experiencia, evolución, estados, afinidades y daño por partes. Su presencia no significa que todos los detalles del diseño futuro estén completos.

Cuando un agente cambie el código, debe inspeccionar la implementación actual y actualizar esta sección solo con evidencia verificable. Nunca falsear el estado de una función para hacerla coincidir con el objetivo.

## 5. Límites de alcance y decisiones que no deben inferirse

- No migrar de stack ni reemplazar la arquitectura existente.
- No empezar de cero ni duplicar sistemas existentes.
- No asumir mundo abierto procedural global.
- No añadir combate multiactivo a encuentros normales.
- No confundir party size con número de unidades activas.
- No convertir romance/harem en mecánica central.
- No convertir la progresión principal en crafting-only o memoria-only.
- No inventar contenido terminado, cifras de catálogo o capacidades no verificadas.
- No añadir personajes menores de edad a situaciones o representaciones ecchi.

## 6. Prioridad al resolver discrepancias

1. Decisiones explícitas más recientes del usuario.
2. Este documento de dirección de diseño para las decisiones de producto.
3. Código fuente para describir el comportamiento realmente implementado.
4. README y skills, que deben mantenerse sincronizados con este documento.

Si el diseño objetivo y el código difieren, conservar el código y la arquitectura actuales salvo que la tarea solicite implementar el cambio. Documentar la diferencia; no hacer una migración implícita.
