import {
  Collection,
  Message,
  EmbedBuilder,
  TextChannel,
  AuditLogEvent,
  PartialMessage,
} from 'discord.js';
import { GuildSettings } from '../../models/settings/settings';
import { Logger } from '../../utils/logger';
import { Colors } from '../../utils/colors';

async function handleMessageBulkDelete(
  messages: Collection<string, Message | PartialMessage>
) {
  // Get the first message to access guild information
  const firstMessage = messages.first();
  if (!firstMessage || !firstMessage.guild) return;

  const guild = firstMessage.guild;

  try {
    // Get guild settings
    const guildSettings = await GuildSettings.findByGuildId(guild.id);

    if (!guildSettings) {
      Logger.debug(
        'MESSAGE_BULK_DELETE',
        `No settings found for guild ${guild.name} (${guild.id})`
      );
      return;
    }

    // Check if audit logging is enabled
    if (!guildSettings.getSetting('auditLogging.enabled')) {
      Logger.debug(
        'MESSAGE_BULK_DELETE',
        `Audit logging disabled for guild ${guild.name}`
      );
      return;
    }

    // Check if message delete module is enabled (using same setting as regular delete)
    if (!guildSettings.getSetting('auditLogging.modules.messageDelete')) {
      Logger.debug(
        'MESSAGE_BULK_DELETE',
        `Message delete logging disabled for guild ${guild.name}`
      );
      return;
    }

    // Get the configured audit channel
    const auditChannelId = guildSettings.getSetting('auditLogging.channel');
    if (!auditChannelId) {
      Logger.warn(
        'MESSAGE_BULK_DELETE',
        `No audit channel configured for guild ${guild.name}`
      );
      return;
    }

    // Get the audit channel
    const auditChannel = guild.channels.cache.get(
      auditChannelId
    ) as TextChannel;
    if (!auditChannel) {
      Logger.warn(
        'MESSAGE_BULK_DELETE',
        `Audit channel ${auditChannelId} not found in guild ${guild.name}`
      );
      return;
    }

    // Check if bot has permission to send messages in audit channel
    if (!auditChannel.permissionsFor(guild.members.me!)?.has('SendMessages')) {
      Logger.warn(
        'MESSAGE_BULK_DELETE',
        `No permission to send messages in audit channel for guild ${guild.name}`
      );
      return;
    }

    // Try to find who deleted the messages from audit logs
    let deletedBy = null;
    let deletionReason = 'Unknown';

    try {
      // Check if bot has permission to view audit logs
      if (guild.members.me?.permissions.has('ViewAuditLog')) {
        const auditLogs = await guild.fetchAuditLogs({
          type: AuditLogEvent.MessageBulkDelete,
          limit: 5,
        });

        // Find the audit log entry for this bulk deletion
        const auditEntry = auditLogs.entries.find(entry => {
          // Check if the audit log entry is recent (within last 10 seconds)
          const timeDiff = Date.now() - entry.createdTimestamp;
          return timeDiff < 10000 && entry.extra?.count === messages.size;
        });

        if (auditEntry) {
          deletedBy = auditEntry.executor;
          deletionReason = auditEntry.reason || 'No reason provided';
        }
      }
    } catch (error) {
      Logger.warn(
        'MESSAGE_BULK_DELETE',
        `Could not fetch audit logs for guild ${guild.name}: ${error}`
      );
    }

    // Get channel information
    const channel = firstMessage.channel as TextChannel;

    // Filter out bot messages and partial messages for statistics
    const userMessages = messages.filter(msg => msg.author && !msg.author.bot);
    const messagesByUser = new Map<string, number>();
    let totalAttachments = 0;
    let totalEmbeds = 0;

    // Collect statistics
    userMessages.forEach(message => {
      if (message.author) {
        const userId = message.author.id;
        messagesByUser.set(userId, (messagesByUser.get(userId) || 0) + 1);
      }

      if (message.attachments) {
        totalAttachments += message.attachments.size;
      }

      if (message.embeds) {
        totalEmbeds += message.embeds.length;
      }
    });

    // Truncate text function
    const truncateText = (text: string, maxLength: number = 1024): string => {
      if (text.length <= maxLength) return text;
      return text.substring(0, maxLength - 3) + '...';
    };

    // Create main embed
    const embed = new EmbedBuilder()
      .setTitle('🗑️ Bulk Message Deletion')
      .setColor(Colors.MODERATION)
      .addFields(
        {
          name: '📍 Channel',
          value: `<#${channel.id}>`,
          inline: true,
        },
        {
          name: '📊 Total Messages',
          value: `${messages.size}`,
          inline: true,
        },
        {
          name: '⏰ Deleted At',
          value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
          inline: true,
        }
      );

    // Add who deleted the messages
    if (deletedBy) {
      embed.addFields({
        name: '👤 Deleted By',
        value: `<@${deletedBy.id}> (${deletedBy.tag})`,
        inline: true,
      });

      if (deletionReason !== 'No reason provided') {
        embed.addFields({
          name: '📝 Reason',
          value: deletionReason,
          inline: true,
        });
      }
    } else {
      embed.addFields({
        name: '👤 Deleted By',
        value: 'Unknown (possibly bot or system)',
        inline: true,
      });
    }

    // Add statistics about attachments and embeds
    if (totalAttachments > 0 || totalEmbeds > 0) {
      let contentInfo = '';
      if (totalAttachments > 0) {
        contentInfo += `📎 ${totalAttachments} attachment(s)`;
      }
      if (totalEmbeds > 0) {
        if (contentInfo) contentInfo += '\n';
        contentInfo += `📊 ${totalEmbeds} embed(s)`;
      }

      embed.addFields({
        name: '📄 Content Summary',
        value: contentInfo,
        inline: true,
      });
    }

    // Add user breakdown if there are user messages
    if (messagesByUser.size > 0) {
      const userBreakdown = Array.from(messagesByUser.entries())
        .sort(([, a], [, b]) => b - a) // Sort by message count descending
        .slice(0, 10) // Limit to top 10 users
        .map(([userId, count]) => `<@${userId}>: ${count} message(s)`)
        .join('\n');

      embed.addFields({
        name: '👥 Messages by User',
        value: truncateText(userBreakdown, 1000),
        inline: false,
      });

      if (messagesByUser.size > 10) {
        embed.addFields({
          name: '📊 Additional Users',
          value: `... and ${messagesByUser.size - 10} more user(s)`,
          inline: true,
        });
      }
    }

    embed
      .setFooter({
        text: `Channel ID: ${channel.id} | User Messages: ${userMessages.size}`,
      })
      .setTimestamp();

    // Send the main embed
    await auditChannel.send({ embeds: [embed] });

    // If there are recent messages with content, show a sample in a separate embed
    const recentMessagesWithContent = Array.from(userMessages.values())
      .filter(msg => msg.content && msg.content.trim() && msg.createdTimestamp)
      .sort((a, b) => (b.createdTimestamp || 0) - (a.createdTimestamp || 0))
      .slice(0, 5);

    if (recentMessagesWithContent.length > 0) {
      const sampleEmbed = new EmbedBuilder()
        .setTitle('📋 Sample of Deleted Messages')
        .setColor(Colors.MODERATION);

      const messageList = recentMessagesWithContent
        .map((msg: Message | PartialMessage) => {
          const timestamp = msg.createdTimestamp
            ? `<t:${Math.floor(msg.createdTimestamp / 1000)}:t>`
            : 'Unknown time';
          const author = msg.author
            ? `${msg.author.displayName}`
            : 'Unknown user';
          const content = truncateText(msg.content || '', 100);
          return `**${author}** (${timestamp}):\n\`\`\`${content}\`\`\``;
        })
        .join('\n\n');

      sampleEmbed.setDescription(truncateText(messageList, 4000));

      if (userMessages.size > 5) {
        sampleEmbed.setFooter({
          text: `Showing 5 of ${userMessages.size} user messages with content`,
        });
      }

      await auditChannel.send({ embeds: [sampleEmbed] });
    }

    Logger.debug(
      'MESSAGE_BULK_DELETE',
      `Bulk message deletion logged for ${messages.size} messages in guild ${guild.name}`
    );
  } catch (error) {
    Logger.error(
      'MESSAGE_BULK_DELETE',
      `Error logging bulk message deletion in guild ${guild?.name}`,
      error as Error
    );
  }
}

// Export event configuration
module.exports = {
  name: 'messageDeleteBulk',
  once: false,
  execute: handleMessageBulkDelete,
};
