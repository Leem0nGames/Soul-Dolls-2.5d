import { describe, expect, it } from 'vitest';
import { Synth } from '../src/audio/Synth.ts';
import { EventBus } from '../src/core/EventBus.ts';
import { BODY_CONTAINERS } from '../src/data/containers.ts';
import { MAPS } from '../src/data/maps/index.ts';
import {
  acceptSideQuest,
  ALL_BLUEPRINT_IDS,
  completeSideQuest,
  CRAFTING_BLUEPRINTS,
  craftContainerFromBlueprint,
  getSideQuest,
  getSideQuestForNpc,
  getSideQuestStatus,
  SIDE_QUESTS,
} from '../src/domain/SideQuests.ts';
import { isInsideBuilding } from '../src/domain/TerrainRules.ts';
import { createInitialSave, migrateSaveData } from '../src/save/migrations.ts';

describe('Side Quests, Blueprints, and Quest SFX', () => {
  it('links every side quest to a real NPC on a valid walkable map and a real crafting blueprint', () => {
    for (const q of SIDE_QUESTS) {
      const map = MAPS[q.mapId];
      expect(map).toBeDefined();

      const npc = map.npcs.find((n) => n.id === q.giverNpcId);
      expect(npc).toBeDefined();
      const ch = map.grid[npc!.y]?.[npc!.x];
      expect(ch).toBeDefined();
      expect(map.legend[ch!]?.solid).toBe(false);
      expect(isInsideBuilding(map.buildings, npc!.x, npc!.y)).toBe(false);

      expect(q.rewardGold).toBeGreaterThan(0);
      const bp = CRAFTING_BLUEPRINTS[q.rewardBlueprintId];
      expect(bp).toBeDefined();
      expect(BODY_CONTAINERS[bp.containerId]).toBeDefined();
    }
    expect(ALL_BLUEPRINT_IDS.length).toBeGreaterThanOrEqual(SIDE_QUESTS.length);
  });

  it('tracks locked -> available (!) -> active -> ready (?) -> completed rewards lifecycle', () => {
    const save = createInitialSave();
    const first = getSideQuest('sq_lazos_origen')!;
    const second = getSideQuest('sq_archivo_bruma')!;
    const third = getSideQuest('sq_paso_montana')!;

    // Initially first is available (!), second & third are locked
    expect(getSideQuestStatus(first, save)).toBe('available');
    expect(getSideQuestStatus(second, save)).toBe('locked');
    expect(getSideQuestStatus(third, save)).toBe('locked');

    const npcBeforeAccept = getSideQuestForNpc(first.giverNpcId, save);
    expect(npcBeforeAccept?.marker).toBe('!');
    expect(npcBeforeAccept?.status).toBe('available');

    // Accept first quest
    expect(acceptSideQuest(save, first.id)).toBe(true);
    expect(acceptSideQuest(save, first.id)).toBe(false); // Cannot double accept
    expect(acceptSideQuest(save, second.id)).toBe(false); // Cannot accept locked quest

    const npcWhileActive = getSideQuestForNpc(first.giverNpcId, save);
    expect(npcWhileActive?.status).toBe('active');
    expect(npcWhileActive?.progress.ready).toBe(false);
    expect(npcWhileActive?.marker).toBeNull();
    expect(completeSideQuest(save, first.id)).toBeNull(); // Not ready yet

    // Fulfill requirements (starter chosen + 2 caught species)
    save.flags.starter_chosen = true;
    save.caughtSpecies = [1, 10];
    const npcWhenReady = getSideQuestForNpc(first.giverNpcId, save);
    expect(npcWhenReady?.progress.ready).toBe(true);
    expect(npcWhenReady?.marker).toBe('?');

    // Turn in quest -> Gold + Crafting Blueprint awarded
    const startGold = save.money;
    const reward = completeSideQuest(save, first.id);
    expect(reward).not.toBeNull();
    expect(reward!.rewardGold).toBe(first.rewardGold);
    expect(reward!.blueprint.id).toBe(first.rewardBlueprintId);
    expect(save.money).toBe(startGold + first.rewardGold);
    expect(save.blueprints).toContain(first.rewardBlueprintId);
    expect(save.completedSideQuests).toContain(first.id);
    expect(save.activeSideQuests).not.toContain(first.id);

    // Marker clears after completion and unlocks dependent quest (third) & second
    expect(getSideQuestForNpc(first.giverNpcId, save)?.marker).toBeNull();
    expect(completeSideQuest(save, first.id)).toBeNull();
    expect(getSideQuestStatus(second, save)).toBe('available');
    expect(getSideQuestStatus(third, save)).toBe('available');
  });

  it('crafts BodyContainers only with unlocked blueprint and sufficient gold', () => {
    const save = createInitialSave();
    const bp = CRAFTING_BLUEPRINTS.plano_maga;

    // Locked blueprint fails
    expect(craftContainerFromBlueprint(save, bp.id)).toEqual({
      ok: false,
      reason: 'locked',
    });

    // Unlock blueprint, insufficient gold fails
    save.blueprints = [bp.id];
    save.money = bp.craftGoldCost - 1;
    expect(craftContainerFromBlueprint(save, bp.id)).toEqual({
      ok: false,
      reason: 'no_money',
    });

    // Sufficient gold crafts vessel and deducts gold
    save.money = bp.craftGoldCost + 100;
    const beforeQty = save.vessels?.[bp.containerId] ?? 0;
    const res = craftContainerFromBlueprint(save, bp.id);
    expect(res.ok).toBe(true);
    expect(res.containerName).toBe(BODY_CONTAINERS[bp.containerId].name);
    expect(save.money).toBe(100);
    expect(save.vessels?.[bp.containerId]).toBe(beforeQty + 1);
  });

  it('preserves and deduplicates side quests and blueprints across save migrations', () => {
    const base = createInitialSave();
    expect(base.activeSideQuests).toEqual([]);
    expect(base.completedSideQuests).toEqual([]);
    expect(base.blueprints).toEqual([]);

    const migrated = migrateSaveData({
      ...base,
      version: 6,
      activeSideQuests: ['sq_archivo_bruma', 'sq_archivo_bruma'],
      completedSideQuests: ['sq_lazos_origen', 'sq_lazos_origen'],
      blueprints: ['plano_maga', 'plano_maga'],
    });
    expect(migrated).not.toBeNull();
    expect(migrated!.activeSideQuests).toEqual(['sq_archivo_bruma']);
    expect(migrated!.completedSideQuests).toEqual(['sq_lazos_origen']);
    expect(migrated!.blueprints).toEqual(['plano_maga']);
  });

  it('emits and handles chiptune quest SFX events (quest_journal, quest_accept, quest_reward)', () => {
    const bus = new EventBus();
    const synth = new Synth();
    const played: string[] = [];

    bus.on('audio:sfx', ({ sfx }) => {
      played.push(sfx);
      expect(() => synth.playSfx(sfx)).not.toThrow();
    });

    bus.emit('audio:sfx', { sfx: 'quest_journal' });
    bus.emit('audio:sfx', { sfx: 'quest_accept' });
    bus.emit('audio:sfx', { sfx: 'quest_reward' });

    expect(played).toEqual(['quest_journal', 'quest_accept', 'quest_reward']);
  });
});
