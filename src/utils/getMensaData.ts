import * as fs from 'fs';
import * as path from 'path';
import fetch from 'node-fetch';
import { parseStringPromise } from 'xml2js';
import moment = require('moment-timezone');
import { Logger } from './logger';

const MENSA_TIMEZONE = 'Europe/Berlin';

interface MensaDay {
  $?: { timestamp?: string };
  item?: unknown;
}

export interface MensaPrices {
  student: number | null;
  employee: number | null;
  other: number | null;
}

export interface MensaNutrition {
  kj: number | null;
  kcal: number | null;
  fat: number | null;
  saturatedFat: number | null;
  carbohydrates: number | null;
  sugar: number | null;
  fiber: number | null;
  protein: number | null;
  salt: number | null;
}

export interface MensaMeal {
  date: string;
  name: string;
  allergens: string[];
  additives: string[];
  foodTypes: string[];
  sideDishes: string[];
  prices: MensaPrices;
  nutrition: MensaNutrition;
}

const ADDITIVE_LABELS: Record<string, string> = {
  '1': 'mit Farbstoffen',
  '2': 'mit Coffein',
  '4': 'mit Konservierungsstoff',
  '5': 'mit Süßungsmittel',
  '7': 'mit Antioxidationsmittel',
  '8': 'mit Geschmacksverstärker',
  '9': 'geschwefelt',
  '10': 'geschwärzt',
  '11': 'gewachst',
  '12': 'mit Phosphat',
  '13': 'mit einer Phenylalaninquelle',
  '30': 'mit Fettglasur',
};

const ALLERGEN_LABELS: Record<string, string> = {
  a1: 'mit Gluten',
  a2: 'mit Krebstiere',
  a3: 'mit Eier',
  a4: 'mit Fisch',
  a5: 'mit Erdnüsse',
  a6: 'mit Soja',
  a7: 'mit Milch/Laktose',
  a8: 'mit Schalenfrüchte',
  a9: 'mit Sellerie',
  a10: 'mit Senf',
  a11: 'mit Sesam',
  a12: 'mit Schwefeldioxid/Sulfite',
  a13: 'mit Lupinen',
  a14: 'mit Weichtiere',
  Wz: 'mit Weizen',
  Ro: 'mit Roggen',
  Ge: 'mit Gerste',
  Hf: 'mit Hafer',
  Kr: 'mit Krebstiere',
  Ei: 'mit Eier',
  Fi: 'mit Fisch',
  Er: 'mit Erdnüsse',
  So: 'mit Soja',
  Mi: 'mit Milch/Laktose',
  Man: 'mit Mandeln',
  Hs: 'mit Haselnüsse',
  Wa: 'mit Walnüsse',
  Ka: 'mit Cashewnüsse',
  Pe: 'mit Pekannüsse',
  Pa: 'mit Paranüsse',
  Pi: 'mit Pistazien',
  Mac: 'mit Macadamianüsse',
  Sel: 'mit Sellerie',
  Sen: 'mit Senf',
  Ses: 'mit Sesam',
  Su: 'mit Schwefeldioxid/Sulfite',
  Lu: 'mit Lupinen',
  We: 'mit Weichtiere',
};

const DIET_TAG_LABELS: Record<string, string> = {
  Veg: 'ist vegetarisch',
  veg: 'ist vegan',
  V: 'ist vegetarisch',
  Gf: 'glutenfrei',
  GF: 'glutenfrei',
  R: 'mit Rind',
  S: 'mit Schwein',
  G: 'mit Geflügel',
  L: 'mit Lamm',
  W: 'mit Wild',
  F: 'mit Fisch',
  A: 'mit Alkohol',
  B: 'Bio',
  MV: 'MensaVital',
  CO2: 'CO2 neutral',
  MSC: 'MSC Fisch',
};

const FOOD_TYPE_BY_ICON: Record<string, string> = {
  R: 'Rind',
  S: 'Schwein',
  G: 'Geflügel',
  V: 'Vegetarisch',
  F: 'Fisch',
  L: 'Lamm',
  W: 'Wild',
  veg: 'Vegan',
  MSC: 'MSC Fisch',
  CO2: 'CO2 neutral',
  Gf: 'Glutenfrei',
  A: 'Alkohol',
  B: 'Bio',
  MV: 'MensaVital',
};

const RECOGNIZED_TAGS = new Set([
  ...Object.keys(ADDITIVE_LABELS),
  ...Object.keys(ALLERGEN_LABELS),
  ...Object.keys(DIET_TAG_LABELS),
]);

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function firstXmlValue(value: unknown): unknown {
  if (Array.isArray(value)) return value[0];
  return value;
}

