import {
  SlashCommandBuilder,
  CommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  RoleSelectMenuBuilder,
  ChannelType,
  PermissionFlagsBits,
  ComponentType,
  StringSelectMenuInteraction,
  ButtonInteraction,
  ChannelSelectMenuInteraction,
  RoleSelectMenuInteraction,
  InteractionCollector,
  MessageFlags,
} from 'discord.js';
import {
  GuildSettings,
  IGuildSettingsDocument,
} from '../../models/settings/settings';
import { Logger } from '../../utils/logger';
import { Colors, getStatusColor, getFeatureColor } from '../../utils/colors';

export const data = new SlashCommandBuilder()
  .setName('setup')
  .setDescription('Interactive setup of all bot settings for this server')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

interface SetupSession {
  currentStep: number;
  guildSettings: IGuildSettingsDocument;
  interaction: CommandInteraction;
  collector?: InteractionCollector<any>;
}

const setupSteps = [
  {
    name: 'Overview',
    description: 'Welcome to the setup wizard',
  },
  {
    name: 'Audit Logging',
    description: 'Logging of server events',
  },
  {
    name: 'Welcome Messages',
    description: 'Greeting new members',
  },
  {
    name: 'Goodbye Messages',
    description: 'Farewell messages for members',
  },
  {
    name: 'Invite Tracking',
    description: 'Tracking server invitations',
  },
  {
    name: 'User Tracking',
    description: 'General user activity tracking',
  },
  {
    name: 'Leveling System',
    description: 'Experience points and levels for members',
  },
  {
    name: 'Moderation',
    description: 'Enable moderation tools',
  },
  {
    name: 'Auto Role',
    description: 'Automatic role assignment for new members',
  },
  {
    name: 'Birthday Messages',
    description: 'Birthday congratulations',
  },
  {
    name: 'Completion',
    description: 'Finish setup',
  },
];

