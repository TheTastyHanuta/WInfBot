import { Client, GatewayIntentBits, Collection } from 'discord.js';
import { config } from 'dotenv';
import { readdirSync } from 'fs';
import { join } from 'path';

config();

// Erweitere den Client um eine commands Collection
declare module 'discord.js' {
    export interface Client {
        commands: Collection<string, any>;
    }
}

// Erstelle den Client mit den nötigen Intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Initialisiere die Commands Collection
client.commands = new Collection();

// Lade alle Commands
const loadCommands = () => {
    const commandFolders = readdirSync(join(__dirname, 'commands'));
    
    for (const folder of commandFolders) {
        const commandFiles = readdirSync(join(__dirname, 'commands', folder))
            .filter(file => file.endsWith('.js') || file.endsWith('.ts'));
        
        for (const file of commandFiles) {
            const command = require(join(__dirname, 'commands', folder, file));
            if (command.data && command.execute) {
                client.commands.set(command.data.name, command);
                console.log(`Command geladen: ${command.data.name}`);
            }
        }
    }
};

// Bot Ready Event
client.once('ready', () => {
    console.log(`${client.user?.tag} ist online!`);
    loadCommands();
});

// Slash Command Handler
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(`Fehler beim Ausführen des Commands ${interaction.commandName}:`, error);
        
        const errorMessage = {
            content: 'Es gab einen Fehler beim Ausführen dieses Commands!',
            ephemeral: true
        };

        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(errorMessage);
        } else {
            await interaction.reply(errorMessage);
        }
    }
});

// Bot Login
client.login(process.env.BOT_TOKEN);