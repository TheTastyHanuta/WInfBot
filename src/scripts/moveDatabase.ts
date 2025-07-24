import { config } from 'dotenv';
import mongoose from 'mongoose';
import { MemberStats } from '../models/stats/memberStats';
import { ServerStats } from '../models/stats/serverStats';

config();

// Define old database schemas
const { Schema, model } = mongoose;

const levelSchema = new Schema({
  userId: { type: String, required: true },
  guildId: { type: String, required: true },
  xp: { type: Number, default: 0 },
  level: { type: Number, default: 0 },
  updatedAt: { type: Date },
  createdAt: { type: Date },
});

const messageamountSchema = new Schema({
  userId: { type: String, required: true },
  guildId: { type: String, required: true },
  amount: { type: Number, default: 0 },
  updatedAt: { type: Date },
  createdAt: { type: Date },
});

const userstatsSchema = new Schema({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  textchannels: { type: [Object], default: [] },
  voicechannels: { type: [Object], default: [] },
  updatedAt: { type: Date },
  createdAt: { type: Date },
});

const channelstatsSchema = new Schema({
  guildId: { type: String, required: true },
  textchannels: { type: [Object], default: [] },
  voicechannels: { type: [Object], default: [] },
  updatedAt: { type: Date },
  createdAt: { type: Date },
});

const voiceactivitySchema = new Schema({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  timestamp: { type: Date },
  totalTime: { type: Number, default: 0 },
  updatedAt: { type: Date },
  createdAt: { type: Date },
});

// Create connections for both databases
let oldConnection: mongoose.Connection;
let newConnection: mongoose.Connection;

async function connectToDatabases() {
  try {
    // Connect to old database
    oldConnection = mongoose.createConnection(
      process.env.OLD_MONGO_DB_URI || 'mongodb://localhost:27017/old_winfbot'
    );
    console.log('OLD_DATABASE', 'Old MongoDB connected successfully!');

    // Connect to new database
    newConnection = mongoose.createConnection(
      process.env.TEST_MONGO_DB_URI || 'mongodb://localhost:27017/winfbot'
    );
    console.log('DATABASE', 'New MongoDB connected successfully!');

    return { oldConnection, newConnection };
  } catch (error) {
    console.error('DATABASE', 'MongoDB connection error', error as Error);
    throw error;
  }
}

// Helper function to convert old channel arrays to Map
function convertChannelsToMap(channels: any[]): Map<string, number> {
  const channelMap = new Map<string, number>();

  if (Array.isArray(channels)) {
    channels.forEach((channel, index) => {
      // Try multiple possible field name combinations
      let channelId: string | null = null;
      let count: number | null = null;

      // Possible ID field names
      if (channel?.channelId) channelId = channel.channelId;
      else if (channel?.id) channelId = channel.id;
      else if (channel?._id) channelId = channel._id;
      else if (channel?.channel) channelId = channel.channel;

      // Possible count field names
      if (typeof channel?.count === 'number') count = channel.count;
      else if (typeof channel?.amount === 'number') count = channel.amount;
      else if (typeof channel?.messages === 'number') count = channel.messages;
      else if (typeof channel?.time === 'number') count = channel.time;
      else if (typeof channel?.totalTime === 'number')
        count = channel.totalTime;
      else if (typeof channel?.value === 'number') count = channel.value;

      if (channelId && count !== null) {
        channelMap.set(channelId, count);
      }
    });
  }

  return channelMap;
}

// Helper function specifically for voice channels
function convertVoiceChannelsToMap(channels: any[]): Map<string, number> {
  const channelMap = new Map<string, number>();

  if (Array.isArray(channels)) {
    channels.forEach(channel => {
      let channelId: string | null = null;
      let timeInSeconds: number | null = null;

      // Get channel ID
      if (channel?.channelId) channelId = channel.channelId;
      else if (channel?.id) channelId = channel.id;
      else if (channel?._id) channelId = channel._id;
      else if (channel?.channel) channelId = channel.channel;

      if (typeof channel?.totalTime === 'number') {
        // Convert milliseconds to seconds
        timeInSeconds = Math.floor(channel.totalTime / 1000);
      } else if (typeof channel?.time === 'number') {
        timeInSeconds = channel.time;
      } else if (typeof channel?.count === 'number') {
        timeInSeconds = channel.count;
      }

      if (channelId && timeInSeconds !== null) {
        channelMap.set(channelId, timeInSeconds);
      }
    });
  }

  return channelMap;
}

