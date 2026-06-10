import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  type RESTPostAPIApplicationCommandsJSONBody,
} from 'discord-api-types/v10';

const PASTIFY_COMMAND = {
  name: 'pastify',
  description: 'Turn an idea into a Twitch-style copypasta',
  type: ApplicationCommandType.ChatInput,
} satisfies RESTPostAPIApplicationCommandsJSONBody;

const INSULT_COMMAND = {
  name: 'insult',
  description: 'Light-heartedly roast the selected user',
  type: ApplicationCommandType.ChatInput,
  options: [
    {
      name: 'target',
      description: 'Who should get roasted?',
      type: ApplicationCommandOptionType.User,
      required: true,
    },
  ],
} satisfies RESTPostAPIApplicationCommandsJSONBody;

const INSULT_USER_COMMAND = {
  name: 'insult',
  type: ApplicationCommandType.User,
} satisfies RESTPostAPIApplicationCommandsJSONBody;

const EIGHT_BALL_MESSAGE_COMMAND = {
  name: '8ball',
  type: ApplicationCommandType.Message,
} satisfies RESTPostAPIApplicationCommandsJSONBody;

const WOTD_COMMAND = {
  name: 'wotd',
  description: 'Queue a manual word-of-day post to the configured channel',
  type: ApplicationCommandType.ChatInput,
} satisfies RESTPostAPIApplicationCommandsJSONBody;

const SHINY_COMMAND = {
  name: 'shiny',
  description: 'Roll an integer from 1 to 8192. Hit 8192 to encounter a shiny!',
  type: ApplicationCommandType.ChatInput,
} satisfies RESTPostAPIApplicationCommandsJSONBody;

const ISSUE_COMMAND = {
  name: 'issue',
  description: 'Create a GitHub issue from Discord',
  type: ApplicationCommandType.ChatInput,
} satisfies RESTPostAPIApplicationCommandsJSONBody;

const REMINDER_COMMAND = {
  name: 'reminder',
  description: 'Schedule a reminder',
  type: ApplicationCommandType.ChatInput,
  options: [
    {
      name: 'length',
      description: 'How long to wait before reminding you',
      type: ApplicationCommandOptionType.Integer,
      required: true,
      min_value: 1,
    },
    {
      name: 'interval',
      description: 'The reminder interval unit',
      type: ApplicationCommandOptionType.String,
      required: true,
      choices: [
        {
          name: 'minutes',
          value: 'minutes',
        },
        {
          name: 'hours',
          value: 'hours',
        },
        {
          name: 'days',
          value: 'days',
        },
      ],
    },
    {
      name: 'note',
      description: 'What should I remind you about?',
      type: ApplicationCommandOptionType.String,
      required: true,
      min_length: 1,
      max_length: 1000,
    },
  ],
} satisfies RESTPostAPIApplicationCommandsJSONBody;

const RELEASE_COMMAND = {
  name: 'release',
  description: 'Track upcoming game releases and hype reminders',
  type: ApplicationCommandType.ChatInput,
  options: [
    {
      name: 'list',
      description: 'List tracked releases',
      type: ApplicationCommandOptionType.Subcommand,
    },
    {
      name: 'set',
      description: 'Create or overwrite a tracked release',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'title',
          description: 'Game title',
          type: ApplicationCommandOptionType.String,
          required: true,
          min_length: 1,
          max_length: 200,
        },
        {
          name: 'year',
          description: 'Release year (e.g. 2027)',
          type: ApplicationCommandOptionType.Integer,
          required: false,
          min_value: 1970,
          max_value: 3000,
        },
        {
          name: 'quarter',
          description: 'Release quarter',
          type: ApplicationCommandOptionType.Integer,
          required: false,
          min_value: 1,
          max_value: 4,
        },
        {
          name: 'month',
          description: 'Release month (1-12)',
          type: ApplicationCommandOptionType.Integer,
          required: false,
          min_value: 1,
          max_value: 12,
        },
        {
          name: 'day',
          description: 'Release day of month',
          type: ApplicationCommandOptionType.Integer,
          required: false,
          min_value: 1,
          max_value: 31,
        },
      ],
    },
  ],
} satisfies RESTPostAPIApplicationCommandsJSONBody;

async function deployCommands() {
  const applicationId = process.env.DISCORD_APPLICATION_ID;
  const botToken = process.env.DISCORD_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;

  if (!applicationId || !botToken || !guildId) {
    console.error('DISCORD_APPLICATION_ID, DISCORD_GUILD_ID, and DISCORD_TOKEN are required');
    process.exit(1);
  }

  const url = `https://discord.com/api/v10/applications/${applicationId}/guilds/${guildId}/commands`;

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bot ${botToken}`,
    },
    body: JSON.stringify([
      PASTIFY_COMMAND,
      INSULT_COMMAND,
      INSULT_USER_COMMAND,
      EIGHT_BALL_MESSAGE_COMMAND,
      WOTD_COMMAND,
      SHINY_COMMAND,
      ISSUE_COMMAND,
      REMINDER_COMMAND,
      RELEASE_COMMAND,
    ]),
  });

  if (!response.ok) {
    throw new Error(`Error registering commands: ${response.status} ${await response.text()}`);
  }

  console.log('Registered commands: pastify, insult (slash), insult (user), 8ball (message), wotd, shiny, issue, reminder, release');
}

void deployCommands().catch((error: unknown) => {
  console.error('Failed to deploy commands', error);
  process.exitCode = 1;
});
