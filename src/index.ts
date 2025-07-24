import {
  Client,
  GatewayIntentBits,
  Collection,
  Partials,
  ActivityType,
} from 'discord.js';
import { config } from 'dotenv';
import mongoose from 'mongoose';
import { setupCommandHandler } from './handlers/commandhandler';
import { setupEventHandler } from './handlers/eventhandler';
import { Logger } from './utils/logger';

config();

// Environment configuration
const isDevelopment = process.env.NODE_ENV === 'development';
const botToken = isDevelopment
  ? process.env.TEST_BOT_TOKEN
  : process.env.BOT_TOKEN;
const mongoUri = isDevelopment
  ? process.env.TEST_MONGO_DB_URI
  : process.env.MONGO_DB_URI || 'mongodb://localhost:27017/winfbot';

declare module 'discord.js' {
  export interface Client {
    commands: Collection<string, any>;
  }
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildIntegrations,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildScheduledEvents,
    GatewayIntentBits.GuildWebhooks,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessageTyping,
  ],
  partials: [
    Partials.Channel,
    Partials.GuildMember,
    Partials.Message,
    Partials.Reaction,
    Partials.User,
    Partials.ThreadMember,
  ],
});

// Initialise the commands collection
client.commands = new Collection();

// Bot Ready Event
client.once('ready', async () => {
  const environment = isDevelopment ? 'DEVELOPMENT' : 'PRODUCTION';
  Logger.system(`${client.user?.tag} is online! (${environment})`);

  // Connect to MongoDB
  try {
    if (!mongoUri) {
      throw new Error('MongoDB URI not configured');
    }
    await mongoose.connect(mongoUri);
    Logger.info('DATABASE', `MongoDB connected successfully! (${environment})`);
  } catch (error) {
    Logger.error('DATABASE', 'MongoDB connection error', error as Error);
  }

  // Setup handlers
  setupCommandHandler(client);
  setupEventHandler(client);

  // Log bot statistics
  Logger.info(
    'BOT',
    `Bot statistics: ${client.guilds.cache.size} guilds, ${client.users.cache.size} users, ${client.channels.cache.size} channels`
  );
  Logger.info(
    'BOT',
    `Bot started in ${Date.now() - client.readyTimestamp!}ms (${environment})`
  );
  Logger.info(
    'BOT',
    `Bot version: ${process.env.npm_package_version} (${environment})`
  );
  const buildDate = new Date(process.env.npm_package_time_build || Date.now());
  Logger.info(
    'BOT',
    `Build date: ${buildDate.toLocaleString('de-DE', {
      timeZone: 'Europe/Berlin',
    })}`
  );

  // Display watching status
  const totalGuilds = client.guilds.cache.size;
  const totalUsers = client.users.cache.size;
  const totalChannels = client.channels.cache.size;
  /*client.user?.setActivity(
    `in ${totalGuilds} guilds, ${totalUsers} users, ${totalChannels} channels`,
    { type: ActivityType.Watching }
  );*/
  client.user?.setActivity(`Roblox tax fraud`, { type: ActivityType.Playing });
});

// Bot Login
if (!botToken) {
  Logger.error('BOT', 'Bot Token not configured');
  process.exit(1);
}
client.login(botToken);
