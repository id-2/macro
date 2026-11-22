export function isProgramParticipant(
  attributes: Record<string, string> | undefined
): boolean {
  return Boolean(attributes?.['rox.program']);
}
