import { config } from 'dotenv';
import mongoose from 'mongoose';
import Mensa from '../models/mensa';
import { normalizeMealName } from '../utils/normalizeMealName';

config();

const isDevelopment = process.env.NODE_ENV === 'development';
const mongoUri = isDevelopment
  ? process.env.TEST_MONGO_DB_URI
  : process.env.MONGO_DB_URI || 'mongodb://localhost:27017/winfbot';
const dryRun = process.argv.includes('--dry-run');

interface CleanupStats {
  scanned: number;
  changedNames: number;
  updated: number;
}

async function cleanupMensaData(): Promise<CleanupStats> {
  const stats: CleanupStats = {
    scanned: 0,
    changedNames: 0,
    updated: 0,
  };

  const meals = await Mensa.find({}, { _id: 1, mealName: 1 }).lean();

  for (const meal of meals) {
    stats.scanned++;

    const mealName = typeof meal.mealName === 'string' ? meal.mealName : '';
    const cleanedMealName = normalizeMealName(mealName);

    if (cleanedMealName !== mealName) {
      stats.changedNames++;
    }

    if (dryRun) {
      continue;
    }

    await Mensa.collection.updateOne(
      { _id: meal._id },
      {
        $set: {
          mealName: cleanedMealName,
        },
      }
    );
    stats.updated++;
  }

  return stats;
}

async function main(): Promise<void> {
  if (!mongoUri) {
    throw new Error('MongoDB URI not configured');
  }

  await mongoose.connect(mongoUri);

  try {
    const stats = await cleanupMensaData();
    const mode = dryRun ? 'DRY RUN' : 'UPDATED';

    console.log(
      `[${mode}] Scanned ${stats.scanned} mensa documents, ` +
        `${stats.changedNames} meal names needed whitespace cleanup, ` +
        `${stats.updated} documents updated.`
    );
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(error => {
  console.error('Error cleaning mensa data:', error);
  process.exit(1);
});