export function getXmlString(
  item: Record<string, unknown>,
  key: string
): string {
  const rawValue = firstXmlValue(item[key]);

  if (rawValue === null || rawValue === undefined) return '';

  if (typeof rawValue === 'string') return normalizeWhitespace(rawValue);

  if (typeof rawValue === 'number') return String(rawValue);

  if (typeof rawValue === 'object' && '_' in rawValue) {
    return normalizeWhitespace(String((rawValue as { _: unknown })._));
  }

  return normalizeWhitespace(String(rawValue));
}

export function parseDecimal(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (!normalized || normalized === '-') return null;

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parsePrices(item: Record<string, unknown>): MensaPrices {
  return {
    student: parseDecimal(getXmlString(item, 'preis1')),
    employee: parseDecimal(getXmlString(item, 'preis2')),
    other: parseDecimal(getXmlString(item, 'preis3')),
  };
}

export function parseNutrition(item: Record<string, unknown>): MensaNutrition {
  return {
    kj: parseDecimal(getXmlString(item, 'kj')),
    kcal: parseDecimal(getXmlString(item, 'kcal')),
    fat: parseDecimal(getXmlString(item, 'fett')),
    saturatedFat: parseDecimal(getXmlString(item, 'gesfett')),
    carbohydrates: parseDecimal(getXmlString(item, 'kh')),
    sugar: parseDecimal(getXmlString(item, 'zucker')),
    fiber: parseDecimal(getXmlString(item, 'ballaststoffe')),
    protein: parseDecimal(getXmlString(item, 'eiweiss')),
    salt: parseDecimal(getXmlString(item, 'salz')),
  };
}

function normalizeTag(tag: string): string {
  const trimmed = tag.trim();

  switch (trimmed) {
    case 'VEG':
      return 'Veg';
    case 'GF':
      return 'Gf';
    case 'Fi':
      return 'Fi';
    default:
      return trimmed;
  }
}

function parseTagGroup(content: string): string[] {
  return content
    .split(',')
    .flatMap(tag => tag.split('.'))
    .map(normalizeTag)
    .filter(Boolean);
}

export function extractRecognizedTagGroups(title: string): string[][] {
  const groups: string[][] = [];
  const parenthesisRegex = /\(([^()]*)\)/g;

  for (const match of title.matchAll(parenthesisRegex)) {
    const tags = parseTagGroup(match[1]);

    if (tags.length > 0 && tags.every(tag => RECOGNIZED_TAGS.has(tag))) {
      groups.push(tags);
    }
  }

  return groups;
}

export function cleanMealName(title: string): string {
  const parenthesisRegex = /\(([^()]*)\)/g;

  return normalizeWhitespace(
    title.replace(parenthesisRegex, (fullMatch, content: string) => {
      const tags = parseTagGroup(content);

      return tags.length > 0 && tags.every(tag => RECOGNIZED_TAGS.has(tag))
        ? ''
        : fullMatch;
    })
  );
}

export function extractTags(title: string): string[] {
  return unique(extractRecognizedTagGroups(title).flat());
}

export function buildNotes(title: string): {
  allergens: string[];
  additives: string[];
} {
  const allergens: string[] = [];
  const additives: string[] = [];

  for (const tag of extractTags(title)) {
    if (ADDITIVE_LABELS[tag]) additives.push(ADDITIVE_LABELS[tag]);
    if (ALLERGEN_LABELS[tag]) allergens.push(ALLERGEN_LABELS[tag]);
  }

  return {
    allergens: unique(allergens),
    additives: unique(additives),
  };
}

export function extractFoodTypes(piktogramme: string): string[] {
  const iconRegex = /\/([A-Za-z0-9]+)\.png(?:\?|['"&\s>])/g;
  const foodTypes: string[] = [];

  for (const match of piktogramme.matchAll(iconRegex)) {
    const iconCode = match[1];
    const foodType = FOOD_TYPE_BY_ICON[iconCode];
    if (foodType) foodTypes.push(foodType);
  }

  return unique(foodTypes);
}

export function parseSideDishes(beilagen: string): string[] {
  const cleaned = cleanMealName(beilagen).replace(/^Optional:\s*/i, '');

  if (!cleaned) return [];

  return unique(
    cleaned
      .split(',')
      .map(sideDish => normalizeWhitespace(sideDish))
      .filter(Boolean)
  );
}

function hasNutrition(meal: MensaMeal): boolean {
  return Object.values(meal.nutrition).some(value => value !== null);
}

function mealCompletenessScore(meal: MensaMeal): number {
  return [
    ...Object.values(meal.nutrition),
    ...Object.values(meal.prices),
    ...meal.foodTypes,
    ...meal.allergens,
    ...meal.additives,
    ...meal.sideDishes,
  ].filter(value => value !== null && value !== '').length;
}

function normalizeIdentifierValue(value: string): string {
  return normalizeWhitespace(value).toLocaleLowerCase('de-DE');
}

export function deduplicateMeals(meals: MensaMeal[]): MensaMeal[] {
  const byIdentifier = new Map<string, MensaMeal>();

  for (const meal of meals) {
    const identifier = [meal.date, normalizeIdentifierValue(meal.name)].join(
      '|'
    );
    const existingMeal = byIdentifier.get(identifier);

    if (!existingMeal) {
      byIdentifier.set(identifier, meal);
      continue;
    }

    const preferNewMeal =
      !hasNutrition(existingMeal) ||
      mealCompletenessScore(meal) > mealCompletenessScore(existingMeal);

    if (preferNewMeal) byIdentifier.set(identifier, meal);

    Logger.warn(
      'getMensaData',
      `Duplicate skipped: ${meal.name} on ${meal.date}`
    );
  }

  return [...byIdentifier.values()];
}

export async function parseMensaXml(
  xmlData: string,
  _sourceUrl?: string
): Promise<MensaMeal[]> {
  const parsedData = await parseStringPromise(xmlData);
  const meals: MensaMeal[] = [];
  const days = parsedData?.speiseplan?.tag || [];

  for (const day of Array.isArray(days) ? days : [days]) {
    const mensaDay = day as MensaDay;
    const timestamp = Number.parseInt(String(mensaDay.$?.timestamp || ''), 10);
    if (!Number.isFinite(timestamp)) continue;

    const date = moment.unix(timestamp).tz(MENSA_TIMEZONE).format('YYYY-MM-DD');
    const items = Array.isArray(mensaDay.item)
      ? mensaDay.item
      : [mensaDay.item];

    for (const rawItem of items) {
      if (!rawItem || typeof rawItem !== 'object') continue;

      const item = rawItem as Record<string, unknown>;
      const rawTitle = getXmlString(item, 'title');
      if (!rawTitle) continue;

      const piktogramme = getXmlString(item, 'piktogramme');
      const foodTypes = extractFoodTypes(piktogramme);
      const { allergens, additives } = buildNotes(rawTitle);
      const name = cleanMealName(rawTitle);

      meals.push({
        date,
        name,
        allergens,
        additives,
        foodTypes,
        sideDishes: parseSideDishes(getXmlString(item, 'beilagen')),
        prices: parsePrices(item),
        nutrition: parseNutrition(item),
      });
    }
  }

  return deduplicateMeals(meals);
}

/**
 * Fetches and parses XML data from the given URL
 */
export async function getMensaData(url: string): Promise<MensaMeal[]> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const xmlData = await response.text();
    const meals = await parseMensaXml(xmlData, url);

    Logger.debug('getMensaData', `Fetched ${meals.length} meals from ${url}`);
    return meals;
  } catch (error) {
    Logger.error('getMensaData', `Error fetching mensa data:`, error as Error);
    throw error;
  }
}

/**
 * Convenience function to get data from Insel Schütt Mensa
 */
export async function getInselMensaData(): Promise<MensaMeal[]> {
  return getMensaData(
    'https://www.max-manager.de/daten-extern/sw-erlangen-nuernberg/xml/mensa-inselschuett.xml'
  );
}

/**
 * Convenience function to get data from Südmensa
 */
export async function getSuedMensaData(): Promise<MensaMeal[]> {
  return getMensaData(
    'https://www.max-manager.de/daten-extern/sw-erlangen-nuernberg/xml/mensa-sued.xml'
  );
}

/**
 * Saves mensa data to XML file (optional functionality)
 */
export async function saveMensaDataToFile(
  url: string,
  filename: string
): Promise<void> {
  try {
    const response = await fetch(url);
    const xmlData = await response.text();

    const outputDir = path.join(__dirname, '..', '..', 'data');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const filePath = path.join(outputDir, filename);
    fs.writeFileSync(filePath, xmlData, 'utf8');

    console.log(`Mensa data saved to: ${filePath}`);
  } catch (error) {
    console.error('Error saving mensa data:', error);
    throw error;
  }
}
