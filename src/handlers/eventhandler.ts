import { Client } from 'discord.js';
import { readdirSync, statSync } from 'fs';
import { join } from 'path';
import { Logger } from '../utils/logger';

export function setupEventHandler(client: Client) {
  // Determine the correct path based on whether we're running from dist or src
  const isProduction = __filename.includes('dist');
  const eventsPath = isProduction
    ? join(__dirname, 'events') // Use relative path for production (compiled)
    : join(__dirname, '../events'); // Use __dirname for development

  // Recursively load events from all subdirectories
  const loadEventsFromDirectory = (directory: string) => {
    const items = readdirSync(directory);

    for (const item of items) {
      const fullPath = join(directory, item);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        // Recursively load from subdirectories
        loadEventsFromDirectory(fullPath);
      } else {
        // Check file extension based on environment
        const isProduction = __filename.includes('dist');
        const isValidFile = isProduction
          ? item.endsWith('.js')
          : item.endsWith('.js') || item.endsWith('.ts');

        if (isValidFile) {
          // Load event file
          const event = require(fullPath);

          if (event.name && event.execute) {
            if (event.once) {
              client.once(event.name, (...args) =>
                event.execute(...args, client)
              );
            } else {
              client.on(event.name, (...args) =>
                event.execute(...args, client)
              );
            }

            Logger.debug(
              'EVENT_LOADER',
              `Event loaded: ${event.name} (${item})`
            );
          } else {
            Logger.warn(
              'EVENT_LOADER',
              `Event file ${item} is missing 'name' or 'execute' property`
            );
          }
        }
      }
    }
  };

  // Load all events
  loadEventsFromDirectory(eventsPath);
  Logger.info('EVENT_HANDLER', 'All event handlers loaded successfully');
}
