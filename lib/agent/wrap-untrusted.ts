/**
 * Wrap a block of repository-sourced text so the agent treats it as data
 * rather than instructions. The tag is also mentioned in the system prompt,
 * giving the model a consistent signal.
 */
export function wrapUntrusted(kind: string, content: string) {
  const safe = content.replace(/<\/?untrusted[^>]*>/gi, "");
  return `<untrusted kind="${kind}">\n${safe}\n</untrusted>`;
}
