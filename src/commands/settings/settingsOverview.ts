import {
  SlashCommandBuilder,
  CommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  MessageFlags,
} from 'discord.js';
import {
  GuildSettings,
  IGuildSettingsDocument,
} from '../../models/settings/settings';
import { Logger } from '../../utils/logger';
import { Colors } from '../../utils/colors';
import config from '../../../config.json'; 

const botName = config.botName;

export const data = new SlashCommandBuilder()
  .setName('settings-overview')
  .setDescription(`Shows an overview of all bot settings for this server - ${botName}`)
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction: CommandInteraction) {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const guildSettings = await GuildSettings.findByGuildId(
      interaction.guild!.id
    );

    const embed = createSettingsOverviewEmbed(guildSettings, interaction);

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    Logger.error(
      'SETTINGSOVERVIEW',
      'Error in settings-overview command:',
      error as Error
    );
    await interaction.editReply({
      content: '❌ An error occurred while loading the settings.',
    });
  }
}

function createSettingsOverviewEmbed(
  guildSettings: IGuildSettingsDocument,
  interaction: CommandInteraction
): EmbedBuilder {
  const { settings } = guildSettings;

  const embed = new EmbedBuilder()
    .setTitle('🔧 Server Settings Overview')
    .setDescription('Here are all current bot settings for this server:')
    .setColor(Colors.PRIMARY)
    .setTimestamp()
    .setFooter({
      text: `Requested by ${interaction.user.tag} | ${botName}`,
      iconURL: interaction.user.displayAvatarURL(),
    });

  // Audit Logging
  const auditLogging = settings.auditLogging;
  const auditModulesEnabled = Object.values(auditLogging.modules).filter(
    Boolean
  ).length;
  const totalAuditModules = Object.keys(auditLogging.modules).length;

  embed.addFields({
    name: '📋 Audit Logging',
    value:
      `**Status:** ${getStatusEmoji(auditLogging.enabled)} ${auditLogging.enabled ? 'Enabled' : 'Disabled'}\n` +
      `**Channel:** ${auditLogging.channel ? `<#${auditLogging.channel}>` : 'Not set'}\n` +
      `**Modules:** ${auditModulesEnabled}/${totalAuditModules} enabled`,
    inline: true,
  });

  // Welcome Messages
  const welcomeMessages = settings.welcomeMessages;
  embed.addFields({
    name: '👋 Welcome Messages',
    value:
      `**Status:** ${getStatusEmoji(welcomeMessages.enabled)} ${welcomeMessages.enabled ? 'Enabled' : 'Disabled'}\n` +
      `**Channel:** ${welcomeMessages.channel ? `<#${welcomeMessages.channel}>` : 'Not set'}\n` +
      `**Message:** ${welcomeMessages.message.length > 50 ? welcomeMessages.message.substring(0, 50) + '...' : welcomeMessages.message}`,
    inline: true,
  });

  // Goodbye Messages
  const goodbyeMessages = settings.goodbyeMessages;
  embed.addFields({
    name: '👋 Goodbye Messages',
    value:
      `**Status:** ${getStatusEmoji(goodbyeMessages.enabled)} ${goodbyeMessages.enabled ? 'Enabled' : 'Disabled'}\n` +
      `**Channel:** ${goodbyeMessages.channel ? `<#${goodbyeMessages.channel}>` : 'Not set'}\n` +
      `**Message:** ${goodbyeMessages.message.length > 50 ? goodbyeMessages.message.substring(0, 50) + '...' : goodbyeMessages.message}`,
    inline: true,
  });

  // Invite Tracking
  const inviteTracking = settings.inviteTracking;
  embed.addFields({
    name: '🔗 Invite Tracking',
    value:
      `**Status:** ${getStatusEmoji(inviteTracking.enabled)} ${inviteTracking.enabled ? 'Enabled' : 'Disabled'}\n` +
      `**Channel:** ${inviteTracking.channel ? `<#${inviteTracking.channel}>` : 'Not set'}`,
    inline: true,
  });

  // User Tracking
  const userTracking = settings.userTracking;
  embed.addFields({
    name: '👤 User Tracking',
    value: `**Status:** ${getStatusEmoji(userTracking.enabled)} ${userTracking.enabled ? 'Enabled' : 'Disabled'}`,
    inline: true,
  });

  // Leveling System
  const leveling = settings.leveling;
  embed.addFields({
    name: '📈 Leveling System',
    value:
      `**Status:** ${getStatusEmoji(leveling.enabled)} ${leveling.enabled ? 'Enabled' : 'Disabled'}\n` +
      `**Messages:** ${getStatusEmoji(leveling.messages)} ${leveling.messages ? 'Enabled' : 'Disabled'}\n` +
      `**Channel:** ${leveling.channel ? `<#${leveling.channel}>` : 'Not set'}`,
    inline: true,
  });

  // Moderation
  const moderation = settings.moderation;
  embed.addFields({
    name: '🛡️ Moderation',
    value: `**Status:** ${getStatusEmoji(moderation.enabled)} ${moderation.enabled ? 'Enabled' : 'Disabled'}`,
    inline: true,
  });

  // Auto Role
  const autoRole = settings.autoRole;
  embed.addFields({
    name: '🎭 Auto Role',
    value:
      `**Status:** ${getStatusEmoji(autoRole.enabled)} ${autoRole.enabled ? 'Enabled' : 'Disabled'}\n` +
      `**Role:** ${autoRole.role ? `<@&${autoRole.role}>` : 'Not set'}`,
    inline: true,
  });

  // Birthday Messages
  const birthdayMessages = settings.birthdayMessages;
  embed.addFields({
    name: '🎂 Birthday Messages',
    value:
      `**Status:** ${getStatusEmoji(birthdayMessages.enabled)} ${birthdayMessages.enabled ? 'Enabled' : 'Disabled'}\n` +
      `**Channel:** ${birthdayMessages.channel ? `<#${birthdayMessages.channel}>` : 'Not set'}`,
    inline: true,
  });

  // Restricted Commands
  if (guildSettings.restrictedCommands.length > 0) {
    const restrictedCommandsList = guildSettings.restrictedCommands
      .slice(0, 5) // Limit to first 5 to avoid embed limits
      .map(cmd => `\`${cmd.command}\` in <#${cmd.channelId}>`)
      .join('\n');

    const moreCommands =
      guildSettings.restrictedCommands.length > 5
        ? `\n... and ${guildSettings.restrictedCommands.length - 5} more`
        : '';

    embed.addFields({
      name: '🚫 Restricted Commands',
      value: restrictedCommandsList + moreCommands,
      inline: false,
    });
  } else {
    embed.addFields({
      name: '🚫 Restricted Commands',
      value: 'No command restrictions configured',
      inline: false,
    });
  }

  // Summary
  const enabledFeatures = [
    settings.auditLogging.enabled,
    settings.welcomeMessages.enabled,
    settings.goodbyeMessages.enabled,
    settings.inviteTracking.enabled,
    settings.userTracking.enabled,
    settings.leveling.enabled,
    settings.moderation.enabled,
    settings.autoRole.enabled,
    settings.birthdayMessages.enabled,
  ].filter(Boolean).length;

  embed.addFields({
    name: '📊 Summary',
    value: `**Enabled Features:** ${enabledFeatures}/9\n**Last Updated:** <t:${Math.floor(guildSettings.updatedAt.getTime() / 1000)}:R>`,
    inline: false,
  });

  return embed;
}

function getStatusEmoji(enabled: boolean): string {
  return enabled ? '✅' : '❌';
}
