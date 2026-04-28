import { Client, EmbedBuilder, TextChannel } from 'discord.js';
import * as cron from 'node-cron';
import {
  getInselMensaData,
  getSuedMensaData,
  MensaMeal,
} from '../utils/getMensaData';
import Mensa, { IMensa } from '../models/mensa';
import moment = require('moment-timezone');
import { Logger } from '../utils/logger';

const MENSA_TIMEZONE = 'Europe/Berlin';
type CanteenName = 'insel' | 'sued';

interface CanteenConfig {
  displayName: string;
  menuUrl: string;
  color: `#${string}`;
  fetchMeals: () => Promise<MensaMeal[]>;
}

const CANTEENS: Record<CanteenName, CanteenConfig> = {
  insel: {
    displayName: 'Speiseplan der Mensa Insel Schütt',
    menuUrl: 'https://www.werkswelt.de/?id=isch',
    color: '#c50f3c',
    fetchMeals: getInselMensaData,
  },
  sued: {
    displayName: 'Speiseplan der Südmensa (Techfak)',
    menuUrl: 'https://www.werkswelt.de/index.php?id=sued',
    color: '#063970',
    fetchMeals: getSuedMensaData,
  },
};

const MENSA_CHANNELS = {
  development: {
    guildId: '855096349593436171',
    channelId: '965416088747798529',
  },
  production: {
    guildId: '1064489174973042719',
    channelId: '1312531028660715620',
  },
} as const;

function getTodayString(): string {
  return moment().tz(MENSA_TIMEZONE).format('YYYY-MM-DD');
}

function getDateFromDayString(day: string): Date {
  return moment.utc(day, 'YYYY-MM-DD').startOf('day').toDate();
}

function getLegacyBerlinDateFromDayString(day: string): Date {
  return moment.tz(day, 'YYYY-MM-DD', MENSA_TIMEZONE).startOf('day').toDate();
}

function normalizeMealIdentifier(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLocaleLowerCase('de-DE');
}

function getCompletenessScore(meal: MensaMeal): number {
  return [
    ...Object.values(meal.prices),
    ...Object.values(meal.nutrition),
    ...meal.foodTypes,
    ...meal.sideDishes,
    ...meal.allergens,
    ...meal.additives,
  ].filter(value => value !== null && value !== '').length;
}

function deduplicateMealsForDb(
  canteenName: CanteenName,
  meals: MensaMeal[]
): MensaMeal[] {
  const mealsByIdentifier = new Map<string, MensaMeal>();

  for (const meal of meals) {
    const identifier = [meal.date, normalizeMealIdentifier(meal.name)].join(
      '|'
    );
    const existingMeal = mealsByIdentifier.get(identifier);

    if (!existingMeal) {
      mealsByIdentifier.set(identifier, meal);
      continue;
    }

    if (getCompletenessScore(meal) > getCompletenessScore(existingMeal)) {
      mealsByIdentifier.set(identifier, meal);
    }

    Logger.warn(
      'Mensa Handler',
      `Duplicate skipped: ${meal.name} for ${canteenName}`
    );
  }

  return [...mealsByIdentifier.values()];
}

function formatPrice(price: number | null | undefined): string {
  return price !== null && price !== undefined && price > 0
    ? `${price.toFixed(2)}€`
    : '–';
}

function formatKcal(kcal: number | null | undefined): string {
  return kcal !== null && kcal !== undefined ? `${Math.round(kcal)} kcal` : '';
}

function formatProtein(protein: number | null | undefined): string {
  return protein !== null && protein !== undefined
    ? `${protein.toFixed(1)}g Eiweiß`
    : '';
}

function buildMealEmoji(meal: IMensa): string {
  const foodTypes = meal.foodTypes || [];
  let emoji = '';

  if (foodTypes.some(foodType => foodType.includes('Geflügel'))) emoji += '🐔';
  if (foodTypes.some(foodType => foodType.includes('Schwein'))) emoji += '🐷';
  if (foodTypes.some(foodType => foodType.includes('Rind'))) emoji += '🐮';
  if (foodTypes.some(foodType => foodType.includes('Lamm'))) emoji += '🐑';
  if (foodTypes.some(foodType => foodType.includes('Fisch'))) emoji += '🐟';
  if (foodTypes.some(foodType => foodType.includes('Vegan'))) emoji += '🌱';
  if (foodTypes.some(foodType => foodType.includes('Vegetarisch')))
    emoji += '🥦';
  if (foodTypes.some(foodType => foodType.includes('Wild'))) emoji += '🦌';

  return emoji;
}

