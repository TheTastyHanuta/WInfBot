import { Guild, Client } from 'discord.js';
import { GuildSettings } from '../models/settings/settings';
import { Logger } from '../utils/logger';

async function handleGuildAdd(guild: Guild, client: Client) {
  const guildId = guild.id;
  const guildName = guild.name;

  Logger.info('GUILD_ADD', `Bot was added to ${guildName} (${guildId})`);

  try {
    // Create or find Guild Settings for the new server
    const guildSettings = await GuildSettings.findOrCreateByGuildId(guildId);

    Logger.info(
      'GUILD_ADD',
      `Guild Settings for server ${guildName} (${guildId}) have been initialized`
    );
  } catch (error) {
    Logger.error(
      'GUILD_ADD',
      `Error initializing data for server ${guildName} (${guildId})`,
      error as Error
    );
  }
}

// Export event configuration
module.exports = {
  name: 'guildCreate',
  once: false,
  execute: handleGuildAdd,
};
