import { Guild, Client } from 'discord.js';
import { GuildSettings } from '../models/settings/settings';
import { MemberStats } from '../models/stats/memberStats';
import { ServerStats } from '../models/stats/serverStats';
import { VoiceActivity } from '../models/stats/voiceActivity';
import { Logger } from '../utils/logger';

async function handleGuildRemove(guild: Guild, client: Client) {
  const guildId = guild.id;
  const guildName = guild.name;

  Logger.info(
    'GUILD_REMOVE',
    `Bot was removed from server: ${guildName} (${guildId})`
  );

  try {
    // Delete all Guild Settings
    const deletedSettings = await GuildSettings.deleteMany({ guildId });
    Logger.debug(
      'GUILD_REMOVE',
      `${deletedSettings.deletedCount} Guild Settings deleted`
    );

    // Delete all Member Stats for this Guild
    const deletedMemberStats = await MemberStats.deleteMany({ guildId });
    Logger.debug(
      'GUILD_REMOVE',
      `${deletedMemberStats.deletedCount} Member Stats deleted`
    );

    // Delete all Server Stats for this Guild
    const deletedServerStats = await ServerStats.deleteMany({ guildId });
    Logger.debug(
      'GUILD_REMOVE',
      `${deletedServerStats.deletedCount} Server Stats deleted`
    );

    // Delete all Voice Activity entries for this Guild
    const deletedVoiceActivity = await VoiceActivity.deleteMany({ guildId });
    Logger.debug(
      'GUILD_REMOVE',
      `${deletedVoiceActivity.deletedCount} Voice Activity entries deleted`
    );

    Logger.info(
      'GUILD_REMOVE',
      `All data for server ${guildName} (${guildId}) has been successfully deleted from the database`
    );
  } catch (error) {
    Logger.error(
      'GUILD_REMOVE',
      `Error deleting data for server ${guildName} (${guildId})`,
      error as Error
    );
  }
}

// Export event configuration
module.exports = {
  name: 'guildDelete',
  once: false,
  execute: handleGuildRemove,
};
