import { Client } from 'discord.js';
import { readdirSync } from 'fs';
import { join } from 'path';
import { Logger } from '../utils/logger';

export function setupCommandHandler(client: Client) {
  // Load all commands
  const loadCommands = () => {
    // Determine the correct path based on whether we're running from dist or src
    const isProduction = __filename.includes('dist');
    const commandsPath = isProduction
      ? join(__dirname, 'commands') // Use relative path for production (compiled)
      : join(__dirname, '../commands'); // Use __dirname for development

    const commandFolders = readdirSync(commandsPath);

    for (const folder of commandFolders) {
      const folderPath = join(commandsPath, folder);
      const commandFiles = readdirSync(folderPath).filter(file =>
        isProduction
          ? file.endsWith('.js')
          : file.endsWith('.js') || file.endsWith('.ts')
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
  };

  // Call loadCommands function
  loadCommands();

  // Slash Command Handler
  client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
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
