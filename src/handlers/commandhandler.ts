import { Client } from 'discord.js';
import { readdirSync } from 'fs';
import { join } from 'path';
import { Logger } from '../utils/logger';

export function setupCommandHandler(client: Client) {
  // Load all commands
  const loadCommands = () => {
    // This file lives at <root>/handlers both when running from src via tsx
    // and when running the compiled output from dist, so the commands are one
    // level up in either case.
    const commandsPath = join(__dirname, '../commands');

    const commandFolders = readdirSync(commandsPath);

    for (const folder of commandFolders) {
      const folderPath = join(commandsPath, folder);
      const commandFiles = readdirSync(folderPath).filter(
        file => file.endsWith('.js') || file.endsWith('.ts')
      );

      for (const file of commandFiles) {
        const command = require(join(folderPath, file));
        if (command.data && command.execute) {
          client.commands.set(command.data.name, command);
          Logger.debug(
            'COMMAND_LOADER',
            `Command loaded: ${command.data.name}`
          );
        }
      }
    }
    Logger.info('COMMAND_LOADER', `Loaded ${client.commands.size} commands`);
  };

  // Call loadCommands function
  loadCommands();

  // Slash Command Handler
  client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      Logger.command(
        interaction.commandName,
        interaction.user.tag,
        interaction.guild?.name ? interaction.guild.name : undefined
      );
      await command.execute(interaction);
    } catch (error) {
      Logger.error(
        'COMMAND_HANDLER',
        `Error executing command ${interaction.commandName}`,
        error as Error
      );

      const errorMessage = {
        content: 'There was an error executing this command!',
        ephemeral: true,
      };

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage);
      } else {
        await interaction.reply(errorMessage);
      }
    }
  });
}
