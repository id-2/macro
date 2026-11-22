/**
 * The editor document used to be the Macro body. Stored work — local drafts,
 * queued sends, cached threads — can still carry the former names, so readers
 * accept both. Writers emit only the Rox names.
 */
type BodyNames = {
  body_rox?: string | null;
  body_macro?: string | null;
  bodyRox?: string | null;
  bodyMacro?: string | null;
};

type RestoreBodyNames = {
  restoreBodyRox?: string | null;
  restoreBodyMacro?: string | null;
};

export function readBodyRox(source: BodyNames | null | undefined): string | null {
  if (!source) return null;
  return (
    source.body_rox ??
    source.body_macro ??
    source.bodyRox ??
    source.bodyMacro ??
    null
  );
}

export function readRestoreBodyRox(
  source: RestoreBodyNames | null | undefined
): string | null {
  if (!source) return null;
  return source.restoreBodyRox ?? source.restoreBodyMacro ?? null;
}
