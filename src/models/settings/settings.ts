import { Schema, model, models, Document, Model } from 'mongoose';
import moment = require('moment-timezone');

// Audit Logging Module Types
export interface IAuditLoggingModules {
  messageDelete: boolean;
  messageUpdate: boolean;
  memberBan: boolean;
  memberUnban: boolean;
  memberKick: boolean;
  channelCreate: boolean;
  channelDelete: boolean;
  channelUpdate: boolean;
  roleCreate: boolean;
  roleDelete: boolean;
  roleUpdate: boolean;
  inviteCreate: boolean;
  inviteDelete: boolean;
  eventCreate: boolean;
  eventUpdate: boolean;
  eventDelete: boolean;
}

export interface IAuditLogging {
  enabled: boolean;
  channel: string | null;
  modules: IAuditLoggingModules;
}

export interface IWelcomeMessages {
  enabled: boolean;
  channel: string | null;
  message: string;
}

export interface IGoodbyeMessages {
  enabled: boolean;
  channel: string | null;
  message: string;
}

export interface IInviteTracking {
  enabled: boolean;
  channel: string | null;
}

export interface IUserTracking {
  enabled: boolean;
}

export interface ILeveling {
  enabled: boolean;
  messages: boolean;
  channel: string | null;
}

export interface IModeration {
  enabled: boolean;
}

export interface IAutoRole {
  enabled: boolean;
  role: string | null;
}

export interface IBirthdayMessages {
  enabled: boolean;
  channel: string | null;
}

// Main Settings Interface
export interface IGuildSettings {
  auditLogging: IAuditLogging;
  welcomeMessages: IWelcomeMessages;
  goodbyeMessages: IGoodbyeMessages;
  inviteTracking: IInviteTracking;
  userTracking: IUserTracking;
  leveling: ILeveling;
  moderation: IModeration;
  autoRole: IAutoRole;
  birthdayMessages: IBirthdayMessages;
}

export interface IRestrictedCommand {
  command: string;
  channelId: string;
}

export interface IGuildSettingsDocument extends Document {
  guildId: string;
  settings: IGuildSettings;
  restrictedCommands: IRestrictedCommand[];
  createdAt: Date;
  updatedAt: Date;

  // Instance methods
  /**
   * Updates a specific setting in the guild settings.
   * @param path The path to the setting to update (e.g., "welcomeMessages.enabled").
   * @param value The new value for the setting.
   */
  updateSetting(path: string, value: any): Promise<IGuildSettingsDocument>;
  /**
   * Retrieves a specific setting from the guild settings.
   * @param path The path to the setting to retrieve (e.g., "welcomeMessages.channel").
   * @returns The value of the setting or undefined if not found.
   */
  getSetting(path: string): any;
  /**
   * Adds a command restriction for a specific channel.
   * @param command The command to restrict.
   * @param channelId The ID of the channel where the command is restricted.
   * @returns The updated guild settings document.
   */
  addRestrictedCommand(
    command: string,
    channelId: string
  ): Promise<IGuildSettingsDocument>;
  /**
   * Removes a command restriction for a specific channel or all channels.
   * @param command The command to remove the restriction for.
   * @param channelId Optional. The ID of the channel to remove the restriction from. If not provided, removes all restrictions for the command.
   * @returns The updated guild settings document.
   */
  removeRestrictedCommand(
    command: string,
    channelId?: string
  ): Promise<IGuildSettingsDocument>;
  /**
   * Checks if a command is restricted in a specific channel.
   * @param command The command to check.
   * @param channelId The ID of the channel to check the restriction in.
   * @returns True if the command is restricted in the channel, false otherwise.
   */
  isCommandRestricted(command: string, channelId: string): boolean;
}

// Interface for static methods
export interface IGuildSettingsModel extends Model<IGuildSettingsDocument> {
  /** Find guild settings by guild ID */
  findByGuildId(guildId: string): Promise<IGuildSettingsDocument | null>;
  /** Find or create guild settings by guild ID */
  findOrCreateByGuildId(guildId: string): Promise<IGuildSettingsDocument>;
}

