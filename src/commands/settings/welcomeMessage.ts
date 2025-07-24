import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  MessageFlags,
} from 'discord.js';
import { GuildSettings } from '../../models/settings/settings';
import { Logger } from '../../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('welcome-message')
  .setDescription('Set the welcome message for the server')
  .addStringOption(option =>
    option
      .setName('message')
      .setDescription(
        'The welcome message (use {member} to mention the member)'
      )
      .setRequired(true)
      .setMaxLength(1000)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction: ChatInputCommandInteraction) {
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

  const message = interaction.options.getString('message', true);

  try {
    // Get or create guild settings
    const guildSettings = await GuildSettings.findByGuildId(
      interaction.guild.id
    );

    // Update the welcome message
    await guildSettings.updateSetting('welcomeMessages.message', message);

    Logger.debug(
      'WelcomeMessage:',
      `Welcome message updated for Guild ${interaction.guild.id}`
    );

    await interaction.reply({
      content: `✅ **Welcome message successfully set!**\n\n**New message:** \`${message}\`\n\n*Note: Use {member} to mention the member. Welcome messages must be enabled in setup.*`,
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    Logger.error(
      'WelcomeMessage:',
      'Error setting welcome message',
      error as Error
    );
    await interaction.reply({
      content: '❌ An error occurred while setting the welcome message.',
      flags: MessageFlags.Ephemeral,
    });
  }
}