export async function execute(interaction: CommandInteraction) {
  if (!interaction.guild) {
    await interaction.reply({
      content: '❌ This command can only be used in a server.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Check permissions
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    await interaction.reply({
      content:
        '❌ You need the "Manage Server" permission to use this command.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  try {
    const guildSettings = await GuildSettings.findOrCreateByGuildId(
      interaction.guild.id
    );

    const session: SetupSession = {
      currentStep: 0,
      guildSettings,
      interaction,
    };

    await showSetupStep(session);
  } catch (error) {
    Logger.error('Setup:', 'Error loading settings', error as Error);
    await interaction.reply({
      content: '❌ An error occurred while loading settings.',
      flags: MessageFlags.Ephemeral,
    });
  }
}

async function showSetupStep(session: SetupSession) {
  const { currentStep, guildSettings, interaction } = session;

  // Clean up previous collector
  if (session.collector) {
    session.collector.stop();
  }

  let embed: EmbedBuilder;
  let components: ActionRowBuilder<any>[] = [];

  switch (currentStep) {
    case 0:
      embed = createOverviewEmbed();
      components = createOverviewComponents();
      break;
    case 1:
      embed = await createAuditLoggingEmbed(guildSettings);
      components = await createAuditLoggingComponents(guildSettings);
      break;
    case 2:
      embed = await createWelcomeMessagesEmbed(guildSettings);
      components = await createWelcomeMessagesComponents(guildSettings);
      break;
    case 3:
      embed = await createGoodbyeMessagesEmbed(guildSettings);
      components = await createGoodbyeMessagesComponents(guildSettings);
      break;
    case 4:
      embed = await createInviteTrackingEmbed(guildSettings);
      components = await createInviteTrackingComponents(guildSettings);
      break;
    case 5:
      embed = await createUserTrackingEmbed(guildSettings);
      components = await createUserTrackingComponents(guildSettings);
      break;
    case 6:
      embed = await createLevelingEmbed(guildSettings);
      components = await createLevelingComponents(guildSettings);
      break;
    case 7:
      embed = await createModerationEmbed(guildSettings);
      components = await createModerationComponents(guildSettings);
      break;
    case 8:
      embed = await createAutoRoleEmbed(guildSettings);
      components = await createAutoRoleComponents(guildSettings);
      break;
    case 9:
      embed = await createBirthdayMessagesEmbed(guildSettings);
      components = await createBirthdayMessagesComponents(guildSettings);
      break;
    case 10:
      embed = createCompletionEmbed();
      components = createCompletionComponents();
      break;
    default:
      return;
  }

  // Add navigation buttons
  components.push(createNavigationButtons(currentStep));

  try {
    if (interaction.replied || interaction.deferred) {
      await interaction.editReply({
        embeds: [embed],
        components,
      });
    } else {
      await interaction.reply({
        embeds: [embed],
        components,
      });
    }

    // Set up collector for this step
    const filter = (i: any) => i.user.id === interaction.user.id;

    // Get the response message to create collector on
    const response = await interaction.fetchReply();
    session.collector = response.createMessageComponentCollector({
      filter,
      time: 300000, // 5 minutes
    });

    session.collector?.on('collect', async i => {
      await handleInteraction(session, i);
    });

    session.collector?.on('end', async (collected, reason) => {
      if (reason === 'time') {
        try {
          Logger.debug('Setup:', 'Setup session expired');
          await interaction.editReply({
            content: '⏱️ Setup session expired. Please restart the setup.',
            embeds: [],
            components: [],
          });
        } catch (error) {
          // Ignore errors when editing expired interactions
        }
      }
    });
  } catch (error) {
    Logger.error('Setup:', 'Error displaying setup step', error as Error);
  }
}

async function handleInteraction(session: SetupSession, interaction: any) {
  if (
    !interaction.isButton() &&
    !interaction.isStringSelectMenu() &&
    !interaction.isChannelSelectMenu() &&
    !interaction.isRoleSelectMenu()
  ) {
    return;
  }

  try {
    if (interaction.customId === 'next_step') {
      await interaction.deferUpdate();
      session.currentStep++;
      await showSetupStep(session);
    } else if (interaction.customId === 'prev_step') {
      await interaction.deferUpdate();
      session.currentStep--;
      await showSetupStep(session);
    } else if (interaction.customId === 'finish_setup') {
      await interaction.deferUpdate();
      await finishSetup(session);
    } else {
      // Handle specific setting updates
      await interaction.deferUpdate();
      await handleSettingUpdate(session, interaction);
    }
  } catch (error) {
    Logger.error('Setup:', 'Error processing interaction', error as Error);
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: '❌ An error occurred. Please try again.',
          flags: MessageFlags.Ephemeral,
        });
      } else {
        await interaction.followUp({
          content: '❌ An error occurred. Please try again.',
          flags: MessageFlags.Ephemeral,
        });
      }
    } catch (followUpError) {
      // Ignore follow-up errors
    }
  }
}