const guildSettingsSchema = new Schema<IGuildSettingsDocument>(
  {
    guildId: {
      type: String,
      required: true,
      unique: true,
    },
    settings: {
      type: {
        auditLogging: {
          enabled: { type: Boolean, default: false },
          channel: { type: String, default: null },
          modules: {
            messageDelete: { type: Boolean, default: false },
            messageUpdate: { type: Boolean, default: false },
            memberBan: { type: Boolean, default: false },
            memberUnban: { type: Boolean, default: false },
            memberKick: { type: Boolean, default: false },
            channelCreate: { type: Boolean, default: false },
            channelDelete: { type: Boolean, default: false },
            channelUpdate: { type: Boolean, default: false },
            roleCreate: { type: Boolean, default: false },
            roleDelete: { type: Boolean, default: false },
            roleUpdate: { type: Boolean, default: false },
            inviteCreate: { type: Boolean, default: false },
            inviteDelete: { type: Boolean, default: false },
            eventCreate: { type: Boolean, default: false },
            eventUpdate: { type: Boolean, default: false },
            eventDelete: { type: Boolean, default: false },
          },
        },
        welcomeMessages: {
          enabled: { type: Boolean, default: false },
          channel: { type: String, default: null },
          message: { type: String, default: 'Welcome {member} to the server!' },
        },
        goodbyeMessages: {
          enabled: { type: Boolean, default: false },
          channel: { type: String, default: null },
          message: {
            type: String,
            default: 'Goodbye {member}, we will miss you!',
          },
        },
        inviteTracking: {
          enabled: { type: Boolean, default: false },
          channel: { type: String, default: null },
        },
        userTracking: {
          enabled: { type: Boolean, default: false },
        },
        leveling: {
          enabled: { type: Boolean, default: false },
          messages: { type: Boolean, default: false },
          channel: { type: String, default: null },
        },
        moderation: {
          enabled: { type: Boolean, default: false },
        },
        autoRole: {
          enabled: { type: Boolean, default: false },
          role: { type: String, default: null },
        },
        birthdayMessages: {
          enabled: { type: Boolean, default: false },
          channel: { type: String, default: null },
        },
      },
    },
    restrictedCommands: {
      type: [
        {
          command: { type: String, required: true },
          channelId: { type: String, required: true },
        },
      ],
      default: [],
    },
  },
  {
    timestamps: true,
    collection: 'guildSettings',
  }
);

// Static methods
guildSettingsSchema.statics.findByGuildId = function (guildId: string) {
  return this.findOne({ guildId });
};

guildSettingsSchema.statics.findOrCreateByGuildId = async function (
  guildId: string
) {
  let settings = await this.findOne({ guildId });
  if (!settings) {
    settings = new this({
      guildId,
      settings: {},
      restrictedCommands: [],
    });
    await settings.save();
  }
  return settings;
};

// Instance methods
guildSettingsSchema.methods.updateSetting = function (
  path: string,
  value: any
) {
  // Use dot notation to update nested settings
  // Example: updateSetting('auditLogging.enabled', true)
  const keys = path.split('.');
  let current = this.settings;

  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]]) {
      current[keys[i]] = {};
    }
    current = current[keys[i]];
  }

  current[keys[keys.length - 1]] = value;
  this.markModified('settings');
  return this.save();
};

guildSettingsSchema.methods.getSetting = function (path: string) {
  const keys = path.split('.');
  let current = this.settings;

  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = current[key];
    } else {
      return undefined;
    }
  }

  return current;
};

guildSettingsSchema.methods.addRestrictedCommand = function (
  command: string,
  channelId: string
) {
  // Check if the restriction already exists
  const exists = this.restrictedCommands.some(
    (restriction: IRestrictedCommand) =>
      restriction.command === command && restriction.channelId === channelId
  );

  if (!exists) {
    this.restrictedCommands.push({ command, channelId });
    return this.save();
  }

  return Promise.resolve(this);
};

guildSettingsSchema.methods.removeRestrictedCommand = function (
  command: string,
  channelId?: string
) {
  if (channelId) {
    // Remove specific command restriction for specific channel
    this.restrictedCommands = this.restrictedCommands.filter(
      (restriction: IRestrictedCommand) =>
        !(
          restriction.command === command && restriction.channelId === channelId
        )
    );
  } else {
    // Remove all restrictions for this command
    this.restrictedCommands = this.restrictedCommands.filter(
      (restriction: IRestrictedCommand) => restriction.command !== command
    );
  }

  return this.save();
};

guildSettingsSchema.methods.isCommandRestricted = function (
  command: string,
  channelId: string
) {
  return this.restrictedCommands.some(
    (restriction: IRestrictedCommand) =>
      restriction.command === command && restriction.channelId === channelId
  );
};

// Pre-save middleware to update the updatedAt field
guildSettingsSchema.pre('save', function (next) {
  this.updatedAt = moment().toDate();
  next();
});

export const GuildSettings = ((models.GuildSettings as IGuildSettingsModel) ||
  model<IGuildSettingsDocument, IGuildSettingsModel>(
    'GuildSettings',
    guildSettingsSchema
  )) as IGuildSettingsModel;
