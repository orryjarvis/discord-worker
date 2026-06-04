import { createGitHubIssue, type GitHubIssueClientEnv } from '@/integrations/github/issueClient';
import { describeError } from '@/skills/ai';

export type IssueSkillEnv = GitHubIssueClientEnv;

const GITHUB_ISSUE_FAILURE_MESSAGE = 'Could not create GitHub issue right now. Try again in a moment.';

export async function createIssue(
  env: IssueSkillEnv,
  title: string,
  body: string,
  context: { messageId: string; commandName: string },
): Promise<{ content: string }> {
  try {
    const issue = await createGitHubIssue(env, title, body);
    return { content: `Created GitHub issue #${issue.number}: ${issue.htmlUrl}` };
  } catch (error) {
    console.error('GitHub issue creation failed', {
      ...context,
      titleLength: title.length,
      bodyLength: body.length,
      error: describeError(error),
    });
    return { content: GITHUB_ISSUE_FAILURE_MESSAGE };
  }
}
