import { SlashCommandBuilder, CommandInteraction } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('ping')
  .setDescription('Zeigt die Latenz des Bots an');

export async function execute(interaction: CommandInteraction) {
  const sent = await interaction.reply({
    content: 'Pinging...',
    withResponse: true,
  });

  const sentTimestamp = sent.resource?.message?.createdTimestamp ?? Date.now();
  const roundtripLatency = sentTimestamp - interaction.createdTimestamp;
  const websocketLatency = interaction.client.ws.ping;

  await interaction.editReply({
    content:
      `**Pong!**\n` +
      `**Roundtrip Latenz:** ${roundtripLatency}ms\n` +
      `**WebSocket Latenz:** ${websocketLatency}ms\n` +
      `${getLatencyEmoji(roundtripLatency)} **Status:** ${getLatencyStatus(roundtripLatency)}`,
  });
}

function getLatencyEmoji(latency: number): string {
  if (latency < 100) return '🟢';
  if (latency < 200) return '🟡';
  return '🔴';
}

function getLatencyStatus(latency: number): string {
  if (latency < 100) return 'Excellent';
  if (latency < 200) return 'Good';
  if (latency < 300) return 'Fair';
  return 'Poor';
}
