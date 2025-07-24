import { Message, TextChannel, Client } from 'discord.js';
import { MemberStats } from '../../models/stats/memberStats';
import { GuildSettings } from '../../models/settings/settings';
import { Logger } from '../../utils/logger';

// Cooldown Map to prevent spam (userId -> last message timestamp)
const xpCooldowns = new Map<string, number>();
const XP_COOLDOWN = 1000; // 1 second cooldown between XP gains

async function handleLevelingOnMessage(message: Message) {
  // Ignore bot messages
  if (message.author.bot) return;

  // Ignore messages without guild (DMs)
  if (!message.guild) return;

  const userId = message.author.id;
  const guildId = message.guild.id;
  const now = Date.now();

  // Check cooldown
  const lastXpTime = xpCooldowns.get(userId);
  if (lastXpTime && now - lastXpTime < XP_COOLDOWN) {
    return; // User is on cooldown
  }

  try {
    // Find or create member stats
    let memberStats = await MemberStats.createOrUpdate(guildId, userId);

    // Generate random XP between 15-25
    const xpGained = Math.floor(Math.random() * 11) + 15;

    // Add XP and check for level up
    const leveledUp = memberStats.addXP(xpGained);

    // Save the updated stats
    await memberStats.save();

    // Update cooldown
    xpCooldowns.set(userId, now);

    // If user leveled up, send congratulation message
    if (leveledUp) {
      // Check guild settings for leveling messages
      const guildSettings = await GuildSettings.findOrCreateByGuildId(guildId);
      const levelingSettings = guildSettings.getSetting('leveling');

      // Only send message if leveling messages are enabled
      if (levelingSettings?.enabled && levelingSettings?.messages) {
        const congratsMessage = `Congratulations ${message.author}! You leveled up to **Level ${memberStats.level}**!`;

        Logger.debug(
          'LEVELING',
          `User ${userId} leveled up to Level ${memberStats.level} in guild ${guildId}`
        );

        // Determine which channel to send the message to
        let targetChannel = null;

        if (levelingSettings.channel) {
          // Use the designated leveling channel
          targetChannel = message.guild?.channels.cache.get(
            levelingSettings.channel
          );
        } else {
          // Fallback to the current channel if no specific channel is set
          targetChannel = message.channel;
        }

        // Send level up message to the target channel
        if (
          targetChannel &&
          targetChannel.isTextBased() &&
          'send' in targetChannel
        ) {
          try {
            await targetChannel.send(congratsMessage);
          } catch (error) {
            Logger.error(
              'LEVELING',
              `Failed to send level up message to channel ${targetChannel.id}`,
              error as Error
            );
          }
        }
      }
    }
  } catch (error) {
    Logger.error(
      'LEVELING',
      'Error handling leveling on message',
      error as Error
    );
  }
}

// Export event configuration
module.exports = {
  name: 'messageCreate',
  once: false,
  execute: handleLevelingOnMessage,
};
