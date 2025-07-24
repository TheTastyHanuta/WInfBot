import { REST, Routes } from 'discord.js';
import { config } from 'dotenv';
import { readdirSync } from 'fs';
import { join } from 'path';
import { Logger } from './utils/logger';

config();

// Environment configuration
const isDevelopment = process.env.NODE_ENV === 'development';
const botToken = isDevelopment ? process.env.TEST_BOT_TOKEN : process.env.BOT_TOKEN;
const clientId = isDevelopment ? process.env.TEST_BOT_CLIENT_ID : process.env.CLIENT_ID;

const commands = [];

const commandFolders = readdirSync(join(__dirname, 'commands'));

for (const folder of commandFolders) {
  const commandFiles = readdirSync(join(__dirname, 'commands', folder)).filter(
    file => file.endsWith('.js') || file.endsWith('.ts')
  );

  for (const file of commandFiles) {
    const command = require(join(__dirname, 'commands', folder, file));
    if (command.data) {
      commands.push(command.data.toJSON());
      Logger.debug('DEPLOY', `Command registered: ${command.data.name}`);
    }
  }
}

const rest = new REST().setToken(botToken!);

(async () => {
  try {
    const environment = isDevelopment ? 'DEVELOPMENT' : 'PRODUCTION';
    Logger.info('DEPLOY', `Register ${commands.length} Slash Commands... (${environment})`);

    const data = (await rest.put(
      Routes.applicationCommands(clientId!),
      { body: commands }
    )) as any[];

    Logger.info(
      'DEPLOY',
      `Successfully registered ${data.length} Slash Commands! (${environment})`
    );
  } catch (error) {
    Logger.error(
      'DEPLOY',
      'Error registering commands',
      error as Error
    );
  }
})();