async function handleSettingUpdate(session: SetupSession, interaction: any) {
  const { guildSettings } = session;
  const customId = interaction.customId;

  switch (customId) {
    // Audit Logging
    case 'audit_logging_toggle':
      const auditEnabled = interaction.values[0] === 'enabled';
      await guildSettings.updateSetting('auditLogging.enabled', auditEnabled);
      break;
    case 'audit_logging_channel':
      const auditChannel = interaction.values[0];
      await guildSettings.updateSetting('auditLogging.channel', auditChannel);
      break;
    case 'audit_logging_modules':
      const modules = interaction.values;
      const auditModules =
        guildSettings.getSetting('auditLogging.modules') || {};

      // Reset all modules to false
      Object.keys(auditModules).forEach(key => {
        auditModules[key] = false;
      });

      // Set selected modules to true
      modules.forEach((module: string) => {
        auditModules[module] = true;
      });

      await guildSettings.updateSetting('auditLogging.modules', auditModules);
      break;

    // Welcome Messages
    case 'welcome_toggle':
      const welcomeEnabled = interaction.values[0] === 'enabled';
      await guildSettings.updateSetting(
        'welcomeMessages.enabled',
        welcomeEnabled
      );
      break;
    case 'welcome_channel':
      const welcomeChannel = interaction.values[0];
      await guildSettings.updateSetting(
        'welcomeMessages.channel',
        welcomeChannel
      );
      break;

    // Goodbye Messages
    case 'goodbye_toggle':
      const goodbyeEnabled = interaction.values[0] === 'enabled';
      await guildSettings.updateSetting(
        'goodbyeMessages.enabled',
        goodbyeEnabled
      );
      break;
    case 'goodbye_channel':
      const goodbyeChannel = interaction.values[0];
      await guildSettings.updateSetting(
        'goodbyeMessages.channel',
        goodbyeChannel
      );
      break;

    // Invite Tracking
    case 'invite_tracking_toggle':
      const inviteEnabled = interaction.values[0] === 'enabled';
      await guildSettings.updateSetting(
        'inviteTracking.enabled',
        inviteEnabled
      );
      break;
    case 'invite_tracking_channel':
      const inviteChannel = interaction.values[0];
      await guildSettings.updateSetting(
        'inviteTracking.channel',
        inviteChannel
      );
      break;

    // User Tracking
    case 'user_tracking_toggle':
      const userTrackingEnabled = interaction.values[0] === 'enabled';
      await guildSettings.updateSetting(
        'userTracking.enabled',
        userTrackingEnabled
      );
      break;

    // Leveling
    case 'leveling_toggle':
      const levelingEnabled = interaction.values[0] === 'enabled';
      await guildSettings.updateSetting('leveling.enabled', levelingEnabled);
      break;
    case 'leveling_messages_toggle':
      const levelingMessages = interaction.values[0] === 'enabled';
      await guildSettings.updateSetting('leveling.messages', levelingMessages);
      break;
    case 'leveling_channel':
      const levelingChannel = interaction.values[0];
      await guildSettings.updateSetting('leveling.channel', levelingChannel);
      break;

    // Moderation
    case 'moderation_toggle':
      const moderationEnabled = interaction.values[0] === 'enabled';
      await guildSettings.updateSetting(
        'moderation.enabled',
        moderationEnabled
      );
      break;

    // Auto Role
    case 'auto_role_toggle':
      const autoRoleEnabled = interaction.values[0] === 'enabled';
      await guildSettings.updateSetting('autoRole.enabled', autoRoleEnabled);
      break;
    case 'auto_role_select':
      const autoRole = interaction.values[0];
      await guildSettings.updateSetting('autoRole.role', autoRole);
      break;

    // Birthday Messages
    case 'birthday_toggle':
      const birthdayEnabled = interaction.values[0] === 'enabled';
      await guildSettings.updateSetting(
        'birthdayMessages.enabled',
        birthdayEnabled
      );
      break;
    case 'birthday_channel':
      const birthdayChannel = interaction.values[0];
      await guildSettings.updateSetting(
        'birthdayMessages.channel',
        birthdayChannel
      );
      break;
  }

  // Refresh the current step
  await showSetupStep(session);
}

// Embed Creation Functions
function createOverviewEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('🛠️ Bot Setup - Welcome!')
    .setDescription(
      'Welcome to the interactive setup wizard!\n\n' +
        'This wizard will guide you through all available bot settings:\n\n' +
        '🔍 **Audit Logging** - Log server events\n' +
        '👋 **Welcome Messages** - Greet new members\n' +
        '👋 **Goodbye Messages** - Farewell messages\n' +
        '🔗 **Invite Tracking** - Track invitations\n' +
        '👤 **User Tracking** - Track user activities\n' +
        '⭐ **Leveling System** - Experience points and levels\n' +
        '🛡️ **Moderation** - Moderation tools\n' +
        '🎭 **Auto Role** - Automatic role assignment\n' +
        '🎂 **Birthday Messages** - Birthday celebrations\n\n' +
        'Click "Next" to begin!'
    )
    .setColor(Colors.PRIMARY)
    .setFooter({ text: 'Step 1 of 11' });
}

