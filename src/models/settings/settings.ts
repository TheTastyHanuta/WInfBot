import { Schema, model, models, Document, Model } from 'mongoose';

// Kompakte Interface Definition
export interface IGuildSettings {
  auditLogging: {
    enabled: boolean;
    channel: string | null;
    modules: {
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
    };
  };
  welcomeMessages: {
    enabled: boolean;
    channel: string | null;
    message: string;
  };
  goodbyeMessages: {
    enabled: boolean;
    channel: string | null;
    message: string;
  };
  inviteTracking: {
    enabled: boolean;
    channel: string | null;
  };
  userTracking: {
    enabled: boolean;
  };
  leveling: {
    enabled: boolean;
    messages: boolean;
    channel: string | null;
  };
  moderation: {
    enabled: boolean;
  };
  autoRole: {
    enabled: boolean;
    role: string | null;
  };
  birthdayMessages: {
    enabled: boolean;
    channel: string | null;
  };
}

// Utility type für Setting Paths
type NestedKeyOf<T extends object> = {
  [K in keyof T & (string | number)]: T[K] extends object
    ? `${K}` | `${K}.${NestedKeyOf<T[K]>}`
    : `${K}`;
}[keyof T & (string | number)];

export type SettingPath = NestedKeyOf<IGuildSettings>;

// Document Interface
export interface IGuildSettingsDocument extends Document {
  guildId: string;
  settings: IGuildSettings;
  restrictedCommands: Array<{ command: string; channelId: string }>;
  updatedAt: Date;
  createdAt: Date;

  /**
   * Get a specific setting value by its path
   * @param path The path to the setting
   * @return The value of the setting
   */
  getSetting(path: SettingPath): any;
  /**
   * Update a specific setting value by its path
   * @param path The path to the setting
   * @param value The new value for the setting
   * @return The updated document
   */
  updateSetting(path: SettingPath, value: any): Promise<this>;
  /**
   * Add a command to the restricted commands list for a specific channel
   * @param command The command to restrict
   * @param channelId The ID of the channel where the command is restricted
   * @return The updated document
   */
  addRestrictedCommand(command: string, channelId: string): Promise<this>;
  /**
   * Remove a command from the restricted commands list
   * @param command The command to remove
   * @param channelId Optional channel ID to remove restriction from a specific channel
   * @return The updated document
   */
  removeRestrictedCommand(command: string, channelId?: string): Promise<this>;
  /**
   * Check if a command is restricted in a specific channel
   * @param command The command to check
   * @param channelId The ID of the channel to check
   * @return True if the command is restricted, false otherwise
   */
  isCommandRestricted(command: string, channelId: string): boolean;
}

// Model Interface
export interface IGuildSettingsModel extends Model<IGuildSettingsDocument> {
  /**
   * Find guild settings by guild ID
   * @param guildId The ID of the guild
   * @return The guild settings document or null if not found
   */
  findByGuildId(guildId: string): Promise<IGuildSettingsDocument>;
  /**
   * Find or create guild settings by guild ID
   * @param guildId The ID of the guild
   * @return The guild settings document
   */
  findOrCreateByGuildId(guildId: string): Promise<IGuildSettingsDocument>;
}

// Default Settings
const defaultSettings: IGuildSettings = {
  auditLogging: {
    enabled: false,
    channel: null,
    modules: {
      messageDelete: false,
      messageUpdate: false,
      memberBan: false,
      memberUnban: false,
      memberKick: false,
      channelCreate: false,
      channelDelete: false,
      channelUpdate: false,
      roleCreate: false,
      roleDelete: false,
      roleUpdate: false,
      inviteCreate: false,
      inviteDelete: false,
      eventCreate: false,
      eventUpdate: false,
      eventDelete: false,
    },
  },
  welcomeMessages: {
    enabled: false,
    channel: null,
    message: 'Welcome {member} to the server!',
  },
  goodbyeMessages: {
    enabled: false,
    channel: null,
    message: 'Goodbye {member}, we will miss you!',
  },
  inviteTracking: { enabled: false, channel: null },
  userTracking: { enabled: false },
  leveling: { enabled: false, messages: false, channel: null },
  moderation: { enabled: false },
  autoRole: { enabled: false, role: null },
  birthdayMessages: { enabled: false, channel: null },
};

// Schema
const guildSettingsSchema = new Schema<IGuildSettingsDocument>(
  {
    guildId: { type: String, required: true, unique: true },
    settings: { type: Schema.Types.Mixed, default: defaultSettings },
    restrictedCommands: [
      {
        command: { type: String, required: true },
        channelId: { type: String, required: true },
      },
    ],
  },
  { timestamps: true, collection: 'guildSettings' }
);

// Static Methods
guildSettingsSchema.statics.findByGuildId = function (guildId: string) {
  return this.findOne({ guildId });
};

guildSettingsSchema.statics.findOrCreateByGuildId = async function (
  guildId: string
) {
  const settings = await this.findOneAndUpdate(
    { guildId },
    {
      $setOnInsert: {
        guildId,
        settings: defaultSettings,
        restrictedCommands: [],
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return settings;
};

// Instance Methods
guildSettingsSchema.methods.getSetting = function (path: SettingPath) {
  return path.split('.').reduce((obj, key) => obj?.[key], this.settings);
};

guildSettingsSchema.methods.updateSetting = function (
  path: SettingPath,
  value: any
) {
  const keys = path.split('.');
  const lastKey = keys.pop()!;
  const target = keys.reduce((obj, key) => {
    if (!obj[key]) obj[key] = {};
    return obj[key];
  }, this.settings);

  target[lastKey] = value;
  this.markModified('settings');
  return this.save();
};

guildSettingsSchema.methods.addRestrictedCommand = function (
  command: string,
  channelId: string
) {
  if (!this.isCommandRestricted(command, channelId)) {
    this.restrictedCommands.push({ command, channelId });
  }
  return this.save();
};

guildSettingsSchema.methods.removeRestrictedCommand = function (
  command: string,
  channelId?: string
) {
  this.restrictedCommands = this.restrictedCommands.filter(
    (r: { command: string; channelId: string }) =>
      channelId
        ? !(r.command === command && r.channelId === channelId)
        : r.command !== command
  );
  return this.save();
};

guildSettingsSchema.methods.isCommandRestricted = function (
  command: string,
  channelId: string
) {
  return this.restrictedCommands.some(
    (r: { command: string; channelId: string }) =>
      r.command === command && r.channelId === channelId
  );
};

export const GuildSettings =
  (models.GuildSettings as IGuildSettingsModel) ||
  model<IGuildSettingsDocument, IGuildSettingsModel>(
    'GuildSettings',
    guildSettingsSchema
  );
