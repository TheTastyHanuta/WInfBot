import { Client } from 'discord.js';
import { readdirSync, statSync } from 'fs';
import { join } from 'path';
import { Logger } from '../utils/logger';

export function setupEventHandler(client: Client) {
  // This file lives at <root>/handlers both when running from src via tsx and
  // when running the compiled output from dist, so the events are one level up
  // in either case.
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
      } else {
        const isValidFile = item.endsWith('.js') || item.endsWith('.ts');

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
  Logger.info('EVENT_HANDLER', 'All events loaded successfully');
}
