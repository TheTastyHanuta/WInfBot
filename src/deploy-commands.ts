import { REST, Routes } from 'discord.js';
import { config } from 'dotenv';
import { readdirSync } from 'fs';
import { join } from 'path';

config();

const commands = [];

// Lade alle Commands
const commandFolders = readdirSync(join(__dirname, 'commands'));

for (const folder of commandFolders) {
    const commandFiles = readdirSync(join(__dirname, 'commands', folder))
        .filter(file => file.endsWith('.js') || file.endsWith('.ts'));
    
    for (const file of commandFiles) {
        const command = require(join(__dirname, 'commands', folder, file));
        if (command.data) {
            commands.push(command.data.toJSON());
            console.log(`Command registriert: ${command.data.name}`);
        }
    }
}

// REST Client erstellen
const rest = new REST().setToken(process.env.BOT_TOKEN!);

// Commands registrieren
(async () => {
    try {
        console.log(`Registriere ${commands.length} Slash Commands...`);

        // Für globale Commands (empfohlen für Production)
        const data = await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID!),
            { body: commands }
        ) as any[];

        console.log(`Erfolgreich ${data.length} Slash Commands registriert!`);
    } catch (error) {
        console.error('Fehler beim Registrieren der Commands:', error);
    }
})();
