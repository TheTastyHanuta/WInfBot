import moment = require('moment-timezone');
import { Client, EmbedBuilder, TextChannel } from 'discord.js';
import { Colors } from './colors';

/**
 * Centralized logging utility for the Discord bot
 * Handles different log levels and environment-based logging
 */

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

export class Logger {
  private static isDevelopment = process.env.NODE_ENV !== 'production';
  private static logLevel = Logger.isDevelopment
    ? LogLevel.DEBUG
    : LogLevel.INFO;

  // Discord client for error reporting. Both bots report to the same
  // guild/channel, configured via ERROR_GUILD_ID and ERROR_CHANNEL_ID
  private static discordClient: Client | null = null;
  private static missingConfigWarned = false;

  // The same error is only reported to Discord once per this window
  private static readonly ERROR_DEDUPE_MS = 60_000;
  private static lastSentByKey = new Map<string, number>();

  // Default timezone - from the environment, or from setTimezone at runtime
  // (which wins). Lazy for the same reason as the error target above
  private static timezoneOverride: string | null = null;

  private static get timezone(): string {
    return (
      Logger.timezoneOverride || process.env.LOG_TIMEZONE || 'Europe/Berlin'
    );
  }

  private static formatMessage(
    level: string,
    category: string,
    message: string
  ): string {
    const timestamp = moment()
      .tz(Logger.timezone)
      .format('YYYY-MM-DD HH:mm:ss z');
    return `[${timestamp}] [${level}] [${category}] ${message}`;
  }

  private static shouldLog(level: LogLevel): boolean {
    return level <= Logger.logLevel;
  }

  /**
   * Set Discord client for error reporting
   */
  static setDiscordClient(client: Client): void {
    Logger.discordClient = client;
    Logger.info('LOGGER', 'Discord client set for error reporting');
  }

  /**
   * Drop repeats of the same error within ERROR_DEDUPE_MS.
   */
  private static shouldReportToDiscord(
    category: string,
    message: string
  ): boolean {
    const now = Date.now();
    const key = `${category}:${message}`;

    const lastSent = Logger.lastSentByKey.get(key);
    if (lastSent !== undefined && now - lastSent < Logger.ERROR_DEDUPE_MS) {
      return false;
    }

    // Expire stale entries so the map cannot grow without bound.
    for (const [entryKey, timestamp] of Logger.lastSentByKey.entries()) {
      if (now - timestamp >= Logger.ERROR_DEDUPE_MS) {
        Logger.lastSentByKey.delete(entryKey);
      }
    }

    Logger.lastSentByKey.set(key, now);
    return true;
  }

  /**
   * Send error embed to Discord channel
   */
  private static async sendErrorToDiscord(
    category: string,
    message: string,
    error?: Error
  ): Promise<void> {
    if (!Logger.discordClient) {
      console.warn(`[LOGGER] Discord client not set for logging`);
      return;
    }

    const guildId = process.env.ERROR_GUILD_ID;
    const channelId = process.env.ERROR_CHANNEL_ID;
    if (!guildId || !channelId) {
      if (!Logger.missingConfigWarned) {
        Logger.missingConfigWarned = true;
        console.warn(
          '[LOGGER] ERROR_GUILD_ID and/or ERROR_CHANNEL_ID are not set — ' +
            'error reporting to Discord is disabled (console logging is unaffected)'
        );
      }
      return;
    }

    if (!Logger.shouldReportToDiscord(category, message)) {
      return;
    }

    try {
      const guild = Logger.discordClient.guilds.cache.get(guildId);
      if (!guild) {
        console.warn(
          `[LOGGER] Error guild ${guildId} not found — is this bot a member of it?`
        );
        return;
      }

      const channel = guild.channels.cache.get(channelId) as TextChannel;
      if (!channel) {
        console.warn(
          `[LOGGER] Error channel ${channelId} not found in guild ${guildId}`
        );
        return;
      }

      const timestamp = moment()
        .tz(Logger.timezone)
        .format('YYYY-MM-DD HH:mm:ss z');

      const embed = new EmbedBuilder()
        .setTitle('🚨 Bot Error')
        .setColor(Colors.ERROR)
        .addFields(
          { name: 'Category', value: category, inline: true },
          { name: 'Timestamp', value: timestamp, inline: true },
          {
            name: 'Environment',
            value: Logger.isDevelopment ? 'Development' : 'Production',
            inline: true,
          },
          {
            name: 'Message',
            value:
              message.length > 1024
                ? message.substring(0, 1021) + '...'
                : message,
          }
        )
        .setTimestamp();

      if (error) {
        const stackTrace = error.stack || error.toString();
        embed.addFields({
          name: 'Stack Trace',
          value:
            stackTrace.length > 1024
              ? stackTrace.substring(0, 1021) + '...'
              : stackTrace,
        });
      }

      await channel.send({ embeds: [embed] });
    } catch (discordError) {
      console.error('[LOGGER] Failed to send error to Discord:', discordError);
    }
  }

  /**
   * Log error messages (always shown)
   */
  static error(category: string, message: string, error?: Error): void {
    if (Logger.shouldLog(LogLevel.ERROR)) {
      console.error(Logger.formatMessage('ERROR', category, message));
      if (error) {
        console.error(error.stack);
      }
    }

    // Send error to Discord channel
    Logger.sendErrorToDiscord(category, message, error).catch(discordError => {
      console.error('[LOGGER] Failed to send error to Discord:', discordError);
    });
  }

  /**
   * Log warning messages
   */
  static warn(category: string, message: string): void {
    if (Logger.shouldLog(LogLevel.WARN)) {
      console.warn(Logger.formatMessage('WARN', category, message));
    }
  }

  /**
   * Log info messages
   */
  static info(category: string, message: string): void {
    if (Logger.shouldLog(LogLevel.INFO)) {
      console.log(Logger.formatMessage('INFO', category, message));
    }
  }

  /**
   * Log debug messages (only in development)
   */
  static debug(category: string, message: string): void {
    if (Logger.shouldLog(LogLevel.DEBUG)) {
      console.log(Logger.formatMessage('DEBUG', category, message));
    }
  }

  /**
   * Log command executions (only in development)
   */
  static command(commandName: string, user: string, guild?: string): void {
    const guildInfo = guild ? ` in ${guild}` : '';
    Logger.debug('COMMAND', `${commandName} executed by ${user}${guildInfo}`);
  }

  /**
   * Log system startup and shutdown events (always shown)
   */
  static system(message: string): void {
    Logger.info('SYSTEM', message);
  }

  /**
   * Set log level manually
   */
  static setLogLevel(level: LogLevel): void {
    Logger.logLevel = level;
  }

  /**
   * Get current environment status
   */
  static isDev(): boolean {
    return Logger.isDevelopment;
  }

  /**
   * Set timezone for logging timestamps
   */
  static setTimezone(timezone: string): void {
    // Validate timezone
    if (moment.tz.zone(timezone)) {
      Logger.timezoneOverride = timezone;
      Logger.info('LOGGER', `Timezone set to: ${timezone}`);
    } else {
      Logger.warn(
        'LOGGER',
        `Invalid timezone: ${timezone}. Using default: ${Logger.timezone}`
      );
    }
  }

  /**
   * Get current timezone
   */
  static getTimezone(): string {
    return Logger.timezone;
  }
}
