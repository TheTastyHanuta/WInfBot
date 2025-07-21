import { SlashCommandBuilder, CommandInteraction } from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Zeigt die Latenz des Bots an');

export async function execute(interaction: CommandInteraction) {
    // Zeitstempel vor der Antwort
    const sent = await interaction.reply({ 
        content: 'Pinging...', 
        fetchReply: true 
    });
    
    // Berechne die Latenzen
    const roundtripLatency = sent.createdTimestamp - interaction.createdTimestamp;
    const websocketLatency = interaction.client.ws.ping;
    
    // Aktualisiere die Nachricht mit den Latenz-Informationen
    await interaction.editReply({
        content: `**Pong!**\n` +
                `**Roundtrip Latenz:** ${roundtripLatency}ms\n` +
                `**WebSocket Latenz:** ${websocketLatency}ms\n` +
                `${getLatencyEmoji(roundtripLatency)} **Status:** ${getLatencyStatus(roundtripLatency)}`
    });
}

// Hilfsfunktion für Latenz-Emoji
function getLatencyEmoji(latency: number): string {
    if (latency < 100) return '🟢';
    if (latency < 200) return '🟡';
    return '🔴';
}

// Hilfsfunktion für Latenz-Status
function getLatencyStatus(latency: number): string {
    if (latency < 100) return 'Excellent';
    if (latency < 200) return 'Good';
    if (latency < 300) return 'Fair';
    return 'Poor';
}
