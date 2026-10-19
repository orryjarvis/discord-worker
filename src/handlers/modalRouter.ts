import {
  parseIssueModalSubmit,
  type IssueModalParseResult,
} from '@/commands/issue';
import {
  parsePastifyModalSubmit,
  type PastifyModalParseResult,
} from '@/commands/pastify';

type ModalComponentRows = Array<{
  components?: Array<{
    custom_id?: string;
    value?: string;
  }>;
}>;

export function parseCommandModalSubmit(data: {
  customId: string;
  components?: ModalComponentRows;
}): PastifyModalParseResult | IssueModalParseResult {
  const issueResult = parseIssueModalSubmit(data);
  if (issueResult.kind !== 'unknown-modal') {
    return issueResult;
  }

  return parsePastifyModalSubmit(data);
}
