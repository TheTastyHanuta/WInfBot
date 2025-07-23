/**
 * Centralized color constants for consistent theming across the bot
 */

export const Colors = {
  // Status Colors
  SUCCESS: 0x00ff00, // Green - for success messages, enabled features
  ERROR: 0xff0000, // Red - for error messages, disabled features
  WARNING: 0xffff00, // Yellow - for warnings, pending states
  INFO: 0x0099ff, // Blue - for informational messages

  // Discord Brand Colors
  DISCORD_BLURPLE: 0x5865f2,
  DISCORD_GREEN: 0x57f287,
  DISCORD_YELLOW: 0xfee75c,
  DISCORD_FUCHSIA: 0xeb459e,
  DISCORD_RED: 0xed4245,
  DISCORD_WHITE: 0xffffff,
  DISCORD_BLACK: 0x000000,

  // Theme Colors
  PRIMARY: 0x5865f2, // Main bot color (Discord Blurple)
  SECONDARY: 0x99aab5, // Secondary/muted color
  ACCENT: 0xfee75c, // Accent color for highlights

  // Utility Colors
  TRANSPARENT: 0x2f3136, // Dark gray for backgrounds
  LIGHT_GRAY: 0x99aab5, // Light gray for text
  DARK_GRAY: 0x2f3136, // Dark gray for backgrounds

  // Feature-specific Colors
  AUDIT_LOG: 0x5865f2, // Blue for audit logging
  WELCOME: 0x57f287, // Green for welcome messages
  GOODBYE: 0xed4245, // Red for goodbye messages
  LEVELING: 0xfee75c, // Yellow for leveling system
  MODERATION: 0xed4245, // Red for moderation
  BIRTHDAY: 0xeb459e, // Pink for birthday messages
  INVITE: 0x5865f2, // Blue for invite tracking
  AUTO_ROLE: 0x99aab5, // Gray for auto role

  // Special Colors
  RAINBOW: [
    0xff0000, // Red
    0xff8000, // Orange
    0xffff00, // Yellow
    0x00ff00, // Green
    0x0080ff, // Blue
    0x8000ff, // Purple
    0xff00ff, // Magenta
  ],
} as const;

/**
 * Helper function to get a random color from the rainbow array
 */
export function getRandomRainbowColor(): number {
  return Colors.RAINBOW[Math.floor(Math.random() * Colors.RAINBOW.length)];
}

/**
 * Helper function to get status color based on boolean
 */
export function getStatusColor(enabled: boolean): number {
  return enabled ? Colors.SUCCESS : Colors.ERROR;
}

/**
 * Helper function to get color for different log levels
 */
export function getLogLevelColor(
  level: 'info' | 'warn' | 'error' | 'success'
): number {
  switch (level) {
    case 'info':
      return Colors.INFO;
    case 'warn':
      return Colors.WARNING;
    case 'error':
      return Colors.ERROR;
    case 'success':
      return Colors.SUCCESS;
    default:
      return Colors.INFO;
  }
}

/**
 * Helper function to get feature-specific colors
 */
export function getFeatureColor(feature: string): number {
  switch (feature.toLowerCase()) {
    case 'audit':
    case 'auditlogging':
      return Colors.AUDIT_LOG;
    case 'welcome':
    case 'welcomemessages':
      return Colors.WELCOME;
    case 'goodbye':
    case 'goodbyemessages':
      return Colors.GOODBYE;
    case 'leveling':
    case 'levelingsystem':
      return Colors.LEVELING;
    case 'moderation':
      return Colors.MODERATION;
    case 'birthday':
    case 'birthdaymessages':
      return Colors.BIRTHDAY;
    case 'invite':
    case 'invitetracking':
      return Colors.INVITE;
    case 'autorole':
      return Colors.AUTO_ROLE;
    default:
      return Colors.PRIMARY;
  }
}
