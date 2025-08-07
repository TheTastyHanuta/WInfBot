import * as fs from 'fs';
import * as path from 'path';
import fetch from 'node-fetch';
import { parseStringPromise } from 'xml2js';
import moment = require('moment-timezone');
import { Logger } from './logger';

interface MensaDay {
  $: { timestamp: string };
  item: any;
}

interface MensaMeal {
  date: string;
  category: string;
  name: string;
  notes: string[];
  prices: string[];
}

/**
 * Determines food types based on pictogram codes
 */
function getFoodTypes(piktogramme?: string): string {
  if (!piktogramme) {
    return 'Sonstiges';
  }

  let foodTypes = '';

  if (piktogramme.includes('R.png')) foodTypes += 'Rind ';
  if (piktogramme.includes('S.png')) foodTypes += 'Schwein ';
  if (piktogramme.includes('G.png')) foodTypes += 'Geflügel ';
  if (piktogramme.includes('V.png')) foodTypes += 'Vegetarisch ';
  if (piktogramme.includes('F.png')) foodTypes += 'Fisch ';
  if (piktogramme.includes('L.png')) foodTypes += 'Lamm ';
  if (piktogramme.includes('W.png')) foodTypes += 'Wild ';
  if (piktogramme.includes('veg.png')) foodTypes += 'Vegan ';
  if (piktogramme.includes('MSC.png')) foodTypes += 'MSC Fisch ';
  if (piktogramme.includes('CO2.png')) foodTypes += 'CO2 neutral ';

  return foodTypes.trim() || 'Sonstiges';
}

/**
 * Extracts reference codes from title using regex
 */
function getRefs(title: string): string[] {
  if (!title || typeof title !== 'string') return [];

  const refsRegex = /(\([ ,a-zA-Z0-9]*\))/g;
  const splitRefsRegex = /[\(,]([ a-zA-Z0-9]*)/g;

  const rawRefs = title.match(refsRegex) || [];
  const refs: string[] = [];

  rawRefs.forEach(ref => {
    const matches = ref.matchAll(splitRefsRegex);
    for (const match of matches) {
      if (match[1].trim()) {
        refs.push(match[1].trim());
      }
    }
  });

  return refs;
}

/**
 * Builds notes array based on reference codes in title
 */
function buildNotesString(title: string): string[] {
  if (!title || typeof title !== 'string') return [];

  const foodIs: string[] = [];
  const foodContains: string[] = [];
  const refs = getRefs(title);

  refs.forEach(r => {
    // Parse food characteristics
    switch (r) {
      case '1':
        foodIs.push('mit Farbstoffen');
        break;
      case '2':
        foodIs.push('mit Coffein');
        break;
      case '4':
        foodIs.push('mit Konservierungsstoff');
        break;
      case '5':
        foodIs.push('mit Süßungsmittel');
        break;
      case '7':
        foodIs.push('mit Antioxidationsmittel');
        break;
      case '8':
        foodIs.push('mit Geschmacksverstärker');
        break;
      case '9':
        foodIs.push('geschwefelt');
        break;
      case '10':
        foodIs.push('geschwärzt');
        break;
      case '11':
        foodIs.push('gewachst');
        break;
      case '12':
        foodIs.push('mit Phosphat');
        break;
      case '13':
        foodIs.push('mit einer Phenylalaninquelle');
        break;
      case '30':
        foodIs.push('mit Fettglasur');
        break;
      case 'Veg':
      case ' Veg':
        foodIs.push('ist vegetarisch');
        break;

      // Parse allergen information
      case 'a1':
        foodContains.push('mit Gluten');
        break;
      case 'a2':
      case 'G':
        foodContains.push('mit Krebstiere');
        break;
      case 'a3':
      case 'Ei':
        foodContains.push('mit Eier');
        break;
      case 'a4':
        foodContains.push('mit Fisch');
        break;
      case 'a5':
        foodContains.push('mit Erdnüsse');
        break;
      case 'a6':
      case 'So':
        foodContains.push('mit Soja');
        break;
      case 'a7':
      case 'Mi':
        foodContains.push('mit Milch/Laktose');
        break;
      case 'a8':
        foodContains.push('mit Schalenfrüchte');
        break;
      case 'a9':
      case 'Sel':
        foodContains.push('mit Sellerie');
        break;
      case 'a10':
      case 'Sen':
        foodContains.push('mit Senf');
        break;
      case 'a11':
      case 'Ses':
        foodContains.push('mit Sesam');
        break;
      case 'a12':
      case 'Su':
        foodContains.push('mit Schwefeldioxid/Sulfite');
        break;
      case 'a13':
        foodContains.push('mit Lupinen');
        break;
      case 'a14':
        foodContains.push('mit Weichtiere');
        break;
      case 'Wz':
        foodContains.push('mit Weizen');
        break;
      case 'Man':
        foodContains.push('mit Mandeln');
        break;
      default:
        foodContains.push(`mit undefinierter Chemikalie ${r}`);
        break;
    }
  });

  return [...foodIs, ...foodContains];
}

/**
 * Removes reference codes from title to get clean description
 */
function getDescription(title: string): string {
  if (!title || typeof title !== 'string') return '';

  const removeRefsRegex = /\([ ,a-zA-Z0-9]*\)/g;
  return title.replace(removeRefsRegex, '').trim();
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
    const parsedData = await parseStringPromise(xmlData);

    const meals: MensaMeal[] = [];

    // Navigate through the XML structure
    const days = parsedData?.speiseplan?.tag || [];

    days.forEach((day: MensaDay) => {
      const timestamp = parseInt(day.$.timestamp);
      const date = moment
        .unix(timestamp)
        .tz('Europe/Brussels')
        .format('YYYY-MM-DD');

      const items = Array.isArray(day.item) ? day.item : [day.item];

      items.forEach((item: any) => {
        if (!item || !item.title) return;

        // Handle potential array format from xml2js
        let title = item.title;
        if (Array.isArray(title)) {
          title = title[0];
        }
        if (typeof title === 'object' && title._) {
          title = title._;
        }
        if (typeof title !== 'string') {
          title = String(title);
        }

        const description = getDescription(title);
        const notes = buildNotesString(title);

        // Handle prices the same way
        let preis1 = item.preis1;
        let preis2 = item.preis2;
        let preis3 = item.preis3;

        if (Array.isArray(preis1)) preis1 = preis1[0];
        if (Array.isArray(preis2)) preis2 = preis2[0];
        if (Array.isArray(preis3)) preis3 = preis3[0];

        const prices = [
          String(preis1 || ''),
          String(preis2 || ''),
          String(preis3 || ''),
        ];

        // Handle piktogramme
        let piktogramme = item.piktogramme;
        if (Array.isArray(piktogramme)) {
          piktogramme = piktogramme[0];
        }
        if (typeof piktogramme === 'object' && piktogramme._) {
          piktogramme = piktogramme._;
        }

        const foodType = getFoodTypes(piktogramme);

        meals.push({
          date,
          category: foodType,
          name: description,
          notes,
          prices,
        });
      });
    });
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
