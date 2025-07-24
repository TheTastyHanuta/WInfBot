import { User } from 'discord.js';
import { Logger } from './logger';

/**
 * Safely fetches a Discord user by their ID
 * @param client The Discord client instance
 * @param userId The ID of the user to fetch
 * @returns The User object if found, null if not found or error occurred
 */
export async function getUserSafely(
  client: any,
  userId: string
): Promise<User | null> {
  try {
    return await client.users.fetch(userId);
  } catch (error) {
    Logger.error('UTILS', `Failed to fetch user ${userId}:`, error as Error);
    return null;
  }
}
