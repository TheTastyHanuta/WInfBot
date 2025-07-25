import { Client, GuildMember } from 'discord.js';
import {
  GuildSettings,
  IGuildSettingsDocument,
} from '../../models/settings/settings';
import { Logger } from '../../utils/logger';
import { OpenAI } from 'openai';

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
        const response = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: [
                {
                  type: 'text',
                  text: 'Du bist ein Bot, der relativ kurze Beitrittsankündigungen für den Discord-Server des Studiengangs Wirtschaftsinformatik an der FAU Erlangen Nürnberg. Sie sollte lustig sein und darf die Person ärgern aber nicht erzwungen wirken. Versuche, den Namen der Person mit in die Nachricht ein zu beziehen. Nenne dabei den GENAUEN Namen mit der selben Schreibweise, wie dir gegeben wird!! Du darfst dich auch über die Person lustig machen und schwarzen Humor verwenden! Deine Antwort muss auf Deutsch sein!',
                },
              ],
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `${member.user.username}`,
                },
              ],
            },
          ],
          temperature: 0.8,
          max_tokens: 130,
          top_p: 1,
          frequency_penalty: 0,
          presence_penalty: 0,
        });
        if (response.choices && response.choices.length > 0) {
          let aiMessage = response.choices[0].message.content;

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
