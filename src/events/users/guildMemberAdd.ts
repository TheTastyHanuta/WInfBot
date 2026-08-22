import { Client, GuildMember } from 'discord.js';
import { GuildSettings } from '../../models/settings/settings';
import { Logger } from '../../utils/logger';
import { OpenAI } from 'openai';
import config from '../../utils/config';

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
      // Resolve the target channel first: without one nothing can be sent, and
      // generating an AI message below would be paid for and then discarded.
      const welcomeChannelId = guildSettings.getSetting(
        'welcomeMessages.channel'
      );
      const targetChannel = welcomeChannelId
        ? member.guild.channels.cache.get(welcomeChannelId)
        : null;

      if (!targetChannel || !targetChannel.isTextBased()) {
        Logger.warn(
          'GUILD_MEMBER_ADD',
          `Welcome messages are enabled for ${guildName} (${guildId}) but no usable channel is configured`
        );
        return;
      }

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
                  text: config.aiWelcomePrompt,
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

      try {
        // The message contains a member-controlled username, so restrict
        // mentions to users - a member called "@everyone" must not be able to
        // make the bot ping the whole server.
        await targetChannel.send({
          content: welcomeMessage,
          allowedMentions: { parse: ['users'] },
        });
      } catch (error) {
        Logger.error(
          'GUILD_MEMBER_ADD',
          `Failed to send welcome message to channel ${targetChannel.id}`,
          error as Error
        );
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
