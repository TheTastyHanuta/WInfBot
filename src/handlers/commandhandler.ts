import { Client } from 'discord.js';
import { readdirSync } from 'fs';
import { join } from 'path';

export function setupCommandHandler(client: Client) {
  // Load all commands
  const loadCommands = () => {
    const commandFolders = readdirSync(join(__dirname, '../commands'));

    for (const folder of commandFolders) {
      const commandFiles = readdirSync(
        join(__dirname, '../commands', folder)
      ).filter(file => file.endsWith('.js') || file.endsWith('.ts'));

      for (const file of commandFiles) {
        const command = require(join(__dirname, '../commands', folder, file));
        if (command.data && command.execute) {
          client.commands.set(command.data.name, command);
          console.log(`Command loaded: ${command.data.name}`);
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
      console.error(
        `Error executing command ${interaction.commandName}:`,
        error
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
