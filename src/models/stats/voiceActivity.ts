import { Schema, model, Document } from 'mongoose';

export interface IVoiceActivity extends Document {
  guildId: string;
  userId: string;
  channelId: string;
  joinedAt: Date;
}

const voiceActivitySchema = new Schema<IVoiceActivity>(
  {
    guildId: {
      type: String,
      required: true,
    },
    userId: {
      type: String,
      required: true,
    },
    channelId: {
      type: String,
      required: true,
    },
    joinedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    collection: 'voiceActivity',
  }
);

// Compound index for better performance
voiceActivitySchema.index({ guildId: 1, userId: 1 }, { unique: true });

export const VoiceActivity = model<IVoiceActivity>(
  'VoiceActivity',
  voiceActivitySchema
);
