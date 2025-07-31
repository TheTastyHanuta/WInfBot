import { Message, EmbedBuilder, TextChannel } from 'discord.js';
import { GuildSettings } from '../../models/settings/settings';
import { Logger } from '../../utils/logger';
import { Colors } from '../../utils/colors';

async function handleMessageUpdate(oldMessage: Message, newMessage: Message) {
  // Ignore bot messages and system messages
  if (!newMessage.author || newMessage.author.bot) return;

  // Ignore messages not in guilds
  if (!newMessage.guild) return;

  // Ignore if content hasn't changed (e.g., just embed updates)
  if (oldMessage.content === newMessage.content) return;

  try {
    // Get guild settings
    const guildSettings = await GuildSettings.findByGuildId(
      newMessage.guild.id
    );

    if (!guildSettings) {
      Logger.debug(
        'MESSAGE_EDIT',
        `No settings found for guild ${newMessage.guild.name} (${newMessage.guild.id})`
      );
      return;
    }

    // Check if audit logging is enabled
    if (!guildSettings.getSetting('auditLogging.enabled')) {
      Logger.debug(
        'MESSAGE_EDIT',
        `Audit logging disabled for guild ${newMessage.guild.name}`
      );
      return;
    }

    // Check if message update module is enabled
    if (!guildSettings.getSetting('auditLogging.modules.messageUpdate')) {
      Logger.debug(
        'MESSAGE_EDIT',
        `Message update logging disabled for guild ${newMessage.guild.name}`
      );
      return;
    }

    // Get the configured audit channel
    const auditChannelId = guildSettings.getSetting('auditLogging.channel');
    if (!auditChannelId) {
      Logger.warn(
        'MESSAGE_EDIT',
        `No audit channel configured for guild ${newMessage.guild.name}`
      );
      return;
    }

    // Get the audit channel
    const auditChannel = newMessage.guild.channels.cache.get(
      auditChannelId
    ) as TextChannel;
    if (!auditChannel) {
      Logger.warn(
        'MESSAGE_EDIT',
        `Audit channel ${auditChannelId} not found in guild ${newMessage.guild.name}`
      );
      return;
    }

    // Check if bot has permission to send messages in audit channel
    if (
      !auditChannel
        .permissionsFor(newMessage.guild.members.me!)
        ?.has('SendMessages')
    ) {
      Logger.warn(
        'MESSAGE_EDIT',
        `No permission to send messages in audit channel for guild ${newMessage.guild.name}`
      );
      return;
    }

    // Truncate content if too long for embed
    const truncateText = (text: string, maxLength: number = 1024): string => {
      if (text.length <= maxLength) return text;
      return text.substring(0, maxLength - 3) + '...';
    };

    // Create embed
    const embed = new EmbedBuilder()
      .setTitle('📝 Message Edited')
      .setColor(Colors.AUDIT_LOG)
      .setAuthor({
        name: `${newMessage.author.displayName} (${newMessage.author.tag})`,
        iconURL: newMessage.author.displayAvatarURL(),
      })
      .addFields(
        {
          name: '📍 Channel',
          value: `<#${newMessage.channel.id}>`,
          inline: true,
        },
        {
          name: '🔗 Message Link',
          value: `[Jump to Message](${newMessage.url})`,
          inline: true,
        },
        {
          name: '⏰ Edited At',
          value: `<t:${Math.floor(newMessage.editedTimestamp! / 1000)}:F>`,
          inline: true,
        }
      )
      .setFooter({
        text: `User ID: ${newMessage.author.id} | Message ID: ${newMessage.id}`,
      })
      .setTimestamp();

    // Add old content if it exists
    if (oldMessage.content && oldMessage.content.trim()) {
      embed.addFields({
        name: '📄 Original Content',
        value: `\`\`\`${truncateText(oldMessage.content)}\`\`\``,
        inline: false,
      });
    }

    // Add new content if it exists
    if (newMessage.content && newMessage.content.trim()) {
      embed.addFields({
        name: '📝 New Content',
        value: `\`\`\`${truncateText(newMessage.content)}\`\`\``,
        inline: false,
      });
    }

    // Add attachment information if present
    if (oldMessage.attachments.size > 0 || newMessage.attachments.size > 0) {
      let attachmentInfo = '';

      if (oldMessage.attachments.size > 0) {
        attachmentInfo += `**Original:** ${oldMessage.attachments.size} attachment(s)\n`;
      }

      if (newMessage.attachments.size > 0) {
        attachmentInfo += `**New:** ${newMessage.attachments.size} attachment(s)`;
      }

      embed.addFields({
        name: '📎 Attachments',
        value: attachmentInfo,
        inline: true,
      });
    }

    // Send the embed
    await auditChannel.send({ embeds: [embed] });

    Logger.debug(
      'MESSAGE_EDIT',
      `Message edit logged for user ${newMessage.author.tag} in guild ${newMessage.guild.name}`
    );
  } catch (error) {
    Logger.error(
      'MESSAGE_EDIT',
      `Error logging message edit in guild ${newMessage.guild?.name}`,
      error as Error
    );
  }
}

// Export event configuration
module.exports = {
  name: 'messageUpdate',
  once: false,
  execute: handleMessageUpdate,
};
