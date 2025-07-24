import { Message, Client } from 'discord.js';
import { MemberStats } from '../../models/stats/memberStats';
import { ServerStats } from '../../models/stats/serverStats';
import { Logger } from '../../utils/logger';

async function handleTextStatsOnMessage(message: Message) {
  // Ignore bot messages
  if (message.author.bot) return;

  // Ignore messages without guild (DMs)
  if (!message.guild) return;

  const userId = message.author.id;
  const guildId = message.guild.id;
  const channelId = message.channel.id;

  try {
    // Update Member Stats for text channel
    let memberStats = await MemberStats.createOrUpdate(guildId, userId);

    // Increment text channel stats for the member
    memberStats.incrementTextChannel(channelId);
    await memberStats.save();

    // Update Server Stats for text channel
    let serverStats = await ServerStats.createOrUpdate(guildId, {});

    // Increment text channel stats for the server
    serverStats.incrementTextChannel(channelId);
    await serverStats.save();
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
