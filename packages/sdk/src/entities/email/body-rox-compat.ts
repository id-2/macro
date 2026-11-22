/**
 * The editor document used to be the Macro body. Payloads written before the
 * rename — stored drafts, queued sends, cached threads — can still carry the
 * former names, so readers accept both and prefer the Rox ones. Writers emit
 * only the Rox names.
 */
export type BodyNames = {
  body_rox?: string | null;
  bodyRox?: string | null;
  body_macro?: string | null;
  bodyMacro?: string | null;
};

export type RestoreBodyNames = {
  restore_body_rox?: string | null;
  restoreBodyRox?: string | null;
  restore_body_macro?: string | null;
  restoreBodyMacro?: string | null;
};

/** Read the editor body from a payload, preferring the Rox name over the former Macro one. */
export function readBodyRox(
  source: BodyNames | null | undefined,
): string | null {
  if (!source) return null;
  return (
    source.body_rox ??
    source.bodyRox ??
    source.body_macro ??
    source.bodyMacro ??
    null
  );
}

/** Read the body a failed send restores to the editor, preferring the Rox name. */
export function readRestoreBodyRox(
  source: RestoreBodyNames | null | undefined,
): string | null {
  if (!source) return null;
  return (
    source.restore_body_rox ??
    source.restoreBodyRox ??
    source.restore_body_macro ??
    source.restoreBodyMacro ??
    null
  );
}
