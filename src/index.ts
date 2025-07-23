import { Client, GatewayIntentBits, Collection, Partials } from 'discord.js';
import { config } from 'dotenv';
import mongoose from 'mongoose';
import { setupCommandHandler } from './handlers/commandhandler';
import { setupEventHandler } from './handlers/eventhandler';
import { Logger } from './utils/logger';

config();

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
  Logger.system(`${client.user?.tag} ist online!`);

  // Connect to MongoDB
  try {
    await mongoose.connect(
      process.env.MONGO_DB_URI || 'mongodb://localhost:27017/winfbot'
    );
    Logger.info('DATABASE', 'MongoDB connected successfully!');
  } catch (error) {
    Logger.error('DATABASE', 'MongoDB connection error', error as Error);
  }

  // Setup handlers
  setupCommandHandler(client);
  setupEventHandler(client);
});

// Bot Login
client.login(process.env.BOT_TOKEN);
