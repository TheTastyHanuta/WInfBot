import { Schema, model, models, Document, Model } from 'mongoose';

export interface IServerStats extends Document {
  guildId: string;
  textChannels: Map<string, number>;
  voiceChannels: Map<string, number>;
  createdAt: Date;
  updatedAt: Date;

  // Instance methods with detailed descriptions

  /**
   * Increments the message count for a specific text channel.
   * @param channelId The ID of the text channel to increment.
   * @param amount The amount to increment by (default is 1).
   */
  incrementTextChannel(channelId: string, amount?: number): void;

  /**
   * Increments the activity count for a specific voice channel.
   * @param channelId The ID of the voice channel to increment.
   * @param amount The amount to increment by (default is 1).
   */
  incrementVoiceChannel(channelId: string, amount?: number): void;

  /**
   * Get the activity count for a specific text channel.
   * @param channelId The ID of the text channel.
   * @returns The number of messages in the specified text channel.
   */
  getTextChannelStats(channelId: string): number;

  /**
   * Get the activity count for a specific voice channel.
   * @param channelId The ID of the voice channel.
   * @returns The number of users in the specified voice channel.
   */
  getVoiceChannelStats(channelId: string): number;

  /**
   * Get the total number of messages across all text channels.
   * @returns The total number of messages in all text channels.
   */
  getTotalTextMessages(): number;

  /**
   * Get the total voice activity across all voice channels.
   * @returns The total voice activity in all voice channels.
   */
  getTotalVoiceActivity(): number;

  /**
   * Get the most active text channel with its message count.
   * @returns An object containing the channel ID and message count, or null if no channels exist.
   */
  getMostActiveTextChannel(): { channelId: string; count: number } | null;

  /**
   * Get the most active voice channel with its activity count.
   * @returns An object containing the channel ID and activity count, or null if no channels exist.
   */
  getMostActiveVoiceChannel(): { channelId: string; count: number } | null;

  /**
   * Get all text channels sorted by message count in descending order.
   * @returns An array of objects containing channel IDs and their message counts.
   */
  getAllTextChannelsSorted(): { channelId: string; count: number }[];

  /**
   * Get all voice channels sorted by activity count in descending order.
   * @returns An array of objects containing channel IDs and their activity counts.
   */
  getAllVoiceChannelsSorted(): { channelId: string; count: number }[];
}

// Interface for static methods
export interface IServerStatsModel extends Model<IServerStats> {
  /**
   * Find server stats by guild ID
   * @param guildId The ID of the guild
   * @returns The server stats document or null if not found
   */
  findByGuild(guildId: string): Promise<IServerStats | null>;

  /**
   * Create new server stats or update existing ones
   * @param guildId The ID of the guild
   * @param updates The updates to apply
   * @returns The updated server stats document
   */
  createOrUpdate(
    guildId: string,
    updates: Partial<IServerStats>
  ): Promise<IServerStats>;
}

const serverStatsSchema = new Schema<IServerStats>(
  {
    guildId: {
      type: String,
      required: true,
      unique: true,
    },
    textChannels: {
      type: Map,
      of: Number,
      default: new Map(),
    },
    voiceChannels: {
      type: Map,
      of: Number,
      default: new Map(),
    },
  },
  {
    timestamps: true,
    collection: 'serverStats',
  }
);

// Static methods for common operations
serverStatsSchema.statics.findByGuild = function (guildId: string) {
  return this.findOne({ guildId });
};

serverStatsSchema.statics.createOrUpdate = function (
  guildId: string,
  updates: Partial<IServerStats>
) {
  return this.findOneAndUpdate(
    { guildId },
    { ...updates, guildId },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  );
};

// Instance methods
serverStatsSchema.methods.incrementTextChannel = function (
  channelId: string,
  amount: number = 1
) {
  const currentCount = this.textChannels.get(channelId) || 0;
  this.textChannels.set(channelId, currentCount + amount);
};

serverStatsSchema.methods.incrementVoiceChannel = function (
  channelId: string,
  amount: number = 1
) {
  const currentCount = this.voiceChannels.get(channelId) || 0;
  this.voiceChannels.set(channelId, currentCount + amount);
};

serverStatsSchema.methods.getTextChannelStats = function (
  channelId: string
): number {
  return this.textChannels.get(channelId) || 0;
};

serverStatsSchema.methods.getVoiceChannelStats = function (
  channelId: string
): number {
  return this.voiceChannels.get(channelId) || 0;
};

serverStatsSchema.methods.getTotalTextMessages = function (): number {
  let total = 0;
  for (const count of this.textChannels.values()) {
    total += count;
  }
  return total;
};

serverStatsSchema.methods.getTotalVoiceActivity = function (): number {
  let total = 0;
  for (const count of this.voiceChannels.values()) {
    total += count;
  }
  return total;
};

serverStatsSchema.methods.getMostActiveTextChannel = function (): {
  channelId: string;
  count: number;
} | null {
  let maxChannelId: string | null = null;
  let maxCount = 0;

  for (const [channelId, count] of this.textChannels.entries()) {
    if (count > maxCount) {
      maxCount = count;
      maxChannelId = channelId;
    }
  }

  return maxChannelId ? { channelId: maxChannelId, count: maxCount } : null;
};

serverStatsSchema.methods.getMostActiveVoiceChannel = function (): {
  channelId: string;
  count: number;
} | null {
  let maxChannelId: string | null = null;
  let maxCount = 0;

  for (const [channelId, count] of this.voiceChannels.entries()) {
    if (count > maxCount) {
      maxCount = count;
      maxChannelId = channelId;
    }
  }

  return maxChannelId ? { channelId: maxChannelId, count: maxCount } : null;
};

serverStatsSchema.methods.getAllTextChannelsSorted = function (): {
  channelId: string;
  count: number;
}[] {
  const channels: { channelId: string; count: number }[] = [];

  for (const [channelId, count] of this.textChannels.entries()) {
    channels.push({ channelId, count });
  }

  // Sort by count (descending)
  return channels.sort((a, b) => b.count - a.count);
};

serverStatsSchema.methods.getAllVoiceChannelsSorted = function (): {
  channelId: string;
  count: number;
}[] {
  const channels: { channelId: string; count: number }[] = [];

  for (const [channelId, count] of this.voiceChannels.entries()) {
    channels.push({ channelId, count });
  }

  // Sort by count (descending)
  return channels.sort((a, b) => b.count - a.count);
};

export const ServerStats = (models.ServerStats ||
  model<IServerStats, IServerStatsModel>(
    'ServerStats',
    serverStatsSchema
  )) as IServerStatsModel;
