/**
 * Helpers for building embed values that stay inside Discord's hard limits.
 *
 * Discord rejects embed field values longer than 1024 characters, and
 * @discordjs/builders validates this locally, so an oversized value throws
 * before the request is ever sent.
 */

/** Discord's maximum length for an embed field value. */
export const EMBED_FIELD_VALUE_LIMIT = 1024;

/**
 * Truncate text to at most `maxLength` characters, marking cut text with an
 * ellipsis that is itself counted against the budget.
 */
export function truncateText(
  text: string,
  maxLength: number = EMBED_FIELD_VALUE_LIMIT
): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, Math.max(0, maxLength - 3)) + '...';
}

/**
 * Wrap text in a markdown code block, truncating the *content* so that the
 * fences fit inside `maxLength` too. Callers must not budget for the fences
 * themselves — that is what this helper owns.
 */
export function codeBlock(
  text: string,
  maxLength: number = EMBED_FIELD_VALUE_LIMIT
): string {
  const FENCE_OVERHEAD = 6; // ``` + ```
  return `\`\`\`${truncateText(text, maxLength - FENCE_OVERHEAD)}\`\`\``;
}