function createOverviewComponents(): ActionRowBuilder<any>[] {
  return [];
}

async function createAuditLoggingEmbed(
  guildSettings: IGuildSettingsDocument
): Promise<EmbedBuilder> {
  const auditLogging = guildSettings.getSetting('auditLogging') || {};
  const enabled = auditLogging.enabled || false;
  const channel = auditLogging.channel;
  const modules = auditLogging.modules || {};

  const enabledModules = Object.keys(modules).filter(key => modules[key]);

  return new EmbedBuilder()
    .setTitle('🔍 Audit Logging Settings')
    .setDescription(
      'Audit logging records important server events.\n\n' +
        `**Status:** ${enabled ? '✅ Enabled' : '❌ Disabled'}\n` +
        `**Channel:** ${channel ? `<#${channel}>` : 'Not set'}\n` +
        `**Active Modules:** ${enabledModules.length > 0 ? enabledModules.join(', ') : 'None'}`
    )
    .setColor(getStatusColor(enabled))
    .setFooter({ text: 'Step 2 of 11' });
}

async function createAuditLoggingComponents(
  guildSettings: IGuildSettingsDocument
): Promise<ActionRowBuilder<any>[]> {
  const auditLogging = guildSettings.getSetting('auditLogging') || {};
  const enabled = auditLogging.enabled || false;
  const modules = auditLogging.modules || {};

  const components: ActionRowBuilder<any>[] = [];

  // Enable/Disable Toggle
  const toggleRow =
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('audit_logging_toggle')
        .setPlaceholder('Enable/disable audit logging')
        .addOptions([
          {
            label: 'Enabled',
            value: 'enabled',
            description: 'Enable audit logging',
            default: enabled,
          },
          {
            label: 'Disabled',
            value: 'disabled',
            description: 'Disable audit logging',
            default: !enabled,
          },
        ])
    );

  components.push(toggleRow);

  if (enabled) {
    // Channel Selection
    const channelRow =
      new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId('audit_logging_channel')
          .setPlaceholder('Select audit logging channel')
          .setChannelTypes(ChannelType.GuildText)
      );

    components.push(channelRow);

    // Module Selection
    const moduleOptions = [
      {
        label: 'Messages deleted',
        value: 'messageDelete',
        description: 'Log deleted messages',
      },
      {
        label: 'Messages edited',
        value: 'messageUpdate',
        description: 'Log edited messages',
      },
      {
        label: 'Member banned',
        value: 'memberBan',
        description: 'Log banned members',
      },
      {
        label: 'Member unbanned',
        value: 'memberUnban',
        description: 'Log unbanned members',
      },
      {
        label: 'Member kicked',
        value: 'memberKick',
        description: 'Log kicked members',
      },
      {
        label: 'Channel created',
        value: 'channelCreate',
        description: 'Log new channels',
      },
      {
        label: 'Channel deleted',
        value: 'channelDelete',
        description: 'Log deleted channels',
      },
      {
        label: 'Channel edited',
        value: 'channelUpdate',
        description: 'Log edited channels',
      },
      {
        label: 'Role created',
        value: 'roleCreate',
        description: 'Log new roles',
      },
      {
        label: 'Role deleted',
        value: 'roleDelete',
        description: 'Log deleted roles',
      },
      {
        label: 'Role edited',
        value: 'roleUpdate',
        description: 'Log edited roles',
      },
    ];

    const moduleRow =
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('audit_logging_modules')
          .setPlaceholder('Select modules (multiple possible)')
          .setMinValues(0)
          .setMaxValues(moduleOptions.length)
          .addOptions(
            moduleOptions.map(option => ({
              ...option,
              default: modules[option.value] || false,
            }))
          )
      );

    components.push(moduleRow);
  }

  return components;
}

