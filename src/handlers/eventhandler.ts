import { Client } from 'discord.js';
import { readdirSync, statSync } from 'fs';
import { join } from 'path';

export function setupEventHandler(client: Client) {
  const eventsPath = join(__dirname, '../events');

  // Recursively load events from all subdirectories
  const loadEventsFromDirectory = (directory: string) => {
    const items = readdirSync(directory);

    for (const item of items) {
      const fullPath = join(directory, item);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        // Recursively load from subdirectories
        loadEventsFromDirectory(fullPath);
      } else if (item.endsWith('.js') || item.endsWith('.ts')) {
        // Load event file
        const event = require(fullPath);

        if (event.name && event.execute) {
          if (event.once) {
            client.once(event.name, (...args) =>
              event.execute(...args, client)
            );
          } else {
            client.on(event.name, (...args) => event.execute(...args, client));
          }

          console.log(`Event loaded: ${event.name} (${item})`);
        } else {
          console.warn(
            `Event file ${item} is missing 'name' or 'execute' property`
          );
        }
      }
    }
  };

  // Load all events
  loadEventsFromDirectory(eventsPath);
  console.log('All event handlers loaded successfully');
}
