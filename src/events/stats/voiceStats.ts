import { VoiceState, Client } from 'discord.js';
import { VoiceActivity } from '../../models/stats/voiceActivity';
import { MemberStats } from '../../models/stats/memberStats';
import { ServerStats } from '../../models/stats/serverStats';
import { Logger } from '../../utils/logger';

async function handleVoiceStateUpdate(
  oldState: VoiceState,
  newState: VoiceState
) {
  Logger.debug(
    'VOICE',
    `Voice state update: ${oldState.member?.user.tag} (${oldState.member?.id}) from ${oldState.channelId} to ${newState.channelId}`
  );
  // Ignore if no member or if member is a bot
  if (!newState.member || !oldState.member || oldState.member.user.bot) return;

  // Ignore if the user stayed in the same channel
  if (oldState.channelId === newState.channelId) return;

  const guildId = newState.guild.id;
  const userId = newState.member.id;

  try {
    if (oldState.channelId == null && newState.channelId != null) {
      // User joined a voice channel --> create or update voice activity
      await handleUserJoinedVoice(guildId, userId, newState.channelId);
    } else if (newState.channelId == null && oldState.channelId != null) {
      // User left the channel --> calculate duration and update stats
      await handleUserLeftVoice(guildId, userId, oldState.channelId);
    } else if (oldState.channelId != null && newState.channelId != null) {
      // User switched channels --> update stats for old channel and track new channel
      await handleUserSwitchedChannels(
        guildId,
        userId,
        oldState.channelId,
        newState.channelId
      );
    }
  } catch (error) {
    Logger.error('VOICE', 'Error handling voice state update', error as Error);
  }
}

async function handleUserJoinedVoice(
  guildId: string,
  userId: string,
  channelId: string
) {
  const voiceActivityData = {
    guildId,
    userId,
    channelId,
    joinedAt: new Date(),
  };

  await VoiceActivity.findOneAndUpdate({ guildId, userId }, voiceActivityData, {
    upsert: true,
  });

  Logger.debug(
    'VOICE',
    `User ${userId} joined voice channel ${channelId} in guild ${guildId}`
  );
}

async function handleUserLeftVoice(
  guildId: string,
  userId: string,
  channelId: string
) {
  // Find the voice activity record
  const record = await VoiceActivity.findOne({ guildId, userId });
  if (!record) return;

  const joinedAt = record.joinedAt;
  const leftAt = new Date();
  const duration = Math.floor((leftAt.getTime() - joinedAt.getTime()) / 1000); // seconds

  // Only update if the duration is positive
  if (duration > 0) {
    // Update member stats using upsert to avoid duplicate key errors
    let memberStats = await MemberStats.createOrUpdate(guildId, userId);

    memberStats.addVoiceTime(channelId, duration);
    await memberStats.save();

    // Update server stats using upsert to avoid duplicate key errors
    let serverStats = await ServerStats.createOrUpdate(guildId, {});

    serverStats.incrementVoiceChannel(channelId, duration);
    await serverStats.save();
  }

  // Remove the voice activity record after processing
  await VoiceActivity.deleteOne({ guildId, userId });

  Logger.debug(
    'VOICE',
    `User ${userId} left voice channel ${channelId} after ${duration} seconds`
  );
}

async function handleUserSwitchedChannels(
  guildId: string,
  userId: string,
  oldChannelId: string,
  newChannelId: string
) {
  // First, handle leaving the old channel
  const record = await VoiceActivity.findOne({ guildId, userId });
  if (record) {
    const joinedAt = record.joinedAt;
    const leftAt = new Date();
    const duration = Math.floor((leftAt.getTime() - joinedAt.getTime()) / 1000); // seconds

    // Only update if the duration is positive
    if (duration > 0) {
      // Update member stats for old channel using upsert to avoid duplicate key errors
      let memberStats = await MemberStats.createOrUpdate(guildId, userId);

      memberStats.addVoiceTime(oldChannelId, duration);
      await memberStats.save();

      // Update server stats for old channel using upsert to avoid duplicate key errors
      let serverStats = await ServerStats.createOrUpdate(guildId, {});

      serverStats.incrementVoiceChannel(oldChannelId, duration);
      await serverStats.save();
    }
  }

  // Then, handle joining the new channel
  await handleUserJoinedVoice(guildId, userId, newChannelId);

  Logger.debug(
    'VOICE',
    `User ${userId} switched from ${oldChannelId} to ${newChannelId}`
  );
}

// Export event configuration
module.exports = {
  name: 'voiceStateUpdate',
  once: false,
  execute: handleVoiceStateUpdate,
};
