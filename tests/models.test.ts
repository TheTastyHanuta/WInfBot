import assert from 'node:assert/strict';
import { GuildSettings } from '../src/models/settings/settings';
import { MemberStats } from '../src/models/stats/memberStats';
import { ServerStats } from '../src/models/stats/serverStats';

/**
 * These run without a MongoDB connection: the settings lookup is exercised
 * against a stubbed model, and the stats updates are checked through
 * mongoose's own update casting, which is what would reject a bad path or an
 * $inc/$setOnInsert conflict at runtime.
 */

async function testFindByGuildIdNeverReturnsNull(): Promise<void> {
  const findByGuildId = (GuildSettings.schema as any).statics.findByGuildId;
  assert.ok(findByGuildId, 'findByGuildId static is missing');

  // Existing guild: returned as is, without creating anything.
  let created = 0;
  const existing = {
    findOne: async () => 'EXISTING',
    findOrCreateByGuildId: async () => {
      created++;
      return 'CREATED';
    },
  };
  assert.equal(await findByGuildId.call(existing, 'guild-1'), 'EXISTING');
  assert.equal(created, 0, 'must not create settings for a known guild');

  // Unknown guild: falls back to creating the defaults instead of returning
  // null, which every caller dereferences straight away.
  const unknown = {
    findOne: async () => null,
    findOrCreateByGuildId: async () => {
      created++;
      return 'CREATED';
    },
  };
  assert.equal(await findByGuildId.call(unknown, 'guild-2'), 'CREATED');
  assert.equal(created, 1, 'must create settings for an unknown guild');
}

function castUpdate(query: any): Record<string, any> {
  query.cast(query.model); // throws if a path cannot be cast
  return query.getUpdate();
}

function assertNoPathConflict(update: Record<string, any>): void {
  const seen = new Map<string, string>();
  for (const [operator, payload] of Object.entries(update)) {
    for (const path of Object.keys(payload as object)) {
      assert.equal(
        seen.get(path),
        undefined,
        `MongoDB would reject this: '${path}' is in both ${seen.get(path)} and ${operator}`
      );
      seen.set(path, operator);
    }
  }
}

function testStatsUpdatesAreAtomic(): void {
  const memberText = castUpdate(
    MemberStats.updateOne(
      { guildId: 'g', userId: 'u' },
      { $inc: { messages: 1, ['textChannels.123']: 1 } },
      { upsert: true }
    )
  );
  assert.equal(memberText.$inc.messages, 1);
  assert.equal(memberText.$inc['textChannels.123'], 1);
  assertNoPathConflict(memberText);

  const memberVoice = castUpdate(
    MemberStats.updateOne(
      { guildId: 'g', userId: 'u' },
      { $inc: { voiceTime: 90, ['voiceChannels.456']: 90 } },
      { upsert: true }
    )
  );
  assert.equal(memberVoice.$inc.voiceTime, 90);
  assert.equal(typeof memberVoice.$inc['voiceChannels.456'], 'number');
  assertNoPathConflict(memberVoice);

  const serverText = castUpdate(
    ServerStats.updateOne(
      { guildId: 'g' },
      { $inc: { ['textChannels.123']: 1 } },
      { upsert: true }
    )
  );
  assertNoPathConflict(serverText);

  const serverVoice = castUpdate(
    ServerStats.updateOne(
      { guildId: 'g' },
      { $inc: { ['voiceChannels.456']: 90 } },
      { upsert: true }
    )
  );
  assertNoPathConflict(serverVoice);

  // The atomic statics the events call must exist on the models.
  for (const name of ['recordTextMessage', 'recordVoiceTime']) {
    assert.equal(typeof (MemberStats as any)[name], 'function', name);
    assert.equal(typeof (ServerStats as any)[name], 'function', name);
  }
}

async function main(): Promise<void> {
  await testFindByGuildIdNeverReturnsNull();
  testStatsUpdatesAreAtomic();
  console.log('models: all checks passed');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