// Helper function specifically for voice channels in ServerStats
function convertVoiceChannelsToMapForServer(
  channels: any[]
): Map<string, number> {
  const channelMap = new Map<string, number>();

  if (Array.isArray(channels)) {
    channels.forEach(channel => {
      let channelId: string | null = null;
      let timeValue: number | null = null;

      // Get channel ID
      if (channel?.channelId) channelId = channel.channelId;
      else if (channel?.id) channelId = channel.id;
      else if (channel?._id) channelId = channel._id;
      else if (channel?.channel) channelId = channel.channel;

      if (typeof channel?.totalTime === 'number') {
        // Convert milliseconds to seconds
        timeValue = Math.floor(channel.totalTime / 1000);
      } else if (typeof channel?.time === 'number') {
        timeValue = channel.time;
      } else if (typeof channel?.count === 'number') {
        timeValue = channel.count;
      }

      if (channelId && timeValue !== null) {
        channelMap.set(channelId, timeValue);
      }
    });
  }

  return channelMap;
}

// Helper function to calculate voice time from voice channels
function calculateVoiceTime(voiceChannels: any[]): number {
  let totalTime = 0;

  if (Array.isArray(voiceChannels)) {
    voiceChannels.forEach(channel => {
      if (channel && typeof channel.totalTime === 'number') {
        // Convert milliseconds to seconds
        totalTime += Math.floor(channel.totalTime / 1000);
      } else if (channel && typeof channel.time === 'number') {
        totalTime += channel.time;
      } else if (channel && typeof channel.count === 'number') {
        // If it's just a count, assume it's in seconds
        totalTime += channel.count;
      }
    });
  }

  return totalTime;
}

