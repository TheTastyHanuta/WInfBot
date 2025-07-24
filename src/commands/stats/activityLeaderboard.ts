import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  CommandInteraction,
  ComponentType,
  User,
  MessageFlags,
} from 'discord.js';
import { MemberStats, IMemberStats } from '../../models/stats/memberStats';
import { ServerStats, IServerStats } from '../../models/stats/serverStats';
import { Colors } from '../../utils/colors';
import { Logger } from '../../utils/logger';

interface LeaderboardData {
  type: 'member' | 'server';
  page: number;
  totalPages: number;
  guildId: string;
}

export const data = new SlashCommandBuilder()
  .setName('activity-leaderboard')
  .setDescription('Shows the activity leaderboard for members or server');

export async function execute(interaction: CommandInteraction) {
  if (!interaction.guild) {
    return interaction.reply({
      content: 'This command can only be used in a server!',
      flags: MessageFlags.Ephemeral,
    });
  }

  const guildId = interaction.guild.id;

  // Initial data setup
  const leaderboardData: LeaderboardData = {
    type: 'member',
    page: 0,
    totalPages: 0,
    guildId,
  };

  try {
    const { embed, actionRow, totalPages } = await createMemberLeaderboard(
      interaction,
      guildId,
      0
    );

    leaderboardData.totalPages = totalPages;

    const response = await interaction.reply({
      embeds: [embed],
      components: [actionRow],
    });

    // Create collector for button interactions
    const collector = response.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 300000, // 5 minutes
    });

    collector.on('collect', async buttonInteraction => {
      if (buttonInteraction.user.id !== interaction.user.id) {
        return buttonInteraction.reply({
          content: 'You cannot use these buttons!',
          flags: MessageFlags.Ephemeral,
        });
      }

      const [action, value] = buttonInteraction.customId.split('_');

      try {
        switch (action) {
          case 'switch':
            leaderboardData.type = value as 'member' | 'server';
            leaderboardData.page = 0;
            break;
          case 'page':
            switch (value) {
              case 'first':
                leaderboardData.page = 0;
                break;
              case 'prev':
                leaderboardData.page = Math.max(0, leaderboardData.page - 1);
                break;
              case 'next':
                leaderboardData.page = Math.min(leaderboardData.totalPages - 1, leaderboardData.page + 1);
                break;
              case 'last':
                leaderboardData.page = leaderboardData.totalPages - 1;
                break;
            }
            break;
        }

        let embed: EmbedBuilder;
        let actionRow: ActionRowBuilder<ButtonBuilder>;
        let totalPages: number;

        if (leaderboardData.type === 'member') {
          const result = await createMemberLeaderboard(
            buttonInteraction,
            guildId,
            leaderboardData.page
          );
          embed = result.embed;
          actionRow = result.actionRow;
          totalPages = result.totalPages;
        } else {
          const result = await createServerLeaderboard(
            buttonInteraction,
            guildId,
            leaderboardData.page
          );
          embed = result.embed;
          actionRow = result.actionRow;
          totalPages = result.totalPages;
        }

        leaderboardData.totalPages = totalPages;

        await buttonInteraction.update({
          embeds: [embed],
          components: [actionRow],
        });
      } catch (error) {
        Logger.error('ACTIVITYLEADERBOARD', 'Error handling button interaction:', error as Error);
        await buttonInteraction.reply({
          content: 'An error occurred!',
          flags: MessageFlags.Ephemeral,
        });
      }
    });

    collector.on('end', async () => {
      try {
        const disabledRow = createDisabledActionRow(leaderboardData);
        await response.edit({
          components: [disabledRow],
        });
      } catch (error) {
        Logger.error('ACTIVITYLEADERBOARD', 'Error disabling buttons:', error as Error);
      }
    });
  } catch (error) {
    Logger.error('ACTIVITYLEADERBOARD', 'Error executing activity leaderboard command:', error as Error);

    const errorEmbed = new EmbedBuilder()
      .setTitle('❌ Error')
      .setDescription(
        'An error occurred while loading the leaderboard!'
      )
      .setColor(Colors.ERROR);

    if (interaction.replied) {
      await interaction.editReply({ embeds: [errorEmbed], components: [] });
    } else {
      await interaction.reply({
        embeds: [errorEmbed],
        flags: MessageFlags.Ephemeral,
      });
    }
  }
}

