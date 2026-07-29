import {
  Message,
  PartialMessage,
  EmbedBuilder,
  TextChannel,
  PermissionFlagsBits,
} from 'discord.js';
import { GuildSettings } from '../../models/settings/settings';
import { Logger } from '../../utils/logger';
import { Colors } from '../../utils/colors';
import { matchSingleMessageDeleteAuditLog } from '../../utils/messageDeleteAudit';
import { codeBlock, truncateText } from '../../utils/embedText';

async function handleMessageDelete(message: Message | PartialMessage) {
  // Ignore bot messages when author data is available
  if (message.author?.bot) return;

  // Ignore messages not in guilds
  if (!message.guild) return;

  try {
    // Get guild settings
    const guildSettings = await GuildSettings.findByGuildId(message.guild.id);

    if (!guildSettings) {
      Logger.debug(
        'MESSAGE_DELETE',
        `No settings found for guild ${message.guild.name} (${message.guild.id})`
      );
      return;
    }

    // Check if audit logging is enabled
    if (!guildSettings.getSetting('auditLogging.enabled')) {
      Logger.debug(
        'MESSAGE_DELETE',
        `Audit logging disabled for guild ${message.guild.name}`
      );
      return;
    }

    // Check if message delete module is enabled
    if (!guildSettings.getSetting('auditLogging.modules.messageDelete')) {
      Logger.debug(
        'MESSAGE_DELETE',
        `Message delete logging disabled for guild ${message.guild.name}`
      );
      return;
    }

    // Get the configured audit channel
    const auditChannelId = guildSettings.getSetting('auditLogging.channel');
    if (!auditChannelId) {
      Logger.warn(
        'MESSAGE_DELETE',
        `No audit channel configured for guild ${message.guild.name}`
      );
      return;
    }

    // Get the audit channel
    const auditChannel = message.guild.channels.cache.get(
      auditChannelId
    ) as TextChannel;
    if (!auditChannel) {
      Logger.warn(
        'MESSAGE_DELETE',
        `Audit channel ${auditChannelId} not found in guild ${message.guild.name}`
      );
      return;
    }

    // Check if bot has permission to send messages in audit channel
    if (
      !auditChannel
        .permissionsFor(message.guild.members.me!)
        ?.has(PermissionFlagsBits.SendMessages)
    ) {
      Logger.warn(
        'MESSAGE_DELETE',
        `No permission to send messages in audit channel for guild ${message.guild.name}`
      );
      return;
    }

    const author = message.author ?? null;
    const authorName = author?.displayName ?? 'Unknown Author';
    const authorTag = author?.tag ?? 'Unknown User';
    const authorId = author?.id ?? null;
    const isPartialDelete = message.partial || !author;

    // Try to find who deleted the message from audit logs
    let deletedBy = null;
    let deletionReason: string | null = null;

    try {
      // Check if bot has permission to view audit logs
      if (
        message.guild.members.me?.permissions.has(
          PermissionFlagsBits.ViewAuditLog
        )
      ) {
        const auditMatch = await matchSingleMessageDeleteAuditLog(
          message.guild,
          message.channel.id,
          authorId
        );

        if (auditMatch) {
          deletedBy = auditMatch.executor;
          deletionReason = auditMatch.reason;
        }
      }
    } catch (error) {
      Logger.warn(
        'MESSAGE_DELETE',
        `Could not fetch audit logs for guild ${message.guild.name}: ${error}`
      );
    }

    // Create embed
    const embed = new EmbedBuilder()
      .setTitle('🗑️ Message Deleted')
      .setColor(Colors.MODERATION)
      .addFields(
        {
          name: '📍 Channel',
          value: `<#${message.channel.id}>`,
          inline: true,
        },
        {
          name: '⏰ Deleted At',
          value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
          inline: true,
        },
        {
          name: '📅 Originally Sent',
          value: `<t:${Math.floor(message.createdTimestamp / 1000)}:F>`,
          inline: true,
        }
      );

    if (author) {
      embed.setAuthor({
        name: `${authorName} (${authorTag})`,
        iconURL: author.displayAvatarURL(),
      });
    } else {
      embed.setAuthor({
        name: 'Unknown Author',
      });
    }

    // Add who deleted the message
    if (deletedBy) {
      embed.addFields({
        name: '👤 Deleted By',
        value: `<@${deletedBy.id}> (${deletedBy.tag})`,
        inline: true,
      });

      if (deletionReason) {
        embed.addFields({
          name: '📝 Reason',
          value: deletionReason,
          inline: true,
        });
      }
    } else {
      embed.addFields({
        name: '👤 Deleted By',
        value: authorId
          ? 'No matching audit log entry. This is usually a self-delete or an unavailable audit-log record.'
          : 'Unknown',
        inline: true,
      });
    }

    if (isPartialDelete) {
      embed.addFields({
        name: '⚠️ Metadata',
        value:
          'Author or content details were not fully available because Discord only sent a partial delete event for an uncached message.',
        inline: false,
      });
    }

    // Add message content if it exists
    if (message.content && message.content.trim()) {
      embed.addFields({
        name: '📄 Message Content',
        value: codeBlock(message.content),
        inline: false,
      });
    } else {
      embed.addFields({
        name: '📄 Message Content',
        value: isPartialDelete
          ? '*No text content available (message was likely uncached when deleted)*'
          : '*No text content (possibly media only)*',
        inline: false,
      });
    }

    // Add attachment information if present
    if (message.attachments.size > 0) {
      const attachmentList = message.attachments
        .map(attachment => {
          const sizeKB = (attachment.size / 1024).toFixed(1);
          const dimensions =
            attachment.width && attachment.height
              ? ` (${attachment.width}x${attachment.height})`
              : '';
          return `• **${attachment.name}** - ${sizeKB} KB${dimensions}\n  URL: ${attachment.url}`;
        })
        .join('\n');

      embed.addFields({
        name: '📎 Attachments',
        value: `${message.attachments.size} file(s):\n${truncateText(attachmentList, 1000)}`,
        inline: false,
      });
    }

    // Add embed information if present
    if (message.embeds.length > 0) {
      const embedDetails = message.embeds
        .map((messageEmbed, index) => {
          let details = `**Embed ${index + 1}:**`;

          if (messageEmbed.title) {
            details += `\n• Title: ${truncateText(messageEmbed.title, 100)}`;
          }

          if (messageEmbed.description) {
            details += `\n• Description: ${truncateText(messageEmbed.description, 150)}`;
          }

          if (messageEmbed.url) {
            details += `\n• URL: ${messageEmbed.url}`;
          }

          if (messageEmbed.author?.name) {
            details += `\n• Author: ${messageEmbed.author.name}`;
          }

          if (messageEmbed.footer?.text) {
            details += `\n• Footer: ${truncateText(messageEmbed.footer.text, 100)}`;
          }

          if (messageEmbed.fields && messageEmbed.fields.length > 0) {
            details += `\n• Fields: ${messageEmbed.fields.length} field(s)`;
            messageEmbed.fields.slice(0, 3).forEach((field, fieldIndex) => {
              details += `\n  - ${truncateText(field.name, 50)}: ${truncateText(field.value, 100)}`;
            });
            if (messageEmbed.fields.length > 3) {
              details += `\n  - ... and ${messageEmbed.fields.length - 3} more field(s)`;
            }
          }

          if (messageEmbed.image?.url) {
            details += `\n• Image: ${messageEmbed.image.url}`;
          }

          if (messageEmbed.thumbnail?.url) {
            details += `\n• Thumbnail: ${messageEmbed.thumbnail.url}`;
          }

          if (messageEmbed.color) {
            details += `\n• Color: #${messageEmbed.color.toString(16).padStart(6, '0')}`;
          }

          return details;
        })
        .join('\n\n');

      embed.addFields({
        name: '📊 Embeds',
        value: truncateText(embedDetails, 1000),
        inline: false,
      });
    }

    // Add reaction information if present
    if (message.reactions.cache.size > 0) {
      embed.addFields({
        name: ':melting_face: Reactions',
        value: `${message.reactions.cache
          .map(reaction => `${reaction.emoji.name} - ${reaction.count}`)
          .join('\n')}`,
        inline: false,
      });
    }

    embed
      .setFooter({
        text: `User ID: ${authorId ?? 'Unknown'} | Message ID: ${message.id}`,
      })
      .setTimestamp();

    // Send the embed
    await auditChannel.send({ embeds: [embed] });

    Logger.debug(
      'MESSAGE_DELETE',
      `Message deletion logged for user ${authorTag} in guild ${message.guild.name}`
    );
  } catch (error) {
    Logger.error(
      'MESSAGE_DELETE',
      `Error logging message deletion in guild ${message.guild?.name}`,
      error as Error
    );
  }
}

// Export event configuration
module.exports = {
  name: 'messageDelete',
  once: false,
  execute: handleMessageDelete,
};
