import { Client, GuildMember } from 'discord.js';
import {
  GuildSettings,
  IGuildSettingsDocument,
} from '../../models/settings/settings';
import { Logger } from '../../utils/logger';
import { delay } from '../../utils/delay';

async function handleAutoRoleAdd(member: GuildMember, client: Client) {
  const guildId = member.guild.id;
  const guildName = member.guild.name;
  const userId = member.user.id;
  const userName = member.user.username;

  Logger.debug(
    'AUTO_ROLE_ADD',
    `Checking auto-role for user ${userName} (${userId}) in ${guildName} (${guildId})`
  );

  try {
    // Get Guild Settings for the server
    const guildSettings = await GuildSettings.findByGuildId(guildId);

    // Check if auto-role is enabled
    if (!guildSettings.getSetting('autoRole.enabled')) {
      Logger.debug(
        'AUTO_ROLE_ADD',
        `Auto-role disabled for guild ${guildName} (${guildId})`
      );
      return;
    }

    // Get the configured role ID
    const roleId = guildSettings.getSetting('autoRole.role');

    if (!roleId) {
      Logger.warn(
        'AUTO_ROLE_ADD',
        `Auto-role enabled but no role configured for guild ${guildName} (${guildId})`
      );
      return;
    }

    // Wait a few seconds before adding the role
    Logger.debug(
      'AUTO_ROLE_ADD',
      `Waiting 3 seconds before adding auto-role to ${userName} in ${guildName}`
    );
    await delay(3000);

    // Check if the member is still in the guild (in case they left during the delay)
    try {
      await member.fetch();
    } catch (error) {
      Logger.warn(
        'AUTO_ROLE_ADD',
        `Member ${userName} (${userId}) left guild ${guildName} during auto-role delay`
      );
      return;
    }

    // Find the role in the guild
    const role = member.guild.roles.cache.get(roleId);

    if (!role) {
      Logger.error(
        'AUTO_ROLE_ADD',
        `Configured auto-role ${roleId} not found in guild ${guildName} (${guildId})`
      );
      return;
    }

    // Check if the member already has the role
    if (member.roles.cache.has(roleId)) {
      Logger.debug(
        'AUTO_ROLE_ADD',
        `Member ${userName} already has auto-role ${role.name} in ${guildName}`
      );
      return;
    }

    // Check if the bot has permission to add the role
    if (!member.guild.members.me?.permissions.has('ManageRoles')) {
      Logger.error(
        'AUTO_ROLE_ADD',
        `Bot lacks ManageRoles permission in guild ${guildName} (${guildId})`
      );
      return;
    }

    // Check if the role is higher than the bot's highest role
    const botMember = member.guild.members.me;
    if (botMember && role.position >= botMember.roles.highest.position) {
      Logger.error(
        'AUTO_ROLE_ADD',
        `Auto-role ${role.name} is higher than bot's highest role in guild ${guildName} (${guildId})`
      );
      return;
    }

    // Add the role to the member
    try {
      await member.roles.add(role, 'Auto-role assignment');

      Logger.info(
        'AUTO_ROLE_ADD',
        `Successfully added auto-role ${role.name} to ${userName} in ${guildName}`
      );
    } catch (error) {
      Logger.error(
        'AUTO_ROLE_ADD',
        `Failed to add auto-role ${role.name} to ${userName} in ${guildName}`,
        error as Error
      );
    }
  } catch (error) {
    Logger.error(
      'AUTO_ROLE_ADD',
      `Error processing auto-role for ${userName} in ${guildName} (${guildId})`,
      error as Error
    );
  }
}

// Export event configuration
module.exports = {
  name: 'guildMemberAdd',
  once: false,
  execute: handleAutoRoleAdd,
};
