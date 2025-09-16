# WInfBot

A Discord bot designed for the Wirtschaftsinformatik Discord Server at FAU Erlangen-Nürnberg. This bot provides a complete suite of server management, user engagement, and moderation tools.

## Features

### Statistics & Ranking System

- **Activity Tracking**: Monitors user activity across text and voice channels
- **Leveling System**: XP-based progression with customizable level-up messages
- **Leaderboards**: Server and member activity rankings with detailed statistics
- **Personal Ranks**: Individual user rank cards with beautiful profile displays

### Audit Logging

- **Message Tracking**: Logs message edits, deletions with full context
- **Moderation Events**: Tracks bans, kicks, and other moderation actions
- **Channel Management**: Logs channel creation, deletion, and updates
- **Role Monitoring**: Tracks role changes and permission updates
- **Event Logging**: Comprehensive audit trail for server events

### Member Management

- **Welcome Messages**: Customizable greetings for new members (including AI-generated messages)
- **Goodbye Messages**: Farewell messages when members leave (not yet implemented)
- **Auto Role**: Automatic role assignment for new members
- **Invite Tracking**: Monitor who brings new members to your server (not yet implemented)

### Easy Configuration

- **Interactive Setup**: Step-by-step configuration wizard with `/setup` command
- **Settings Overview**: Quick overview of all bot settings with `/settings-overview`
- **Granular Control**: Enable/disable specific modules per server
- **Permission Management**: Role-based access control for administrative commands

### Additional Features

- **Mensa Integration**: Automated cafeteria menu updates (FAU-specific)
- **Birthday Messages**: Celebrate member birthdays (not yet implemented)
- **User Tracking**: Detailed analytics for server engagement

## Technology Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Discord.js v14
- **Database**: MongoDB with Mongoose ODM
- **Build System**: tsup for TypeScript compilation
- **Development**: tsx for hot reloading
- **Formatting**: Prettier for code consistency

## Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/TheTastyHanuta/WInfBot.git
   cd WInfBot
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Environment Configuration**
   Create a `.env` file with the following variables:

   ```env
   # Bot Tokens
   BOT_TOKEN=your_production_bot_token
   TEST_BOT_TOKEN=your_development_bot_token
   
   # Client IDs
   CLIENT_ID=your_production_client_id
   TEST_CLIENT_ID=your_development_client_id
   
   # Database
   MONGO_DB_URI=your_mongodb_uri
   TEST_MONGO_DB_URI=your_test_mongodb_uri
   
   # Optional
   OPEN_AI_API_KEY=your_openai_key_for_ai_welcome_messages
   LOG_TIMEZONE=Europe/Berlin
   ```

4. **Build the project**

   ```bash
   npm run build
   ```

5. **Deploy commands**

   ```bash
   npm run deploy:prod  # For production
   npm run deploy:dev   # For development
   ```

6. **Start the bot**

   ```bash
   npm run start:prod   # For production
   npm run start:dev    # For development
   ```

## Development

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm run deploy:dev` - Deploy commands to development environment
- `npm run deploy:prod` - Deploy commands to production environment
- `npm run format` - Format code with Prettier
- `npm run migrate` - Run database migration scripts

### Project Structure

```
src/
├── commands/           # Slash commands
│   ├── misc/          # Utility commands
│   ├── moderation/    # Moderation tools
│   ├── settings/      # Configuration commands
│   └── stats/         # Statistics commands
├── events/            # Discord event handlers
│   ├── channels/      # Channel-related events
│   ├── messages/      # Message events (edit, delete)
│   ├── roles/         # Role events
│   ├── stats/         # Statistics tracking
│   └── users/         # User events (join, leave)
├── handlers/          # Command and event loaders
├── models/            # Database schemas
├── utils/             # Utility functions
└── scripts/           # Migration and utility scripts
```

## Quick Start Guide

1. **Invite the bot** to your server with Administrator permissions
2. **Run `/setup`** to configure the bot using the interactive wizard
3. **Enable desired modules** such as:
   - Audit logging for moderation transparency
   - Welcome/goodbye messages for member engagement
   - Leveling system for user activity rewards
   - Auto role for new member management
4. **Use `/settings-overview`** to review your configuration
5. **Explore statistics** with `/rank` and `/activity-leaderboard`

## Key Commands

- `/setup` - Interactive bot configuration wizard
- `/settings-overview` - View current bot settings
- `/rank [user]` - Display user rank and statistics
- `/activity-leaderboard` - Server activity rankings
- `/welcome-message` - Configure welcome messages
- `/goodbye-message` - Configure goodbye messages
- `/ping` - Check bot responsiveness

## Contributing

This bot is specifically designed for the FAU Wirtschaftsinformatik community. While contributions are welcome, please ensure they align with the project's educational and community focus.

## License

CC0 License - see license file for details

---

*For support or questions, please contact me or create an issue in this repository.*

*This README has mostly been generated by AI because I was too lazy to write it myself.*
