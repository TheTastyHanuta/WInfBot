import assert from 'node:assert/strict';
import {
  cleanMealName,
  extractFoodTypes,
  parseDecimal,
  parseMensaXml,
} from '../src/utils/getMensaData';

async function testParserHelpers(): Promise<void> {
  assert.equal(
    cleanMealName('Röstiecken (Gf)  mit Apfelmus und Zimt/Zucker (7)'),
    'Röstiecken mit Apfelmus und Zimt/Zucker'
  );

  assert.equal(
    cleanMealName(
      'Blumenkohlragout "Indische Art" (scharf) (7,Wz,So,Sel) Basmatireis'
    ),
    'Blumenkohlragout "Indische Art" (scharf) Basmatireis'
  );

  assert.equal(
    cleanMealName(
      'Portion Stangenspargel warm (ca. 200 Gr.) mit veganer Buttersoße (veg.1,B,Wz,So)'
    ),
    'Portion Stangenspargel warm (ca. 200 Gr.) mit veganer Buttersoße'
  );

  assert.equal(parseDecimal('38,2'), 38.2);
  assert.equal(parseDecimal(''), null);
  assert.equal(parseDecimal('-'), null);

  assert.deepEqual(
    extractFoodTypes(
      "<img src='https://www.max-manager.de/daten-extern/sw-erlangen-nuernberg/icons/veg.png?v=2'><img src='https://www.max-manager.de/daten-extern/sw-erlangen-nuernberg/icons/CO2.png?v=2'>"
    ),
    ['Vegan', 'CO2 neutral']
  );
}

async function testXmlParsing(): Promise<void> {
  const xml = `<?xml version='1.0' encoding='utf-8'?>
<speiseplan locationId='1'>
  <tag timestamp='1777240800'>
    <item>
      <category>Essen 1</category>
      <title>Röstiecken (Gf)  mit Apfelmus und Zimt/Zucker (7)</title>
      <beilagen>Optional: Pommes frites</beilagen>
      <preis1>2,00</preis1>
      <preis2></preis2>
      <preis3>-</preis3>
      <einheit></einheit>
      <piktogramme>&lt;img src='https://www.max-manager.de/daten-extern/sw-erlangen-nuernberg/icons/veg.png?v=2'&gt;</piktogramme>
      <kj></kj>
      <kcal></kcal>
      <fett></fett>
      <gesfett></gesfett>
      <kh></kh>
      <zucker></zucker>
      <ballaststoffe></ballaststoffe>
      <eiweiss></eiweiss>
      <salz></salz>
      <foto></foto>
    </item>
    <item>
      <category>Essen 1</category>
      <title>Röstiecken (Gf) mit Apfelmus und Zimt/Zucker (7)</title>
      <beilagen>Optional: Pommes frites</beilagen>
      <preis1>2,00</preis1>
      <preis2></preis2>
      <preis3>-</preis3>
      <einheit></einheit>
      <piktogramme>&lt;img src='https://www.max-manager.de/daten-extern/sw-erlangen-nuernberg/icons/veg.png?v=2'&gt;</piktogramme>
      <kj>2458.0</kj>
      <kcal>587.0</kcal>
      <fett>31.8</fett>
      <gesfett>3.3</gesfett>
      <kh>67.2</kh>
      <zucker>25.8</zucker>
      <ballaststoffe>6.7</ballaststoffe>
      <eiweiss>4.3</eiweiss>
      <salz>1.9</salz>
      <foto></foto>
    </item>
  </tag>
</speiseplan>`;

  const meals = await parseMensaXml(xml, 'https://example.invalid/mensa.xml');

  assert.equal(meals.length, 1);
  assert.equal(meals[0].name, 'Röstiecken mit Apfelmus und Zimt/Zucker');
  assert.deepEqual(meals[0].sideDishes, ['Pommes frites']);
  assert.deepEqual(meals[0].foodTypes, ['Vegan']);
  assert.equal(meals[0].prices.student, 2);
  assert.equal(meals[0].prices.employee, null);
  assert.equal(meals[0].prices.other, null);
  assert.equal(meals[0].nutrition.kcal, 587);
  assert.equal(meals[0].nutrition.fat, 31.8);
}

async function run(): Promise<void> {
  await testParserHelpers();
  await testXmlParsing();
}

run().catch(error => {
  console.error(error);
  process.exit(1);
});