async function createWelcomeMessagesEmbed(
  guildSettings: IGuildSettingsDocument
): Promise<EmbedBuilder> {
  const welcomeMessages = guildSettings.getSetting('welcomeMessages') || {};
  const enabled = welcomeMessages.enabled || false;
  const channel = welcomeMessages.channel;
  const message = welcomeMessages.message || 'Welcome {member} to the server!';

  return new EmbedBuilder()
    .setTitle('👋 Welcome Messages')
    .setDescription(
      'Automatically greet new members with a message.\n\n' +
        `**Status:** ${enabled ? '✅ Enabled' : '❌ Disabled'}\n` +
        `**Channel:** ${channel ? `<#${channel}>` : 'Not set'}\n` +
        `**Message:** \`${message}\`\n\n` +
        '*Run /welcome-message to configure the welcome message.*'
    )
    .setColor(getStatusColor(enabled))
    .setFooter({ text: 'Step 3 of 11' });
}

async function createWelcomeMessagesComponents(
  guildSettings: IGuildSettingsDocument
): Promise<ActionRowBuilder<any>[]> {
  const welcomeMessages = guildSettings.getSetting('welcomeMessages') || {};
  const enabled = welcomeMessages.enabled || false;

  const components: ActionRowBuilder<any>[] = [];

  // Enable/Disable Toggle
  const toggleRow =
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('welcome_toggle')
        .setPlaceholder('Enable/disable welcome messages')
        .addOptions([
          {
            label: 'Enabled',
            value: 'enabled',
            description: 'Enable welcome messages',
            default: enabled,
          },
          {
            label: 'Disabled',
            value: 'disabled',
            description: 'Disable welcome messages',
            default: !enabled,
          },
        ])
    );

  components.push(toggleRow);

  if (enabled) {
    // Channel Selection
    const channelRow =
      new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId('welcome_channel')
          .setPlaceholder('Select channel for welcome messages')
          .setChannelTypes(ChannelType.GuildText)
      );

    components.push(channelRow);
  }

  return components;
}

async function createGoodbyeMessagesEmbed(
  guildSettings: IGuildSettingsDocument
): Promise<EmbedBuilder> {
  const goodbyeMessages = guildSettings.getSetting('goodbyeMessages') || {};
  const enabled = goodbyeMessages.enabled || false;
  const channel = goodbyeMessages.channel;
  const message =
    goodbyeMessages.message || 'Goodbye {member}, we will miss you!';

  return new EmbedBuilder()
    .setTitle('👋 Goodbye Messages')
    .setDescription(
      'Automatically say goodbye to members when they leave the server.\n\n' +
        `**Status:** ${enabled ? '✅ Enabled' : '❌ Disabled'}\n` +
        `**Channel:** ${channel ? `<#${channel}>` : 'Not set'}\n` +
        `**Message:** \`${message}\`\n\n` +
        '*Run /goodbye-message to configure the goodbye message.*'
    )
    .setColor(getStatusColor(enabled))
    .setFooter({ text: 'Step 4 of 11' });
}

async function createGoodbyeMessagesComponents(
  guildSettings: IGuildSettingsDocument
): Promise<ActionRowBuilder<any>[]> {
  const goodbyeMessages = guildSettings.getSetting('goodbyeMessages') || {};
  const enabled = goodbyeMessages.enabled || false;

  const components: ActionRowBuilder<any>[] = [];

  // Enable/Disable Toggle
  const toggleRow =
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('goodbye_toggle')
        .setPlaceholder('Enable/disable goodbye messages')
        .addOptions([
          {
            label: 'Enabled',
            value: 'enabled',
            description: 'Enable goodbye messages',
            default: enabled,
          },
          {
            label: 'Disabled',
            value: 'disabled',
            description: 'Disable goodbye messages',
            default: !enabled,
          },
        ])
    );

  components.push(toggleRow);

  if (enabled) {
    // Channel Selection
    const channelRow =
      new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId('goodbye_channel')
          .setPlaceholder('Select channel for goodbye messages')
          .setChannelTypes(ChannelType.GuildText)
      );

    components.push(channelRow);
  }

  return components;
}