async function createMemberLeaderboard(
  interaction: CommandInteraction | any,
  guildId: string,
  page: number
) {
  const members = await MemberStats.getAllByGuild(guildId);
  const totalPages = Math.max(1, Math.ceil(members.length / 10));
  const startIndex = page * 10;
  const endIndex = Math.min(startIndex + 10, members.length);
  const pageMembers = members.slice(startIndex, endIndex);

  const embed = new EmbedBuilder()
    .setTitle('📊 Member Activity Leaderboard')
    .setColor(Colors.PRIMARY)
    .setFooter({
      text: `Page ${page + 1} of ${totalPages} • ${members.length} members total`,
    })
    .setTimestamp();

  if (pageMembers.length === 0) {
    embed.setDescription('No member statistics available yet!');
  } else {
    let description = '';

    for (let i = 0; i < pageMembers.length; i++) {
      const member = pageMembers[i];
      const position = startIndex + i + 1;
      const user = await getUserSafely(interaction.client, member.userId);

      const voiceTimeFormatted = formatVoiceTime(member.voiceTime);

      let medal = '';
      if (position === 1) medal = '🥇';
      else if (position === 2) medal = '🥈';
      else if (position === 3) medal = '🥉';
      else medal = `**${position}.**`;

      description += `${medal} ${user ? `<@${member.userId}>` : 'Unknown User'}\n`;
      description += `┣ **Level:** ${member.level} (${member.xp} XP)\n`;
      description += `┣ **Messages:** ${member.messages.toLocaleString()}\n`;
      description += `┗ **Voice Time:** ${voiceTimeFormatted}\n\n`;
    }

    embed.setDescription(description);
  }

  const actionRow = createActionRow({
    type: 'member',
    page,
    totalPages,
    guildId,
  });

  return { embed, actionRow, totalPages };
}

async function createServerLeaderboard(
  interaction: CommandInteraction | any,
  guildId: string,
  page: number
) {
  const serverStats = await ServerStats.findByGuild(guildId);

  if (!serverStats) {
    const embed = new EmbedBuilder()
      .setTitle('📊 Server Activity Leaderboard')
      .setDescription('No server statistics available yet!')
      .setColor(Colors.PRIMARY)
      .setTimestamp();

    const actionRow = createActionRow({
      type: 'server',
      page: 0,
      totalPages: 1,
      guildId,
    });

    return { embed, actionRow, totalPages: 1 };
  }

  const textChannels = serverStats.getAllTextChannelsSorted();
  const voiceChannels = serverStats.getAllVoiceChannelsSorted();

  // Combine both channel types and paginate
  const allChannels = [
    ...textChannels.slice(0, 5).map(ch => ({ ...ch, type: 'text' })),
    ...voiceChannels.slice(0, 5).map(ch => ({ ...ch, type: 'voice' })),
  ];

  const totalPages = Math.max(1, Math.ceil(allChannels.length / 10));
  const startIndex = page * 10;
  const endIndex = Math.min(startIndex + 10, allChannels.length);
  const pageChannels = allChannels.slice(startIndex, endIndex);

  const embed = new EmbedBuilder()
    .setTitle('📊 Server Activity Leaderboard')
    .setColor(Colors.SECONDARY)
    .setFooter({
      text: `Page ${page + 1} of ${totalPages} • Top Channels`,
    })
    .setTimestamp();

  if (pageChannels.length === 0) {
    embed.setDescription('No channel statistics available yet!');
  } else {
    let textDescription = '';
    let voiceDescription = '';

    // Separate text and voice channels for display
    const textChannelsOnPage = pageChannels.filter(ch => ch.type === 'text');
    const voiceChannelsOnPage = pageChannels.filter(ch => ch.type === 'voice');

    if (textChannelsOnPage.length > 0) {
      textDescription = '**📝 Top Text Channels:**\n';
      textChannelsOnPage.forEach((channel, index) => {
        const position =
          textChannels.findIndex(ch => ch.channelId === channel.channelId) + 1;
        let medal = '';
        if (position === 1) medal = '🥇';
        else if (position === 2) medal = '🥈';
        else if (position === 3) medal = '🥉';
        else medal = `**${position}.**`;

        textDescription += `${medal} <#${channel.channelId}>\n`;
        textDescription += `┗ **${channel.count.toLocaleString()}** Messages\n\n`;
      });
    }

    if (voiceChannelsOnPage.length > 0) {
      voiceDescription = '**🔊 Top Voice Channels:**\n';
      voiceChannelsOnPage.forEach((channel, index) => {
        const position =
          voiceChannels.findIndex(ch => ch.channelId === channel.channelId) + 1;
        let medal = '';
        if (position === 1) medal = '🥇';
        else if (position === 2) medal = '🥈';
        else if (position === 3) medal = '🥉';
        else medal = `**${position}.**`;

        voiceDescription += `${medal} <#${channel.channelId}>\n`;
        voiceDescription += `┗ **${channel.count.toLocaleString()}** Activities\n\n`;
      });
    }

    embed.setDescription(textDescription + voiceDescription);
  }

  const actionRow = createActionRow({
    type: 'server',
    page,
    totalPages,
    guildId,
  });

  return { embed, actionRow, totalPages };
}

