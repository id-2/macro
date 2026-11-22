import { FeatureOverview } from './feature-overview';

export function VisionStep(props: {
  accent: string;
  onContinue: (features: string[]) => void;
}) {
  return (
    <FeatureOverview accent={props.accent} onContinue={props.onContinue} />
  );
}

/** Kept so the story stage can mount the step; the trust slide is not shown. */
export function SecurityStep(props: {
  githubStars: number | undefined;
  onContinue: () => void;
}) {
  void props.githubStars;
  void props.onContinue;
  return null;
}