async function createInviteTrackingEmbed(
  guildSettings: IGuildSettingsDocument
): Promise<EmbedBuilder> {
  const inviteTracking = guildSettings.getSetting('inviteTracking') || {};
  const enabled = inviteTracking.enabled || false;
  const channel = inviteTracking.channel;

  return new EmbedBuilder()
    .setTitle('🔗 Invite Tracking')
    .setDescription(
      'Track who brought new members through invitations.\n\n' +
        `**Status:** ${enabled ? '✅ Enabled' : '❌ Disabled'}\n` +
        `**Channel:** ${channel ? `<#${channel}>` : 'Not set'}`
    )
    .setColor(getStatusColor(enabled))
    .setFooter({ text: 'Step 5 of 11' });
}

async function createInviteTrackingComponents(
  guildSettings: IGuildSettingsDocument
): Promise<ActionRowBuilder<any>[]> {
  const inviteTracking = guildSettings.getSetting('inviteTracking') || {};
  const enabled = inviteTracking.enabled || false;

  const components: ActionRowBuilder<any>[] = [];

  // Enable/Disable Toggle
  const toggleRow =
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('invite_tracking_toggle')
        .setPlaceholder('Enable/disable invite tracking')
        .addOptions([
          {
            label: 'Enabled',
            value: 'enabled',
            description: 'Enable invite tracking',
            default: enabled,
          },
          {
            label: 'Disabled',
            value: 'disabled',
            description: 'Disable invite tracking',
            default: !enabled,
          },
        ])
    );

  components.push(toggleRow);

  if (enabled) {
    // Channel Selection
    const channelRow =
      new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId('invite_tracking_channel')
          .setPlaceholder('Select channel for invite tracking')
          .setChannelTypes(ChannelType.GuildText)
      );

    components.push(channelRow);
  }

  return components;
}

async function createUserTrackingEmbed(
  guildSettings: IGuildSettingsDocument
): Promise<EmbedBuilder> {
  const userTracking = guildSettings.getSetting('userTracking') || {};
  const enabled = userTracking.enabled || false;

  return new EmbedBuilder()
    .setTitle('👤 User Tracking')
    .setDescription(
      'General tracking of user activities and statistics.\n\n' +
        `**Status:** ${enabled ? '✅ Enabled' : '❌ Disabled'}`
    )
    .setColor(getStatusColor(enabled))
    .setFooter({ text: 'Step 6 of 11' });
}

async function createUserTrackingComponents(
  guildSettings: IGuildSettingsDocument
): Promise<ActionRowBuilder<any>[]> {
  const userTracking = guildSettings.getSetting('userTracking') || {};
  const enabled = userTracking.enabled || false;

  const components: ActionRowBuilder<any>[] = [];

  // Enable/Disable Toggle
  const toggleRow =
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('user_tracking_toggle')
        .setPlaceholder('Enable/disable user tracking')
        .addOptions([
          {
            label: 'Enabled',
            value: 'enabled',
            description: 'Enable user tracking',
            default: enabled,
          },
          {
            label: 'Disabled',
            value: 'disabled',
            description: 'Disable user tracking',
            default: !enabled,
          },
        ])
    );

  components.push(toggleRow);

  return components;
}

async function createLevelingEmbed(
  guildSettings: IGuildSettingsDocument
): Promise<EmbedBuilder> {
  const leveling = guildSettings.getSetting('leveling') || {};
  const enabled = leveling.enabled || false;
  const messages = leveling.messages || false;
  const channel = leveling.channel;

  return new EmbedBuilder()
    .setTitle('⭐ Leveling System')
    .setDescription(
      'Reward active members with experience points and levels.\n\n' +
        `**Status:** ${enabled ? '✅ Enabled' : '❌ Disabled'}\n` +
        `**Level-up Messages:** ${messages ? '✅ Enabled' : '❌ Disabled'}\n` +
        `**Channel:** ${channel ? `<#${channel}>` : 'Current channel'}`
    )
    .setColor(getStatusColor(enabled))
    .setFooter({ text: 'Step 7 of 11' });
}