function createActionRow(
  data: LeaderboardData
): ActionRowBuilder<ButtonBuilder> {
  const row = new ActionRowBuilder<ButtonBuilder>();

  // Switch buttons
  const memberButton = new ButtonBuilder()
    .setCustomId('switch_member')
    .setLabel('Member')
    .setStyle(
      data.type === 'member' ? ButtonStyle.Primary : ButtonStyle.Secondary
    )
    .setEmoji('👥');

  const serverButton = new ButtonBuilder()
    .setCustomId('switch_server')
    .setLabel('Server')
    .setStyle(
      data.type === 'server' ? ButtonStyle.Primary : ButtonStyle.Secondary
    )
    .setEmoji('🏠');

  // Navigation buttons
  const firstButton = new ButtonBuilder()
    .setCustomId('page_first')
    .setLabel('⏮️')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(data.page === 0);

  const prevButton = new ButtonBuilder()
    .setCustomId('page_prev')
    .setLabel('◀️')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(data.page === 0);

  const nextButton = new ButtonBuilder()
    .setCustomId('page_next')
    .setLabel('▶️')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(data.page >= data.totalPages - 1);

  const lastButton = new ButtonBuilder()
    .setCustomId('page_last')
    .setLabel('⏭️')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(data.page >= data.totalPages - 1);

  row.addComponents(
    memberButton,
    serverButton,
    firstButton,
    prevButton,
    nextButton
  );

  return row;
}

function createDisabledActionRow(
  data: LeaderboardData
): ActionRowBuilder<ButtonBuilder> {
  const row = new ActionRowBuilder<ButtonBuilder>();

  const buttons = [
    new ButtonBuilder()
      .setCustomId('switch_member')
      .setLabel('Member')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('👥')
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId('switch_server')
      .setLabel('Server')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🏠')
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId('page_first')
      .setLabel('⏮️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId('page_prev')
      .setLabel('◀️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId('page_next')
      .setLabel('▶️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
  ];

  row.addComponents(...buttons);
  return row;
}

async function getUserSafely(
  client: any,
  userId: string
): Promise<User | null> {
  try {
    return await client.users.fetch(userId);
  } catch (error) {
    Logger.error('ACTIVITYLEADERBOARD', `Failed to fetch user ${userId}:`, error as Error);
    return null;
  }
}

function formatVoiceTime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0
      ? `${minutes}m ${remainingSeconds}s`
      : `${minutes}m`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
}
