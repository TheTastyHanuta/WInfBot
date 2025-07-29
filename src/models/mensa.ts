import mongoose from 'mongoose';

interface IMensa extends mongoose.Document {
  canteenName: string;
  date: Date;
  category: string;
  mealName: string;
  notes: string[];
  prices: {
    student: number;
    employee: number;
    other: number;
  };
}

const mensaSchema = new mongoose.Schema<IMensa>(
  {
    canteenName: {
      type: String,
      required: true,
      enum: ['insel', 'sued'],
    },
    date: {
      type: Date,
      required: true,
    },
    category: {
      type: String,
      required: true,
    },
    mealName: {
      type: String,
      required: true,
    },
    notes: {
      type: [String],
      default: [],
    },
    prices: {
      student: {
        type: Number,
        default: 0,
      },
      employee: {
        type: Number,
        default: 0,
      },
      other: {
        type: Number,
        default: 0,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
mensaSchema.index({ canteenName: 1, date: 1 });

export default mongoose.model<IMensa>('Mensa', mensaSchema);
export { IMensa };
