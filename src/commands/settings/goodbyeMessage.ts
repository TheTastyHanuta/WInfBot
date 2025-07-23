import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  MessageFlags,
} from 'discord.js';
import { GuildSettings } from '../../models/settings/settings';
import { Logger } from '../../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('goodbye-message')
  .setDescription('Set the goodbye message for the server')
  .addStringOption(option =>
    option
      .setName('message')
      .setDescription(
        'The goodbye message (use {member} to mention the member)'
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
    const guildSettings = await GuildSettings.findOrCreateByGuildId(
      interaction.guild.id
    );

    // Update the goodbye message
    await guildSettings.updateSetting('goodbyeMessages.message', message);

    Logger.debug(
      'GoodbyeMessage:',
      `Goodbye message updated for Guild ${interaction.guild.id}`
    );

    await interaction.reply({
      content: `✅ **Goodbye message successfully set!**\n\n**New message:** \`${message}\`\n\n*Note: Use {member} to mention the member. Goodbye messages must be enabled in setup.*`,
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    Logger.error(
      'GoodbyeMessage:',
      'Error setting goodbye message',
      error as Error
    );
    await interaction.reply({
      content: '❌ An error occurred while setting the goodbye message.',
      flags: MessageFlags.Ephemeral,
    });
  }
}
