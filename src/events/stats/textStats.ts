import { Message } from 'discord.js';
import { MemberStats } from '../../models/stats/memberStats';
import { ServerStats } from '../../models/stats/serverStats';
import { GuildSettings } from '../../models/settings/settings';
import { Logger } from '../../utils/logger';

async function handleTextStatsOnMessage(message: Message) {
  // Ignore bot messages
  if (message.author.bot) return;

  // Ignore messages without guild (DMs)
  if (!message.guild) return;

  const userId = message.author.id;
  const guildId = message.guild.id;
  const channelId = message.channel.id;

  // Check server settings if user tracking is enabled
  const serverSettings = await GuildSettings.findByGuildId(guildId);
  if (!serverSettings.getSetting('userTracking')?.enabled) return;

  try {
    // Count the message for the member and for the server. Both writes are
    // atomic, so bursts of messages (and the leveling handler writing to the
    // same member document) cannot overwrite each other's counters.
    await MemberStats.recordTextMessage(guildId, userId, channelId);
    await ServerStats.recordTextMessage(guildId, channelId);
  } catch (error) {
    Logger.error(
      'TEXT_STATS',
      'Error handling text stats on message',
      error as Error
    );
  }
}

// Export event configuration
module.exports = {
  name: 'messageCreate',
  once: false,
  execute: handleTextStatsOnMessage,
};