async function createLevelingComponents(
  guildSettings: IGuildSettingsDocument
): Promise<ActionRowBuilder<any>[]> {
  const leveling = guildSettings.getSetting('leveling') || {};
  const enabled = leveling.enabled || false;
  const messages = leveling.messages || false;

  const components: ActionRowBuilder<any>[] = [];

  // Enable/Disable Toggle
  const toggleRow =
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('leveling_toggle')
        .setPlaceholder('Enable/disable leveling system')
        .addOptions([
          {
            label: 'Enabled',
            value: 'enabled',
            description: 'Enable leveling system',
            default: enabled,
          },
          {
            label: 'Disabled',
            value: 'disabled',
            description: 'Disable leveling system',
            default: !enabled,
          },
        ])
    );

  components.push(toggleRow);

  if (enabled) {
    // Messages Toggle
    const messagesRow =
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('leveling_messages_toggle')
          .setPlaceholder('Enable/disable level-up messages')
          .addOptions([
            {
              label: 'Enabled',
              value: 'enabled',
              description: 'Send level-up messages',
              default: messages,
            },
            {
              label: 'Disabled',
              value: 'disabled',
              description: "Don't send level-up messages",
              default: !messages,
            },
          ])
      );

    components.push(messagesRow);

    if (messages) {
      // Channel Selection
      const channelRow =
        new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
          new ChannelSelectMenuBuilder()
            .setCustomId('leveling_channel')
            .setPlaceholder('Channel for level-up messages (optional)')
            .setChannelTypes(ChannelType.GuildText)
        );

      components.push(channelRow);
    }
  }

  return components;
}

async function createModerationEmbed(
  guildSettings: IGuildSettingsDocument
): Promise<EmbedBuilder> {
  const moderation = guildSettings.getSetting('moderation') || {};
  const enabled = moderation.enabled || false;

  return new EmbedBuilder()
    .setTitle('🛡️ Moderation')
    .setDescription(
      'Enable advanced moderation tools for your server.\n\n' +
        `**Status:** ${enabled ? '✅ Enabled' : '❌ Disabled'}`
    )
    .setColor(getStatusColor(enabled))
    .setFooter({ text: 'Step 8 of 11' });
}

async function createModerationComponents(
  guildSettings: IGuildSettingsDocument
): Promise<ActionRowBuilder<any>[]> {
  const moderation = guildSettings.getSetting('moderation') || {};
  const enabled = moderation.enabled || false;

  const components: ActionRowBuilder<any>[] = [];

  // Enable/Disable Toggle
  const toggleRow =
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('moderation_toggle')
        .setPlaceholder('Enable/disable moderation')
        .addOptions([
          {
            label: 'Enabled',
            value: 'enabled',
            description: 'Enable moderation tools',
            default: enabled,
          },
          {
            label: 'Disabled',
            value: 'disabled',
            description: 'Disable moderation tools',
            default: !enabled,
          },
        ])
    );

  components.push(toggleRow);

  return components;
}

async function createAutoRoleEmbed(
  guildSettings: IGuildSettingsDocument
): Promise<EmbedBuilder> {
  const autoRole = guildSettings.getSetting('autoRole') || {};
  const enabled = autoRole.enabled || false;
  const role = autoRole.role;

  return new EmbedBuilder()
    .setTitle('🎭 Auto Role')
    .setDescription(
      'Automatically assign a role to new members.\n\n' +
        `**Status:** ${enabled ? '✅ Enabled' : '❌ Disabled'}\n` +
        `**Role:** ${role ? `<@&${role}>` : 'Not set'}`
    )
    .setColor(getStatusColor(enabled))
    .setFooter({ text: 'Step 9 of 11' });
}

