import { Client, GatewayIntentBits, Collection, Partials } from 'discord.js';
import { config } from 'dotenv';
import mongoose from 'mongoose';
import { setupCommandHandler } from './handlers/commandhandler';
import { setupEventHandler } from './handlers/eventhandler';
import { Logger } from './utils/logger';

config();

// Environment configuration
const isDevelopment = process.env.NODE_ENV === 'development';
const botToken = isDevelopment ? process.env.TEST_BOT_TOKEN : process.env.BOT_TOKEN;
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
});

// Bot Login
if (!botToken) {
  Logger.error('BOT', 'Bot Token not configured');
  process.exit(1);
}
client.login(botToken);
