import { Client, EmbedBuilder, TextChannel } from 'discord.js';
import * as cron from 'node-cron';
import {
  getMensaData,
  getInselMensaData,
  getSuedMensaData,
} from '../utils/getMensaData';
import Mensa, { IMensa } from '../models/mensa';
import moment = require('moment-timezone');
import { Logger } from '../utils/logger';

interface MensaMeal {
  date: string;
  category: string;
  name: string;
  notes: string[];
  prices: string[];
}

function delay(milliseconds: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, milliseconds);
  });
}

/**
 * Save Mensa data to the database (only for today)
 */
async function saveMensaDataToDB(canteenName: 'insel' | 'sued'): Promise<void> {
  try {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD format

    Logger.debug(
      'Mensa Handler Database',
      `Fetching data for ${canteenName} for today: ${today}`
    );

    // Fetch data using the getMensaData utility
    const meals: MensaMeal[] =
      canteenName === 'insel'
        ? await getInselMensaData()
        : await getSuedMensaData();

    // Filter only today's meals
    const todayMeals = meals.filter(meal => {
      return meal.date === today;
    });

    if (todayMeals.length === 0) {
      Logger.warn(
        'Mensa Handler Database',
        `No data for today (${today}) in ${canteenName} found.`
      );
      return;
    }

    const date = new Date(today);
    Logger.info(
      'Mensa Handler Database',
      `Saving ${todayMeals.length} meals for ${canteenName} on ${date}`
    );

    // Delete existing entries for today and this canteen
    await Mensa.deleteMany({
      canteenName: canteenName,
      date: date,
    });

    const savedMeals = new Set<string>(); // Track already saved meals to avoid duplicates

    for (const meal of todayMeals) {
      if (!meal.name || !meal.category) continue;

      // Create unique identifier for this meal (category + meal name)
      const mealIdentifier = `${meal.category}|${meal.name.trim()}`;

      // Skip if already processed this meal today
      if (savedMeals.has(mealIdentifier)) {
        Logger.warn(
          'Mensa Handler',
          `Duplicate skipped: ${meal.name.trim()} in ${meal.category} for ${canteenName}`
        );
        continue;
      }

      // Parse prices (convert from strings to numbers)
      const studentPrice =
        parseFloat(meal.prices[0]?.replace(',', '.') || '0') || 0;
      const employeePrice =
        parseFloat(meal.prices[1]?.replace(',', '.') || '0') || 0;
      const otherPrice =
        parseFloat(meal.prices[2]?.replace(',', '.') || '0') || 0;

      const mensaData = new Mensa({
        canteenName: canteenName,
        date: date,
        category: meal.category,
        mealName: meal.name.trim(),
        notes: meal.notes || [],
        prices: {
          student: studentPrice,
          employee: employeePrice,
          other: otherPrice,
        },
      });

      await mensaData.save();

      // Mark this meal as saved
      savedMeals.add(mealIdentifier);
    }

    Logger.info(
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
  canteenName: 'insel' | 'sued',
  today: string,
  client: Client
): Promise<EmbedBuilder | null> {
  try {
    const meals = await Mensa.find({
      canteenName: canteenName,
      date: new Date(today),
    }).sort({ category: 1 });

    if (meals.length === 0) {
      Logger.warn(
        'Mensa Handler Embed',
        `No meals found for ${canteenName} on ${today}.`
      );
      return null;
    }

    const embedConfig =
      canteenName === 'insel'
        ? {
            name: 'Speiseplan der Mensa Insel Schütt',
            url: 'https://www.werkswelt.de/?id=isch',
            color: '#c50f3c' as const,
          }
        : {
            name: 'Speiseplan der Südmensa (Techfak)',
            url: 'https://www.werkswelt.de/index.php?id=sued',
            color: '#063970' as const,
          };

    const embed = new EmbedBuilder()
      .setAuthor({
        name: embedConfig.name,
        url: embedConfig.url,
      })
      .setColor(embedConfig.color)
      .setFooter({
        text: `🌱Vegan, 🥦Vegetarisch, 🐔Huhn, 🐷Schwein, 🐮Rind, 🦌Wild, 🐟Fisch`,
        iconURL: client.user?.displayAvatarURL(),
      })
      .setTimestamp();

    for (const meal of meals) {
      let emoji = '';
      const catName = meal.category;
      if (catName.includes('Geflügel')) emoji += '🐔';
      if (catName.includes('Schwein')) emoji += '🐷';
      if (catName.includes('Rind')) emoji += '🐮';
      if (catName.includes('Lamm')) emoji += '🐑';
      if (catName.includes('Fisch')) emoji += '🐟';
      if (catName.includes('Vegan')) emoji += '🌱';
      if (catName.includes('Vegetarisch')) emoji += '🥦';
      if (catName.includes('Wild')) emoji += '🦌';

      const studentPrice =
        meal.prices.student > 0 ? `${meal.prices.student.toFixed(2)}€` : '–';

      embed.addFields({
        name: `${meal.mealName.trim()} ${emoji}`.trim(),
        value: studentPrice,
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
    cronSchedule = '30 9 * * *'; // Run at 09:30 in development
  } else {
    cronSchedule = '30 9 * * *'; // Run at 09:30 in production
  }

  cron.schedule(
    cronSchedule,
    async () => {
      let channel: TextChannel | undefined;
      if (process.env.NODE_ENV === 'development') {
        channel = guilds
          .get('855096349593436171')
          ?.channels.cache.get('965416088747798529') as TextChannel;
        return; // Skip in development
      } else {
        channel = guilds
          .get('1064489174973042719')
          ?.channels.cache.get('1312531028660715620') as TextChannel;
      }

      if (!channel) {
        Logger.warn('Mensa Cron Job', 'Channel not found');
        return;
      }

      // Skip weekends
      if (moment().day() === 0 || moment().day() === 6) {
        Logger.info('Mensa Cron Job', 'Not weekday');
        return;
      }

      // Skip May 1st (Labor Day)
      if (moment().day() === 1 && moment().month() === 4) {
        Logger.info('Mensa Cron Job', 'First of May');
        return;
      }

      try {
        // Fetch and save data to database
        Logger.debug('Mensa Cron Job', 'Fetching and saving mensa data...');

        await saveMensaDataToDB('insel');
        await delay(1000); // Small delay between requests
        await saveMensaDataToDB('sued');

        await delay(3000); // Wait until database save is complete

        const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD format

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

        await delay(5000);

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
      timezone: 'Europe/Brussels',
    }
  );

  Logger.info(
    'Mensa Cron Job',
    `Mensa cron job initialized with schedule: ${cronSchedule}`
  );
}

// Export functions for potential manual use
export { saveMensaDataToDB, createMensaEmbed };
