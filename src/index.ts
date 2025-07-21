import { Client, GatewayIntentBits, Collection } from 'discord.js';
import { config } from 'dotenv';
import mongoose from 'mongoose';
import { setupCommandHandler } from './handlers/commandhandler';
import { setupEventHandler } from './handlers/eventhandler';

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
  ],
});

// Initialise the commands collection
client.commands = new Collection();

// Bot Ready Event
client.once('ready', async () => {
  console.log(`${client.user?.tag} ist online!`);

  // Connect to MongoDB
  try {
    await mongoose.connect(
      process.env.MONGO_DB_URI || 'mongodb://localhost:27017/winfbot'
    );
    console.log('MongoDB connected successfully!');
  } catch (error) {
    console.error('MongoDB connection error:', error);
  }

  // Setup handlers
  setupCommandHandler(client);
  setupEventHandler(client);
});

// Bot Login
client.login(process.env.BOT_TOKEN);
