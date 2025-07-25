import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  AttachmentBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  User,
  MessageFlags,
  GuildMember,
  Client,
} from 'discord.js';
import { Profile } from 'discord-arts';
import { MemberStats } from '../../models/stats/memberStats';
import { Logger } from '../../utils/logger';
import { Colors } from '../../utils/colors';
import { formatVoiceTime } from '../../utils/formatVoiceTime';

interface RankData {
  view: 'overview' | 'channels';
  page: number;
  totalPages: number;
  memberStats: any;
  targetUser: User;
  rank: number;
}

export const data = new SlashCommandBuilder()
  .setName('rank')
  .setDescription('Displays the level and XP of a user')
  .addUserOption(option =>
    option
      .setName('user')
      .setDescription('The user whose rank should be displayed')
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    return interaction.reply({
      content: 'This command can only be used in a server.',
      flags: MessageFlags.Ephemeral,
    });
  }

  await interaction.deferReply();

  try {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const guildId = interaction.guild.id;
    const fetchedMember = (await interaction.guild.members
      .fetch(targetUser.id)
      .catch(() => null)) as GuildMember | null;

    // Get member stats from the database
    let memberStats = await MemberStats.findByGuildAndUser(
      guildId,
      targetUser.id
    );

    // If there are not stats, send a error message
    if (!memberStats) {
      return interaction.followUp({
        content: `❌ No stats found for ${targetUser.tag}.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    // Calculate the current rank (position) in the server
    const rank = await memberStats.getRankInGuild();

    // Initial data setup
    const rankData: RankData = {
      view: 'overview',
      page: 0,
      totalPages: 0,
      memberStats,
      targetUser,
      rank,
    };

    const { embed, actionRow, attachment } = await createOverviewView(
      interaction,
      rankData,
      fetchedMember
    );

    const response = await interaction.followUp({
      embeds: [embed],
      files: attachment ? [attachment] : [],
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
            rankData.view = value as 'overview' | 'channels';
            rankData.page = 0;
            break;
          case 'page':
            switch (value) {
              case 'first':
                rankData.page = 0;
                break;
              case 'prev':
                rankData.page = Math.max(0, rankData.page - 1);
                break;
              case 'next':
                rankData.page = Math.min(
                  rankData.totalPages - 1,
                  rankData.page + 1
                );
                break;
              case 'last':
                rankData.page = rankData.totalPages - 1;
                break;
            }
            break;
        }

        let embed: EmbedBuilder;
        let actionRow: ActionRowBuilder<ButtonBuilder>;
        let attachment: AttachmentBuilder | null = null;

        if (rankData.view === 'overview') {
          const result = await createOverviewView(
            buttonInteraction,
            rankData,
            fetchedMember
          );
          embed = result.embed;
          actionRow = result.actionRow;
          attachment = result.attachment;
        } else {
          const result = await createChannelsView(buttonInteraction, rankData);
          embed = result.embed;
          actionRow = result.actionRow;
          rankData.totalPages = result.totalPages;
        }

        await buttonInteraction.update({
          embeds: [embed],
          files: attachment ? [attachment] : [],
          components: [actionRow],
        });
      } catch (error) {
        Logger.error(
          'RANK',
          'Error handling button interaction',
          error as Error
        );
        await buttonInteraction.reply({
          content: 'An error occurred!',
          flags: MessageFlags.Ephemeral,
        });
      }
    });

    collector.on('end', async () => {
      try {
        const disabledRow = createDisabledActionRow(rankData);
        await response.edit({
          components: [disabledRow],
        });
      } catch (error) {
        Logger.error('RANK', 'Error disabling buttons', error as Error);
      }
    });
  } catch (error) {
    Logger.error('RANK', 'Error in rank command', error as Error);

    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({
        content:
          'There was an error creating the rank card. Please try again later.',
        flags: MessageFlags.Ephemeral,
      });
    } else {
      await interaction.reply({
        content:
          'There was an error creating the rank card. Please try again later.',
        flags: MessageFlags.Ephemeral,
      });
    }
  }
}

// Create the overview view with embed and rank card
async function createOverviewView(
  interaction: ChatInputCommandInteraction | any,
  rankData: RankData,
  fetchedMember: GuildMember | null
) {
  const { memberStats, targetUser, rank } = rankData;

  // Calculate XP for the next level
  const xpInCurrentLevel = memberStats.xp;
  const xpNeededForNextLevel = memberStats.getXPRequiredForLevel(
    memberStats.level + 1
  );
  const progressPercentage = Math.round(
    (xpInCurrentLevel / xpNeededForNextLevel) * 100
  );

  // Create embed with user overview
  const embed = new EmbedBuilder()
    .setTitle(`📊 Rank Information for ${targetUser.displayName}`)
    .setColor(Colors.PRIMARY)
    .setImage(`attachment://rank-${targetUser.username}.png`)
    .setThumbnail(targetUser.displayAvatarURL({ size: 256 }))
    .addFields(
      {
        name: '🏆 Rank',
        value: `#${rank}`,
        inline: true,
      },
      {
        name: '📈 Level',
        value: `${memberStats.level}`,
        inline: true,
      },
      {
        name: '⭐ Experience',
        value: `${xpInCurrentLevel}/${xpNeededForNextLevel} XP\n(${progressPercentage}%)`,
        inline: true,
      },
      {
        name: '💬 Messages',
        value: `${memberStats.messages.toLocaleString()}`,
        inline: true,
      },
      {
        name: '🎙️ Voice Time',
        value: formatVoiceTime(memberStats.voiceTime),
        inline: true,
      },
      {
        name: '📅 Member Since',
        value: fetchedMember?.joinedAt
          ? `<t:${Math.floor(fetchedMember.joinedAt.getTime() / 1000)}:R>`
          : 'Unknown',
        inline: true,
      }
    )
    .setTimestamp();

  // Create the rank card with discord-arts
  const buffer = await Profile(targetUser.id, {
    //customTag: `#${rank} in the server`, NOT WORKING TODO: Find a fix for Package
    //customSubtitle: `${memberStats.messages} messages • ${Math.floor(memberStats.voiceTime / 3600)}h voice`, NOT WORKING  TODO: Find a fix for Package
    presenceStatus: fetchedMember?.presence?.status || 'offline',
    customDate: fetchedMember?.joinedAt || new Date(),
    badgesFrame: true,
    rankData: {
      currentXp: xpInCurrentLevel,
      requiredXp: xpNeededForNextLevel,
      level: memberStats.level,
      rank: rank,
      barColor: '#EB459E',
      levelColor: '#EB459E',
      autoColorRank: true,
    },
    font: 'ROBOTO',
    borderAllign: 'horizontal',
  });

  const attachment = new AttachmentBuilder(buffer, {
    name: `rank-${targetUser.username}.png`,
  });

  const actionRow = createActionRow(rankData);

  return { embed, actionRow, attachment };
}

// Create the channels view
async function createChannelsView(
  interaction: ChatInputCommandInteraction | any,
  rankData: RankData
) {
  const { memberStats, targetUser, page } = rankData;

  // Get text channels data and sort by message count
  const textChannels = Array.from(
    memberStats.textChannels.entries() as IterableIterator<[string, number]>
  )
    .map(([channelId, count]) => ({ channelId, count }))
    .sort((a, b) => b.count - a.count);

  // Get voice channels data and sort by voice time
  const voiceChannels = Array.from(
    memberStats.voiceChannels.entries() as IterableIterator<[string, number]>
  )
    .map(([channelId, count]) => ({ channelId, count }))
    .sort((a, b) => b.count - a.count);

  // Pagination settings - 5 channels per type per page
  const channelsPerTypePerPage = 5;
  const totalTextPages = Math.ceil(
    textChannels.length / channelsPerTypePerPage
  );
  const totalVoicePages = Math.ceil(
    voiceChannels.length / channelsPerTypePerPage
  );
  const totalPages = Math.max(1, Math.max(totalTextPages, totalVoicePages));

  const startIndex = page * channelsPerTypePerPage;
  const endIndex = startIndex + channelsPerTypePerPage;

  const pageTextChannels = textChannels.slice(startIndex, endIndex);
  const pageVoiceChannels = voiceChannels.slice(startIndex, endIndex);

  const embed = new EmbedBuilder()
    .setTitle(`📊 Channel Activity for ${targetUser.displayName}`)
    .setColor(Colors.SECONDARY)
    .setThumbnail(targetUser.displayAvatarURL({ size: 256 }))
    .setFooter({
      text: `Page ${page + 1} of ${totalPages} • ${textChannels.length} text, ${voiceChannels.length} voice channels`,
    })
    .setTimestamp();

  if (pageTextChannels.length === 0 && pageVoiceChannels.length === 0) {
    embed.setDescription('No channel activity data available yet!');
  } else {
    // Add fields for text and voice channels side by side
    embed.addFields(
      {
        name: '📝 Text Channels',
        value:
          pageTextChannels.length > 0
            ? pageTextChannels
                .map((channel, i) => {
                  const globalPosition = startIndex + i + 1;
                  let medal = '';
                  if (globalPosition === 1) medal = '🥇';
                  else if (globalPosition === 2) medal = '🥈';
                  else if (globalPosition === 3) medal = '🥉';
                  else medal = `**${globalPosition}.**`;
                  return `${medal} <#${channel.channelId}>\n${channel.count.toLocaleString()} messages`;
                })
                .join('\n\n')
            : 'No text channel activity',
        inline: true,
      },
      {
        name: '\u200b',
        value: '\u200b',
        inline: true,
      },
      {
        name: '🔊 Voice Channels',
        value:
          pageVoiceChannels.length > 0
            ? pageVoiceChannels
                .map((channel, i) => {
                  const globalPosition = startIndex + i + 1;
                  let medal = '';
                  if (globalPosition === 1) medal = '🥇';
                  else if (globalPosition === 2) medal = '🥈';
                  else if (globalPosition === 3) medal = '🥉';
                  else medal = `**${globalPosition}.**`;
                  return `${medal} <#${channel.channelId}>\n${formatVoiceTime(channel.count)}`;
                })
                .join('\n\n')
            : 'No voice channel activity',
        inline: true,
      }
    );
  }

  rankData.totalPages = totalPages;
  const actionRow = createActionRow(rankData);

  return { embed, actionRow, totalPages };
}

// Create action row with buttons
function createActionRow(data: RankData): ActionRowBuilder<ButtonBuilder> {
  const row = new ActionRowBuilder<ButtonBuilder>();

  // Switch buttons
  const overviewButton = new ButtonBuilder()
    .setCustomId('switch_overview')
    .setLabel('Overview')
    .setStyle(
      data.view === 'overview' ? ButtonStyle.Primary : ButtonStyle.Secondary
    )
    .setEmoji('📊');

  const channelsButton = new ButtonBuilder()
    .setCustomId('switch_channels')
    .setLabel('Channels')
    .setStyle(
      data.view === 'channels' ? ButtonStyle.Primary : ButtonStyle.Secondary
    )
    .setEmoji('📺');

  // Add navigation buttons only for channels view
  if (data.view === 'channels') {
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

    row.addComponents(
      overviewButton,
      channelsButton,
      firstButton,
      prevButton,
      nextButton
    );
  } else {
    row.addComponents(overviewButton, channelsButton);
  }

  return row;
}

// Create disabled action row when collector ends
function createDisabledActionRow(
  data: RankData
): ActionRowBuilder<ButtonBuilder> {
  const row = new ActionRowBuilder<ButtonBuilder>();

  const buttons = [
    new ButtonBuilder()
      .setCustomId('switch_overview')
      .setLabel('Overview')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('📊')
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId('switch_channels')
      .setLabel('Channels')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('📺')
      .setDisabled(true),
  ];

  if (data.view === 'channels') {
    buttons.push(
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
        .setDisabled(true)
    );
  }

  row.addComponents(...buttons);
  return row;
}
