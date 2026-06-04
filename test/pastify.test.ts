import { describe, expect, it } from 'vitest';
import { extractAiText } from '@/commands/pastify';

describe('extractAiText', () => {
  it('returns direct response text', () => {
    const result = extractAiText({ response: '  DIRECT TEXT  ' });
    expect(result).toBe('DIRECT TEXT');
  });

  it('returns choices message content text', () => {
    const result = extractAiText({
      choices: [
        {
          message: {
            content: 'FROM CHOICES',
          },
        },
      ],
    });

    expect(result).toBe('FROM CHOICES');
  });

  it('returns concatenated output content text', () => {
    const result = extractAiText({
      output: [
        {
          content: [
            { type: 'output_text', text: 'LINE ONE' },
            { type: 'output_text', text: 'LINE TWO' },
          ],
        },
      ],
    });

    expect(result).toBe('LINE ONE\nLINE TWO');
  });

  it('returns nested result choices text', () => {
    const result = extractAiText({
      result: {
        choices: [
          {
            message: {
              content: 'NESTED CONTENT',
            },
          },
        ],
      },
    });

    expect(result).toBe('NESTED CONTENT');
  });

  it('returns null when no text can be extracted', () => {
    const result = extractAiText({
      output: [{ content: [{ type: 'image', url: 'https://example.com' }] }],
    });

    expect(result).toBeNull();
  });
});
