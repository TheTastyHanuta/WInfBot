import { Client, GuildMember } from 'discord.js';
import {
  GuildSettings,
  IGuildSettingsDocument,
} from '../../models/settings/settings';
import { Logger } from '../../utils/logger';
import { OpenAI } from 'openai';

const AI_WELCOME_PROMPT = `
Erstelle eine lustige und gemeine Willkommensnachricht für ein neues Discord-Server-Mitglied des Wirtschaftsinformatik Discord Servers, indem du wenn möglich den Namen des Mitglieds kreativ einbaust. 
Die Willkommensnachricht soll kreativ oder ein Wortspiel sein. Sie muss aber Sinn ergeben. Auch kannst du dich über den Namen des Members lustig machen oder einen witzigen Bezug zum Namen herstellen. Achte auf einen frechen, humorvollen Ton, der auch sehr gemein sein darf. Nutze dabei verteilt Emojis, aber nicht zu viele.

Wichtige Vorgaben:
- Die Nachricht soll nicht zu lang sein aber mindestens zwei Sätze umfassen.
- Die Nachricht soll auf Deutsch sein. Es dürfen englische Wörter verwendet werden, aber die Nachricht soll auf Deutsch sein.
- Die Begrüßung soll am Anfang den Member per GENAUEN Namen begrüßen.
- Gib NUR die fertige, vollständige Nachricht zurück; KEINE Begründung, KEIN JSON, KEINE Formatierung oder Zusatztexte.

# Output Format
Nur die fertige, ausformulierte Begrüßungsnachricht als Fließtext (keine Listen, kein JSON, keine zusätzlichen Erklärungen oder Metainformationen).

# Beispiele

Beispiel:
Input-Name: 11

Nachricht: Es scheint, als hättest du deine Bewerbung für den Discord-Server des Studiengangs Wirtschaftsinformatik an der FAU Erlangen Nürnberg mit einer Zahl eingereicht, die mehr nach einer Hausnummer als nach einem Namen klingt!😊 Wenn 11 dein Geheimname ist, dann herzlich willkommen, du mysteriöse Ziffer! 🎉
`.trim();

async function handleGuildMemberAdd(member: GuildMember, client: Client) {
  const guildId = member.guild.id;
  const guildName = member.guild.name;
  const userId = member.user.id;
  const userName = member.user.username;

  Logger.debug(
    'GUILD_MEMBER_ADD',
    `User ${userName} (${userId}) joined ${guildName} (${guildId})`
  );

  try {
    // Create or find Guild Settings for the server
    const guildSettings = await GuildSettings.findByGuildId(guildId);

    if (guildSettings.getSetting('welcomeMessages.enabled')) {
      // Send welcome message
      let welcomeMessage = guildSettings
        .getSetting('welcomeMessages.message')
        .replace('{member}', userName) as string;

      if (welcomeMessage.length > 2000 || welcomeMessage.length === 0) {
        Logger.warn(
          'GUILD_MEMBER_ADD',
          `Welcome message for ${userName} in ${guildName} exceeds 2000 characters or is empty`
        );
        return;
      }

      if (welcomeMessage === 'USE_AI') {
        // Generate AI welcome message
        const openai = new OpenAI({ apiKey: process.env.OPEN_AI_API_KEY });
        const response = await openai.responses.create({
          model: 'gpt-5-nano',
          input: [
            {
              role: 'developer',
              content: [
                {
                  type: 'input_text',
                  text: AI_WELCOME_PROMPT,
                },
              ],
            },
            {
              role: 'user',
              content: [
                {
                  type: 'input_text',
                  text: `${userName}`,
                },
              ],
            },
          ],
          text: {
            format: {
              type: 'text',
            },
            verbosity: 'high',
          },
          reasoning: {
            effort: 'medium',
          },
          tools: [],
          store: true,
        });
        if (response) {
          let aiMessage = response.output_text;
          if (
            aiMessage === null ||
            aiMessage?.length === 0 ||
            aiMessage.length > 2000
          ) {
            Logger.warn(
              'GUILD_MEMBER_ADD',
              `AI-generated welcome message for ${userName} in ${guildName} is empty or exceeds 2000 characters`
            );
            return;
          }

          Logger.info(
            'GUILD_MEMBER_ADD',
            `AI-generated welcome message for ${userName} in ${guildName}: ${aiMessage}`
          );
          // Replace username in AI message
          aiMessage = aiMessage.replace(
            `${member.user.username}`,
            `<@${userId}>`
          );

          Logger.debug(
            'GUILD_MEMBER_ADD',
            `AI-generated welcome message for ${userName} in ${guildName}: ${aiMessage}`
          );
          welcomeMessage = aiMessage;
        }
      }

      let targetChannel = null;

      if (guildSettings.getSetting('welcomeMessages.channel')) {
        // Use the designated welcome channel
        targetChannel = member.guild.channels.cache.get(
          guildSettings.getSetting('welcomeMessages.channel')
        );

        if (
          targetChannel &&
          targetChannel.isTextBased() &&
          'send' in targetChannel
        ) {
          try {
            await targetChannel.send(welcomeMessage);
          } catch (error) {
            Logger.error(
              'GUILD_MEMBER_ADD',
              `Failed to send welcome message to channel ${targetChannel.id}`,
              error as Error
            );
          }
        }
      }
    }
  } catch (error) {
    Logger.error(
      'GUILD_MEMBER_ADD',
      `Error initializing data for server ${guildName} (${guildId})`,
      error as Error
    );
  }
}

// Export event configuration
module.exports = {
  name: 'guildMemberAdd',
  once: false,
  execute: handleGuildMemberAdd,
};