async function migrateData() {
  try {
    await connectToDatabases();

    // Create old models using old connection
    const OldLevel = oldConnection.model('Level', levelSchema);
    const OldMessageAmount = oldConnection.model(
      'messageamount',
      messageamountSchema
    );
    const OldUserStats = oldConnection.model('userstats', userstatsSchema);
    const OldChannelStats = oldConnection.model(
      'channelstats',
      channelstatsSchema
    );
    const OldVoiceActivity = oldConnection.model(
      'VoiceActivity',
      voiceactivitySchema
    );

    // Create new models using new connection
    const NewMemberStats = newConnection.model(
      'MemberStats',
      MemberStats.schema
    );
    const NewServerStats = newConnection.model(
      'ServerStats',
      ServerStats.schema
    );

    console.log('Starting migration...');

    console.log('Migrating Level data...');
    const levels = await OldLevel.find({});
    console.log(`Found ${levels.length} level records`);

    for (const level of levels) {
      try {
        await NewMemberStats.findOneAndUpdate(
          { guildId: level.guildId, userId: level.userId },
          {
            $set: {
              xp: level.xp || 0,
              level: level.level || 1,
              guildId: level.guildId,
              userId: level.userId,
            },
          },
          { upsert: true, new: true }
        );
      } catch (error) {
        console.error(
          `Error migrating level for user ${level.userId} in guild ${level.guildId}:`,
          error
        );
      }
    }

    console.log('Migrating MessageAmount data...');
    const messageAmounts = await OldMessageAmount.find({});
    console.log(`Found ${messageAmounts.length} message amount records`);

    for (const msgAmount of messageAmounts) {
      try {
        await NewMemberStats.findOneAndUpdate(
          { guildId: msgAmount.guildId, userId: msgAmount.userId },
          {
            $set: {
              messages: msgAmount.amount || 0,
              guildId: msgAmount.guildId,
              userId: msgAmount.userId,
            },
          },
          { upsert: true, new: true }
        );
      } catch (error) {
        console.error(
          `Error migrating messages for user ${msgAmount.userId} in guild ${msgAmount.guildId}:`,
          error
        );
      }
    }

    console.log('Migrating UserStats data...');
    const userStats = await OldUserStats.find({});
    console.log(`Found ${userStats.length} user stats records`);

    for (const userStat of userStats) {
      try {
        const textChannelsMap = convertChannelsToMap(userStat.textchannels);
        const voiceChannelsMap = convertVoiceChannelsToMap(
          userStat.voicechannels
        );
        const voiceTime = calculateVoiceTime(userStat.voicechannels);

        await NewMemberStats.findOneAndUpdate(
          { guildId: userStat.guildId, userId: userStat.userId },
          {
            $set: {
              textChannels: textChannelsMap,
              voiceChannels: voiceChannelsMap,
              voiceTime: voiceTime,
              guildId: userStat.guildId,
              userId: userStat.userId,
            },
          },
          { upsert: true, new: true }
        );
      } catch (error) {
        console.error(
          `Error migrating user stats for user ${userStat.userId} in guild ${userStat.guildId}:`,
          error
        );
      }
    }

    console.log('Migrating VoiceActivity data...');
    const voiceActivities = await OldVoiceActivity.find({});
    console.log(`Found ${voiceActivities.length} voice activity records`);

    // Group voice activities by user to sum up total time
    const voiceTimeByUser = new Map<string, number>();

    for (const voiceActivity of voiceActivities) {
      const userKey = `${voiceActivity.guildId}:${voiceActivity.userId}`;
      const currentTime = voiceTimeByUser.get(userKey) || 0;
      // Convert milliseconds to seconds
      const timeInSeconds = Math.floor((voiceActivity.totalTime || 0) / 1000);
      voiceTimeByUser.set(userKey, currentTime + timeInSeconds);
    }

    // Update MemberStats with accumulated voice time
    for (const [userKey, totalTime] of voiceTimeByUser.entries()) {
      const [guildId, userId] = userKey.split(':');
      try {
        await NewMemberStats.findOneAndUpdate(
          { guildId, userId },
          {
            $set: {
              voiceTime: totalTime,
              guildId,
              userId,
            },
          },
          { upsert: true, new: true }
        );
      } catch (error) {
        console.error(
          `Error migrating voice activity for user ${userId} in guild ${guildId}:`,
          error
        );
      }
    }

    console.log('Migrating ChannelStats data...');
    const channelStats = await OldChannelStats.find({});
    console.log(`Found ${channelStats.length} channel stats records`);

    for (const channelStat of channelStats) {
      try {
        const textChannelsMap = convertChannelsToMap(channelStat.textchannels);
        const voiceChannelsMap = convertVoiceChannelsToMapForServer(
          channelStat.voicechannels
        );

        await NewServerStats.findOneAndUpdate(
          { guildId: channelStat.guildId },
          {
            $set: {
              textChannels: textChannelsMap,
              voiceChannels: voiceChannelsMap,
              guildId: channelStat.guildId,
            },
          },
          { upsert: true, new: true }
        );
      } catch (error) {
        console.error(
          `Error migrating channel stats for guild ${channelStat.guildId}:`,
          error
        );
      }
    }

    console.log('Migration completed successfully!');

    // Summary of migrated data
    const memberStatsCount = await NewMemberStats.countDocuments();
    const serverStatsCount = await NewServerStats.countDocuments();

    console.log(`\nMigration Summary:`);
    console.log(`- Member Stats records: ${memberStatsCount}`);
    console.log(`- Server Stats records: ${serverStatsCount}`);
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    // Close connections
    if (oldConnection) {
      await oldConnection.close();
    }
    if (newConnection) {
      await newConnection.close();
    }
    process.exit(0);
  }
}

// Run migration
migrateData().catch(console.error);