function truncateDiscordField(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}…`;
}

/**
 * Save Mensa data to the database (only for today)
 */
async function saveMensaDataToDB(canteenName: 'insel' | 'sued'): Promise<void> {
  try {
    const today = getTodayString();
    const canteenConfig = CANTEENS[canteenName];

    Logger.debug(
      'Mensa Handler Database',
      `Fetching data for ${canteenName} for today: ${today}`
    );

    const meals = await canteenConfig.fetchMeals();
    const todayMeals = deduplicateMealsForDb(
      canteenName,
      meals.filter(meal => meal.date === today)
    );

    if (todayMeals.length === 0) {
      Logger.warn(
        'Mensa Handler Database',
        `No data for today (${today}) in ${canteenName} found.`
      );
      return;
    }

    const date = getDateFromDayString(today);
    const documents = todayMeals
      .filter(meal => meal.name)
      .map(meal => ({
        canteenName: canteenName,
        date: date,
        mealName: meal.name,
        allergens: meal.allergens || [],
        additives: meal.additives || [],
        foodTypes: meal.foodTypes || [],
        sideDishes: meal.sideDishes || [],
        prices: meal.prices,
        nutrition: meal.nutrition,
      }));

    if (documents.length === 0) {
      Logger.warn(
        'Mensa Handler Database',
        `No valid meals for today (${today}) in ${canteenName} found.`
      );
      return;
    }

    Logger.info(
      'Mensa Handler Database',
      `Saving ${documents.length} meals for ${canteenName} on ${date}`
    );

    await Mensa.deleteMany({
      canteenName: canteenName,
      date: {
        $in: [date, getLegacyBerlinDateFromDayString(today)],
      },
    });

    await Mensa.insertMany(documents);

    Logger.debug(
      'Mensa Handler',
      `Mensa data for ${canteenName} (today: ${date}) successfully saved to database`
    );
  } catch (error) {
    Logger.error(
      'Mensa Handler',
      `Error saving mensa data for ${canteenName}:`,
      error as Error
    );
  }
}

/**
 * Function to create an embed from database data
 */
async function createMensaEmbed(
  canteenName: CanteenName,
  today: string,
  client: Client
): Promise<EmbedBuilder | null> {
  try {
    const meals = await Mensa.find({
      canteenName: canteenName,
      date: getDateFromDayString(today),
    }).sort({ mealName: 1 });

    if (meals.length === 0) {
      Logger.debug(
        'Mensa Handler Embed',
        `No meals found for ${canteenName} on ${today}.`
      );
      return null;
    }

    const canteenConfig = CANTEENS[canteenName];

    const embed = new EmbedBuilder()
      .setAuthor({
        name: canteenConfig.displayName,
        url: canteenConfig.menuUrl,
      })
      .setColor(canteenConfig.color)
      .setFooter({
        text: `🌱Vegan, 🥦Vegetarisch, 🐔Huhn, 🐷Schwein, 🐮Rind, 🦌Wild, 🐟Fisch`,
        iconURL: client.user?.displayAvatarURL(),
      })
      .setTimestamp();

    for (const meal of meals) {
      const emoji = buildMealEmoji(meal);
      const kcal = formatKcal(meal.nutrition?.kcal);
      const protein = formatProtein(meal.nutrition?.protein);
      const compactDetails = [formatPrice(meal.prices?.student), kcal, protein]
        .filter(Boolean)
        .join(' · ');
      const sideDishes =
        meal.sideDishes?.length > 0
          ? `\nBeilage: ${meal.sideDishes.join(', ')}`
          : '';

      embed.addFields({
        name: truncateDiscordField(
          `${meal.mealName.trim()} ${emoji}`.trim(),
          256
        ),
        value: truncateDiscordField(`${compactDetails}${sideDishes}`, 1024),
        inline: true,
      });
    }

    return embed;
  } catch (error) {
    Logger.error(
      'Mensa Handler',
      `Error creating embed for ${canteenName}:`,
      error as Error
    );
    return null;
  }
}

/**
 * Initialize the mensa cron job
 */
export default function initializeMensaCron(client: Client): void {
  const guilds = client.guilds.cache;

  let cronSchedule: string;
  // Use different cron schedule for development and production
  if (process.env.NODE_ENV === 'development') {
    cronSchedule = '38 15 * * *'; // Run at 14:22 in development
  } else {
    cronSchedule = '30 9 * * *'; // Run at 09:30 in production
  }

  cron.schedule(
    cronSchedule,
    async () => {
      let channel: TextChannel | undefined;
      if (process.env.NODE_ENV === 'development') {
        const channelConfig = MENSA_CHANNELS.development;
        channel = guilds
          .get(channelConfig.guildId)
          ?.channels.cache.get(channelConfig.channelId) as TextChannel;
        // return; // Skip in development
      } else {
        const channelConfig = MENSA_CHANNELS.production;
        channel = guilds
          .get(channelConfig.guildId)
          ?.channels.cache.get(channelConfig.channelId) as TextChannel;
      }

      if (!channel) {
        Logger.warn('Mensa Cron Job', 'Channel not found');
        return;
      }

      // Skip weekends
      const now = moment().tz(MENSA_TIMEZONE);

      if (now.day() === 0 || now.day() === 6) {
        Logger.info('Mensa Cron Job', 'Not weekday');
        return;
      }

      // Skip May 1st (Labor Day)
      if (now.date() === 1 && now.month() === 4) {
        Logger.info('Mensa Cron Job', 'First of May');
        return;
      }

      try {
        // Fetch and save data to database
        Logger.debug('Mensa Cron Job', 'Fetching and saving mensa data...');

        await saveMensaDataToDB('insel');
        await saveMensaDataToDB('sued');

        const today = getTodayString();

        // Create and send Insel Schütt embed from database
        const embedInsel = await createMensaEmbed('insel', today, client);
        if (embedInsel) {
          Logger.info('Mensa Cron Job', 'Sending Insel Schütt message');
          await channel.send({ embeds: [embedInsel] });
        } else {
          Logger.warn(
            'Mensa Cron Job',
            `No menu found for Insel Schütt ${today}.`
          );
        }

        // Create and send Südmensa embed from database
        const embedSued = await createMensaEmbed('sued', today, client);
        if (embedSued) {
          Logger.info('Mensa Cron Job', 'Sending Südmensa message');
          await channel.send({ embeds: [embedSued] });
        } else {
          Logger.warn('Mensa Cron Job', `No menu found for Südmensa ${today}.`);
        }
      } catch (error) {
        Logger.error(
          'Mensa Cron Job',
          'Error occurred while fetching mensa data',
          error as Error
        );
      }
    },
    {
      timezone: MENSA_TIMEZONE,
    }
  );

  Logger.info(
    'Mensa Cron Job',
    `Mensa cron job initialized with schedule: ${cronSchedule}`
  );
}

// Export functions for potential manual use
export { saveMensaDataToDB, createMensaEmbed };
