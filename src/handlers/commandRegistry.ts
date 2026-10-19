import type {
  CommandMap,
  CommandRequest,
  CommandResult,
} from '@/core';
import {
  EIGHT_BALL_COMMAND_NAME,
  handleEightBallCommand,
} from '@/commands/8ball';
import {
  INSULT_COMMAND_NAME,
  handleInsultCommand,
} from '@/commands/insult';
import {
  handleIssueCommand,
  ISSUE_COMMAND_NAME,
} from '@/commands/issue';
import {
  handlePastifyCommand,
  PASTIFY_COMMAND_NAME,
} from '@/commands/pastify';
import {
  handleReleaseCommand,
  RELEASE_COMMAND_NAME,
} from '@/commands/release';
import {
  handleReminderCommand,
  REMINDER_COMMAND_NAME,
} from '@/commands/reminder';
import {
  handleShinyCommand,
  SHINY_COMMAND_NAME,
} from '@/commands/shiny';
import {
  handleScheduledCommand,
  SCHEDULED_COMMAND_NAME,
} from '@/commands/scheduled';
import {
  handleWotdCommand,
  WOTD_COMMAND_NAME,
} from '@/commands/wotd';

export {
  EIGHT_BALL_COMMAND_NAME,
  INSULT_COMMAND_NAME,
  ISSUE_COMMAND_NAME,
  PASTIFY_COMMAND_NAME,
  RELEASE_COMMAND_NAME,
  REMINDER_COMMAND_NAME,
  SHINY_COMMAND_NAME,
  SCHEDULED_COMMAND_NAME,
  WOTD_COMMAND_NAME,
};

export const commands: CommandMap<CommandRequest, CommandResult> = {
  [PASTIFY_COMMAND_NAME]: handlePastifyCommand,
  [INSULT_COMMAND_NAME]: handleInsultCommand,
  [EIGHT_BALL_COMMAND_NAME]: handleEightBallCommand,
  [ISSUE_COMMAND_NAME]: handleIssueCommand,
  [WOTD_COMMAND_NAME]: handleWotdCommand,
  [SHINY_COMMAND_NAME]: handleShinyCommand,
  [SCHEDULED_COMMAND_NAME]: handleScheduledCommand,
  [REMINDER_COMMAND_NAME]: handleReminderCommand,
  [RELEASE_COMMAND_NAME]: handleReleaseCommand,
};
