import { Schema, model, models, Document, Model } from 'mongoose';

export interface IMemberStats extends Document {
  guildId: string;
  userId: string;
  xp: number;
  level: number;
  messages: number;
  voiceTime: number;
  textChannels: Map<string, number>;
  voiceChannels: Map<string, number>;
  createdAt: Date;
  updatedAt: Date;

  // Instance methods with detailed descriptions

  /** Add XP to the member and check for level up */
  addXP(amount: number): boolean;

  /** Get the XP required to reach a specific level */
  getXPRequiredForLevel(level: number): number;

  /** Get the remaining XP needed to reach the next level */
  getXPUntilNextLevel(): number;

  /** Get the progress to next level as a decimal (0.0 to 1.0) */
  getLevelProgress(): number;

  /** Increment the message count for a specific text channel */
  incrementTextChannel(channelId: string): void;

  /** Add voice time (in seconds) for a specific voice channel */
  addVoiceTime(channelId: string, timeInSeconds: number): void;
}

// Interface for static methods
export interface IMemberStatsModel extends Model<IMemberStats> {
  /** Find member stats by guild and user ID */
  findByGuildAndUser(
    guildId: string,
    userId: string
  ): Promise<IMemberStats | null>;

  /** Get top members by XP in a guild */
  getTopByXP(guildId: string, limit?: number): Promise<IMemberStats[]>;

  /** Get top members by level in a guild */
  getTopByLevel(guildId: string, limit?: number): Promise<IMemberStats[]>;

  /** Get all members in a guild sorted by level and XP */
  getAllByGuild(guildId: string): Promise<IMemberStats[]>;
}

const memberStatsSchema = new Schema<IMemberStats>(
  {
    guildId: {
      type: String,
      required: true,
    },
    userId: {
      type: String,
      required: true,
    },
    xp: {
      type: Number,
      default: 0,
      min: 0,
    },
    level: {
      type: Number,
      default: 1,
      min: 1,
    },
    messages: {
      type: Number,
      default: 0,
      min: 0,
    },
    voiceTime: {
      type: Number,
      default: 0,
      min: 0,
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
    collection: 'memberStats',
  }
);

// Compound index for better performance on queries
memberStatsSchema.index({ guildId: 1, userId: 1 }, { unique: true });

// Indexes for level-based queries
memberStatsSchema.index({ guildId: 1, level: -1 });
memberStatsSchema.index({ guildId: 1, xp: -1 });

// Static methods for common operations
memberStatsSchema.statics.findByGuildAndUser = function (
  guildId: string,
  userId: string
) {
  return this.findOne({ guildId, userId });
};

memberStatsSchema.statics.getTopByXP = function (
  guildId: string,
  limit: number = 10
) {
  return this.find({ guildId }).sort({ xp: -1 }).limit(limit);
};

memberStatsSchema.statics.getTopByLevel = function (
  guildId: string,
  limit: number = 10
) {
  return this.find({ guildId }).sort({ level: -1, xp: -1 }).limit(limit);
};

memberStatsSchema.statics.getAllByGuild = function (guildId: string) {
  return this.find({ guildId }).sort({ level: -1, xp: -1 });
};

memberStatsSchema.methods.addXP = function (amount: number) {
  this.xp += amount;

  const xpForNextLevel = this.getXPRequiredForLevel(this.level + 1);
  if (this.xp >= xpForNextLevel) {
    this.xp -= xpForNextLevel;
    this.level++;
    return true;
  }
  return false; // No level-up
};

// Calculate the required XP for a specific level
memberStatsSchema.methods.getXPRequiredForLevel = function (
  level: number
): number {
  // Progressive formula: Base 100 XP, +10% per level
  // Level 1→2: 100 XP, Level 2→3: 110 XP, Level 3→4: 121 XP, etc.
  return Math.floor(100 * Math.pow(1.1, level - 2));
};

// Calculate XP remaining until next level
memberStatsSchema.methods.getXPUntilNextLevel = function (): number {
  const nextLevelXPRequired = this.getXPRequiredForLevel(this.level + 1);
  return nextLevelXPRequired - this.xp;
};

// Calculate progress to next level (0-1)
memberStatsSchema.methods.getLevelProgress = function (): number {
  const nextLevelXPRequired = this.getXPRequiredForLevel(this.level + 1);
  return Math.min(this.xp / nextLevelXPRequired, 1);
};

memberStatsSchema.methods.incrementTextChannel = function (channelId: string) {
  const currentCount = this.textChannels.get(channelId) || 0;
  this.textChannels.set(channelId, currentCount + 1);
  this.messages += 1;
};

memberStatsSchema.methods.addVoiceTime = function (
  channelId: string,
  timeInSeconds: number
) {
  const currentTime = this.voiceChannels.get(channelId) || 0;
  this.voiceChannels.set(channelId, currentTime + timeInSeconds);
  this.voiceTime += timeInSeconds;
};

export const MemberStats =
  (models.MemberStats as IMemberStatsModel) ||
  model<IMemberStats, IMemberStatsModel>('MemberStats', memberStatsSchema);
