import { describe, expect, it } from 'vitest';
import { createRng } from '../src/core/Rng.ts';
import { SHARDS_PER_CONTAINER } from '../src/data/containers.ts';
import { ITEMS } from '../src/data/items.ts';
import { MOVES } from '../src/data/moves.ts';
import { rollArGacha } from '../src/domain/ArGacha.ts';
import {
  addBodyPartShard,
  applyDamageToBodyParts,
  computeBodyPartRatios,
  consumeVessel,
  healBodyParts,
  pickBestVesselForSpecies,
  rebindCreatureContainer,
  sumBodyPartsCurrent,
} from '../src/domain/BodyParts.ts';
import { createCreature } from '../src/domain/Creature.ts';
import {
  CURRENT_SAVE_VERSION,
  createInitialSave,
  migrateSaveData,
} from '../src/save/migrations.ts';

describe('SoulDolls lore, 4-part body HP, containers & AR gacha', () => {
  it('computes 4-part body HP ratios from container + IVs/EVs and keeps currentHp in sync', () => {
    const rng = createRng(777);
    const doll = createCreature(1, 20, rng, 'cuerpo_maga');
    expect(doll.containerId).toBe('cuerpo_maga');
    expect(doll.bodyParts).toBeDefined();

    const parts = doll.bodyParts!;
    const sumMax = parts.head.max + parts.torso.max + parts.arms.max + parts.legs.max;
    expect(sumMax).toBe(doll.stats.hp);
    expect(sumBodyPartsCurrent(parts)).toBe(doll.currentHp);

    // EVs shift anatomical ratios
    const baseRatios = computeBodyPartRatios('cuerpo_paladin', doll.ivs);
    const evRatios = computeBodyPartRatios('cuerpo_paladin', doll.ivs, { spe: 30, atk: 20 });
    expect(baseRatios.head + baseRatios.torso + baseRatios.arms + baseRatios.legs).toBe(100);
    expect(evRatios.head + evRatios.torso + evRatios.arms + evRatios.legs).toBe(100);
    expect(evRatios.legs).toBeGreaterThanOrEqual(baseRatios.legs);

    // Damage applies to preferred part first, breaks limb at 0, overflows cleanly, and heals back
    const headMax = parts.head.max;
    const dmgRes = applyDamageToBodyParts(doll, headMax + 5, 'head');
    expect(dmgRes.actualDamage).toBe(headMax + 5);
    expect(dmgRes.partBroken).toBe('head');
    expect(parts.head.current).toBe(0);
    expect(doll.currentHp).toBe(doll.stats.hp - (headMax + 5));

    const healed = healBodyParts(doll, 6);
    expect(healed).toBe(6);
    expect(sumBodyPartsCurrent(parts)).toBe(doll.currentHp);
  });

  it('assembles 5 identical body part shards into 1 complete Body Container and supports rebinding', () => {
    const save = createInitialSave();
    expect(save.vessels?.cuerpo_aprendiz).toBe(1);

    for (let i = 1; i < SHARDS_PER_CONTAINER; i++) {
      const step = addBodyPartShard(save, 'cuerpo_titan', 1);
      expect(step.assembledCount).toBe(0);
      expect(step.currentShards).toBe(i);
    }

    const done = addBodyPartShard(save, 'cuerpo_titan', 1);
    expect(done.assembledCount).toBe(1);
    expect(done.currentShards).toBe(0);
    expect(save.vessels?.cuerpo_titan).toBe(1);

    const best = pickBestVesselForSpecies(save, 1);
    expect(best).toBeTruthy();
    expect(consumeVessel(save, 'cuerpo_titan')).toBe(true);
    expect(save.vessels?.cuerpo_titan).toBeUndefined();

    const doll = createCreature(1, 12, createRng(11), 'cuerpo_aprendiz');
    rebindCreatureContainer(doll, 'cuerpo_titan');
    expect(doll.containerId).toBe('cuerpo_titan');
    const p = doll.bodyParts!;
    expect(p.head.max + p.torso.max + p.arms.max + p.legs.max).toBe(doll.stats.hp);
  });

  it('produces valid AR gacha rewards (body parts, Ki powers, or items) from QR payloads', () => {
    const rng = createRng(123);
    const save = createInitialSave();
    const kinds = new Set<string>();

    for (let i = 0; i < 40; i++) {
      const reward = rollArGacha(`SOULDOLL-QR-${i}`, save, rng);
      kinds.add(reward.kind);
      if (reward.kind === 'body_part') {
        expect(reward.containerId).toBeTruthy();
      } else if (reward.kind === 'power') {
        expect(MOVES[reward.moveId!]).toBeDefined();
      } else {
        expect(ITEMS[reward.itemId!]).toBeDefined();
      }
    }

    expect(kinds.has('body_part')).toBe(true);
    expect(kinds.has('power')).toBe(true);
    expect(kinds.has('item')).toBe(true);
  });

  it('migrates legacy v3 saves with default vessels and 4-part HP', () => {
    const rng = createRng(5);
    const legacyMon = createCreature(4, 8, rng);
    delete legacyMon.bodyParts;
    delete legacyMon.containerId;

    const migrated = migrateSaveData({
      version: 3,
      mapId: 'villa_origen',
      playerX: 24,
      playerY: 26,
      playerDir: 'up',
      party: [legacyMon],
      bag: [],
    });

    expect(migrated).not.toBeNull();
    expect(migrated!.version).toBe(CURRENT_SAVE_VERSION);
    expect(migrated!.vessels?.cuerpo_aprendiz).toBe(1);
    expect(migrated!.party[0].bodyParts).toBeDefined();
    expect(migrated!.party[0].containerId).toBe('cuerpo_asesina');
  });

  it('renders minimalist pixel-art DollIntegrityView silhouette and broken-part states', async () => {
    const { renderDollIntegrityHtml, getBodyPartTone } = await import(
      '../src/ui/DollIntegrityView.ts'
    );
    const doll = createCreature(1, 20, createRng(91), 'cuerpo_paladin');
    const htmlHealthy = renderDollIntegrityHtml(doll, { mode: 'battle-player' });
    expect(htmlHealthy).toContain('shape-rendering="crispEdges"');
    expect(htmlHealthy).toContain('data-part="head"');
    expect(htmlHealthy).toContain('data-part="torso"');
    expect(htmlHealthy).toContain('data-part="arms"');
    expect(htmlHealthy).toContain('data-part="legs"');
    expect(htmlHealthy).not.toContain('>ROT<');

    // Break arms and verify non-hue-only ROT label + broken tone
    const armMax = doll.bodyParts!.arms.max;
    applyDamageToBodyParts(doll, armMax, 'arms');
    expect(getBodyPartTone(0, armMax).broken).toBe(true);

    const htmlBroken = renderDollIntegrityHtml(doll, { mode: 'battle-enemy' });
    expect(htmlBroken).toContain('ROT');
    expect(renderDollIntegrityHtml(doll, { mode: 'summary' })).toContain('Cabeza');
  });

  it('renders BattleContainer React component with Head, Torso, Arms, Legs bars and pixel-art wrappers', async () => {
    const React = await import('react');
    const { renderToStaticMarkup } = await import('react-dom/server');
    const { BattleContainer } = await import('../src/components/BattleContainer.tsx');

    const doll = createCreature(1, 22, createRng(55), 'cuerpo_paladin');
    const armMax = doll.bodyParts!.arms.max;
    applyDamageToBodyParts(doll, armMax, 'arms'); // break arms
    const torsoDmg = Math.floor(doll.bodyParts!.torso.max * 0.55);
    applyDamageToBodyParts(doll, torsoDmg, 'torso'); // warn tone

    const markup = renderToStaticMarkup(
      React.createElement(BattleContainer, {
        creature: doll,
        variant: 'player',
        damagedPart: 'torso',
        damageTick: 1,
      })
    );

    expect(markup).toContain('Head');
    expect(markup).toContain('Torso');
    expect(markup).toContain('Arms');
    expect(markup).toContain('Legs');
    expect(markup).toContain('pixel-limb-wrap');
    expect(markup).toContain('pixel-limb-bar-track');
    expect(markup).toContain('pixel-limb-wrap--broken');
    expect(markup).toContain('battle-part-hit');
    expect(markup).toContain('bg-ki-cyan');
    expect(markup).toContain('bg-resonant-gold');
    expect(markup).toContain('BRK');
    expect(markup).toContain('data-marionette-stage');
    expect(markup).toContain('data-damage-indicator="torso"');
    expect(markup.match(/role="progressbar"/g)).toHaveLength(4);
  });

  it('renders DamageIndicator overlaid on marionette limbs with battle-part-hit feedback', async () => {
    const React = await import('react');
    const { renderToStaticMarkup } = await import('react-dom/server');
    const { DamageIndicator, DAMAGE_PART_ANCHORS } = await import(
      '../src/components/DamageIndicator.tsx'
    );
    const { BattleContainer } = await import('../src/components/BattleContainer.tsx');

    // No renderiza cuando no hay impacto activo
    const idleMarkup = renderToStaticMarkup(
      React.createElement(DamageIndicator, { part: 'head', tick: 0 })
    );
    expect(idleMarkup).toBe('');

    // Renderiza sobre extremidad con animación battle-part-hit y badge de daño crítico
    const critMarkup = renderToStaticMarkup(
      React.createElement(DamageIndicator, {
        part: 'arms',
        tick: 2,
        amount: 24,
        crit: true,
      })
    );
    expect(critMarkup).toContain('data-damage-indicator="arms"');
    expect(critMarkup).toContain('data-damage-tick="2"');
    expect(critMarkup).toContain('battle-part-hit');
    expect(critMarkup).toContain('shape-rendering="crispEdges"');
    expect(critMarkup).toContain(`top:${DAMAGE_PART_ANCHORS.arms.top}`);
    expect(critMarkup).toContain('-24!');

    // Renderiza estado de extremidad rota dentro de BattleContainer
    const doll = createCreature(1, 20, createRng(77), 'cuerpo_aprendiz');
    const containerMarkup = renderToStaticMarkup(
      React.createElement(BattleContainer, {
        creature: doll,
        variant: 'enemy',
        damagedPart: 'legs',
        damageTick: 3,
        damageAmount: 18,
        damageBroken: true,
      })
    );
    expect(containerMarkup).toContain('data-damage-indicator="legs"');
    expect(containerMarkup).toContain(`top:${DAMAGE_PART_ANCHORS.legs.top}`);
    expect(containerMarkup).toContain('-18');
    expect(containerMarkup).toContain('battle-part-hit');
  });
});
