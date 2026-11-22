export interface GoogleAccountsStepProps {
  mode?: 'work' | 'personal';
  /** Labels the external provider as an optional import after signup. */
  importMode?: boolean;
  accountEmail?: string;
  workConnected?: boolean;
  workNeedsReconnect?: boolean;
  personalEmail?: string;
  connecting?: 'work' | 'personal';
  /** The pending connection is the Microsoft one, not Google's. */
  microsoftConnecting?: boolean;
  loading?: boolean;
  disabled?: boolean;
  error?: string;
  onRetry?: () => void;
  onConnectWork: () => void;
  onConnectPersonal: () => void;
  /** Sign-up offers Microsoft beside Google; the signed-in flow does not. */
  onConnectMicrosoft?: () => void;
  onContinue?: () => void;
  onSkip?: () => void;
}

/** Inbox import is not part of signup. Callers still mount this and move on. */
export function GoogleAccountsStep(props: GoogleAccountsStepProps) {
  void props;
  return null;
}