async function createAutoRoleComponents(
  guildSettings: IGuildSettingsDocument
): Promise<ActionRowBuilder<any>[]> {
  const autoRole = guildSettings.getSetting('autoRole') || {};
  const enabled = autoRole.enabled || false;

  const components: ActionRowBuilder<any>[] = [];

  // Enable/Disable Toggle
  const toggleRow =
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('auto_role_toggle')
        .setPlaceholder('Enable/disable auto role')
        .addOptions([
          {
            label: 'Enabled',
            value: 'enabled',
            description: 'Enable auto role',
            default: enabled,
          },
          {
            label: 'Disabled',
            value: 'disabled',
            description: 'Disable auto role',
            default: !enabled,
          },
        ])
    );

  components.push(toggleRow);

  if (enabled) {
    // Role Selection
    const roleRow = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
      new RoleSelectMenuBuilder()
        .setCustomId('auto_role_select')
        .setPlaceholder('Select role for new members')
    );

    components.push(roleRow);
  }

  return components;
}

async function createBirthdayMessagesEmbed(
  guildSettings: IGuildSettingsDocument
): Promise<EmbedBuilder> {
  const birthdayMessages = guildSettings.getSetting('birthdayMessages') || {};
  const enabled = birthdayMessages.enabled || false;
  const channel = birthdayMessages.channel;

  return new EmbedBuilder()
    .setTitle('🎂 Birthday Messages')
    .setDescription(
      'Automatically congratulate members on their birthday.\n\n' +
        `**Status:** ${enabled ? '✅ Enabled' : '❌ Disabled'}\n` +
        `**Channel:** ${channel ? `<#${channel}>` : 'Not set'}`
    )
    .setColor(getStatusColor(enabled))
    .setFooter({ text: 'Step 10 of 11' });
}

async function createBirthdayMessagesComponents(
  guildSettings: IGuildSettingsDocument
): Promise<ActionRowBuilder<any>[]> {
  const birthdayMessages = guildSettings.getSetting('birthdayMessages') || {};
  const enabled = birthdayMessages.enabled || false;

  const components: ActionRowBuilder<any>[] = [];

  // Enable/Disable Toggle
  const toggleRow =
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('birthday_toggle')
        .setPlaceholder('Enable/disable birthday messages')
        .addOptions([
          {
            label: 'Enabled',
            value: 'enabled',
            description: 'Enable birthday messages',
            default: enabled,
          },
          {
            label: 'Disabled',
            value: 'disabled',
            description: 'Disable birthday messages',
            default: !enabled,
          },
        ])
    );

  components.push(toggleRow);

  if (enabled) {
    // Channel Selection
    const channelRow =
      new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId('birthday_channel')
          .setPlaceholder('Select channel for birthday messages')
          .setChannelTypes(ChannelType.GuildText)
      );

    components.push(channelRow);
  }

  return components;
}

function createCompletionEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('🎉 Setup Complete!')
    .setDescription(
      'Congratulations! You have successfully configured all bot settings.\n\n' +
        '**What happens now?**\n' +
        '✅ All your settings have been saved\n' +
        '✅ The bot is now configured accordingly\n' +
        '✅ You can change individual settings anytime using other commands\n\n' +
        'Thank you for taking the time to set up the bot! 🚀'
    )
    .setColor(Colors.SUCCESS)
    .setFooter({ text: 'Setup complete!' });
}

function createCompletionComponents(): ActionRowBuilder<any>[] {
  return [];
}

function createNavigationButtons(
  currentStep: number
): ActionRowBuilder<ButtonBuilder> {
  const row = new ActionRowBuilder<ButtonBuilder>();

  if (currentStep > 0) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId('prev_step')
        .setLabel('Back')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('⬅️')
    );
  }

  if (currentStep < setupSteps.length - 1) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId('next_step')
        .setLabel('Next')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('➡️')
    );
  }

  if (currentStep === setupSteps.length - 1) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId('finish_setup')
        .setLabel('Finish Setup')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✅')
    );
  }

  return row;
}

async function finishSetup(session: SetupSession) {
  try {
    await session.interaction.editReply({
      content:
        '✅ **Setup successfully completed!** All your settings have been saved.',
      embeds: [],
      components: [],
    });

    if (session.collector) {
      session.collector.stop();
    }
  } catch (error) {
    Logger.error('Setup:', 'Error finishing setup', error as Error);
  }
}
