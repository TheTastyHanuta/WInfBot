import moment = require('moment-timezone');

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

  // Default timezone - can be configured via environment variable
  private static timezone = process.env.LOG_TIMEZONE || 'Europe/Berlin';

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
   * Log error messages (always shown)
   */
  static error(category: string, message: string, error?: Error): void {
    if (Logger.shouldLog(LogLevel.ERROR)) {
      console.error(Logger.formatMessage('ERROR', category, message));
      if (error) {
        console.error(error.stack);
      }
    }
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
      Logger.timezone = timezone;
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
