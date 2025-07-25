import { GuildMember, Client } from 'discord.js';
import { MemberStats } from '../../models/stats/memberStats';
import { VoiceActivity } from '../../models/stats/voiceActivity';
import { Logger } from '../../utils/logger';

// Delete all member stats and voice activity data when a member leaves the guild
async function handleGuildMemberRemove(member: GuildMember, client: Client) {
  const guildId = member.guild.id;
  const userId = member.user.id;
  const guildName = member.guild.name;
  const userName = member.user.tag;

  Logger.info(
    'GUILD_MEMBER_REMOVE',
    `Member left server: ${userName} (${userId}) from ${guildName} (${guildId})`
  );

  try {
    // Delete Member Stats for this user in this guild
    const deletedMemberStats = await MemberStats.deleteMany({
      guildId,
      userId,
    });
    Logger.debug(
      'GUILD_MEMBER_REMOVE',
      `${deletedMemberStats.deletedCount} Member Stats entries deleted for ${userName}`
    );

    // Delete Voice Activity entries for this user in this guild
    const deletedVoiceActivity = await VoiceActivity.deleteMany({
      guildId,
      userId,
    });
    Logger.debug(
      'GUILD_MEMBER_REMOVE',
      `${deletedVoiceActivity.deletedCount} Voice Activity entries deleted for ${userName}`
    );

    Logger.info(
      'GUILD_MEMBER_REMOVE',
      `All data for member ${userName} (${userId}) in server ${guildName} (${guildId}) has been successfully deleted from the database`
    );
  } catch (error) {
    Logger.error(
      'GUILD_MEMBER_REMOVE',
      `Error deleting data for member ${userName} (${userId}) in server ${guildName} (${guildId})`,
      error as Error
    );
  }
}

// Export event configuration
module.exports = {
  name: 'guildMemberRemove',
  once: false,
  execute: handleGuildMemberRemove,
};
