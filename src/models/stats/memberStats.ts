import { Schema, model, Document, Model } from 'mongoose';

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

  // Instance methods
  addXP(amount: number): boolean;
  calculateLevelFromXP(xp: number): number;
  getXPRequiredForLevel(level: number): number;
  getTotalXPForLevel(level: number): number;
  getXPUntilNextLevel(): number;
  getLevelProgress(): number;
  incrementTextChannel(channelId: string): void;
  addVoiceTime(channelId: string, timeInSeconds: number): void;
}

// Interface for static methods
export interface IMemberStatsModel extends Model<IMemberStats> {
  findByGuildAndUser(
    guildId: string,
    userId: string
  ): Promise<IMemberStats | null>;
  getTopByXP(guildId: string, limit?: number): Promise<IMemberStats[]>;
  getTopByLevel(guildId: string, limit?: number): Promise<IMemberStats[]>;
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

  // Calculate the required level based on current XP
  const newLevel = this.calculateLevelFromXP(this.xp);
  if (newLevel > this.level) {
    this.level = newLevel;
    return true; // Level-up occurred
  }
  return false; // No level-up
};

// Helper method: Calculate level based on XP (progressive scaling)
memberStatsSchema.methods.calculateLevelFromXP = function (xp: number): number {
  let level = 1;
  let totalXPNeeded = 0;

  while (totalXPNeeded <= xp) {
    const xpForNextLevel = this.getXPRequiredForLevel(level + 1);
    if (totalXPNeeded + xpForNextLevel > xp) break;
    totalXPNeeded += xpForNextLevel;
    level++;
  }

  return level;
};

// Calculate the required XP for a specific level
memberStatsSchema.methods.getXPRequiredForLevel = function (
  level: number
): number {
  // Progressive formula: Base 100 XP, +10% per level
  // Level 1→2: 100 XP, Level 2→3: 110 XP, Level 3→4: 121 XP, etc.
  return Math.floor(100 * Math.pow(1.1, level - 2));
};

// Calculate the total XP required for a level
memberStatsSchema.methods.getTotalXPForLevel = function (
  level: number
): number {
  let totalXP = 0;
  for (let i = 2; i <= level; i++) {
    totalXP += this.getXPRequiredForLevel(i);
  }
  return totalXP;
};

// Calculate XP remaining until next level
memberStatsSchema.methods.getXPUntilNextLevel = function (): number {
  const currentLevelTotalXP = this.getTotalXPForLevel(this.level);
  const nextLevelTotalXP = this.getTotalXPForLevel(this.level + 1);
  return nextLevelTotalXP - this.xp;
};

// Calculate progress to next level (0-1)
memberStatsSchema.methods.getLevelProgress = function (): number {
  const currentLevelTotalXP = this.getTotalXPForLevel(this.level);
  const nextLevelXPRequired = this.getXPRequiredForLevel(this.level + 1);
  const progressXP = this.xp - currentLevelTotalXP;
  return Math.min(progressXP / nextLevelXPRequired, 1);
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

export const MemberStats = model<IMemberStats, IMemberStatsModel>(
  'MemberStats',
  memberStatsSchema
);
