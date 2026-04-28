import mongoose from 'mongoose';
import { normalizeMealName } from '../utils/normalizeMealName';

interface IMensa extends mongoose.Document {
  canteenName: string;
  date: Date;
  mealName: string;
  allergens: string[];
  additives: string[];
  foodTypes: string[];
  sideDishes: string[];
  prices: {
    student: number | null;
    employee: number | null;
    other: number | null;
  };
  nutrition: {
    kj: number | null;
    kcal: number | null;
    fat: number | null;
    saturatedFat: number | null;
    carbohydrates: number | null;
    sugar: number | null;
    fiber: number | null;
    protein: number | null;
    salt: number | null;
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
    mealName: {
      type: String,
      required: true,
    },
    allergens: {
      type: [String],
      default: [],
    },
    additives: {
      type: [String],
      default: [],
    },
    foodTypes: {
      type: [String],
      default: [],
    },
    sideDishes: {
      type: [String],
      default: [],
    },
    prices: {
      student: {
        type: Number,
        default: null,
      },
      employee: {
        type: Number,
        default: null,
      },
      other: {
        type: Number,
        default: null,
      },
    },
    nutrition: {
      kj: {
        type: Number,
        default: null,
      },
      kcal: {
        type: Number,
        default: null,
      },
      fat: {
        type: Number,
        default: null,
      },
      saturatedFat: {
        type: Number,
        default: null,
      },
      carbohydrates: {
        type: Number,
        default: null,
      },
      sugar: {
        type: Number,
        default: null,
      },
      fiber: {
        type: Number,
        default: null,
      },
      protein: {
        type: Number,
        default: null,
      },
      salt: {
        type: Number,
        default: null,
      },
    },
  },
  {
    timestamps: true,
  }
);

mensaSchema.pre('validate', function normalizeMensaMealName(next) {
  if (this.mealName) {
    this.mealName = normalizeMealName(this.mealName);
  }

  next();
});

// Index for efficient queries
mensaSchema.index({ canteenName: 1, date: 1 });
mensaSchema.index({ canteenName: 1, date: 1, mealName: 1 });

export default mongoose.model<IMensa>('Mensa', mensaSchema);
export { IMensa };
