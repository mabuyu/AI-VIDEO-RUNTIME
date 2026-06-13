import compositions from "../data/composition.json";

export interface Composition {
  id: string;
  start: number;
  duration: number;
  preset: string;
}

export function getCompositions(): Composition[] {
  return compositions as Composition[];
}

export function getCurrentComposition(
  currentTime: number
): Composition | null {
  const composition = getCompositions().find(
    (item) =>
      currentTime >= item.start &&
      currentTime < item.start + item.duration
  );

  return composition ?? null;
}

export function getCompositionProgress(
  currentTime: number,
  composition: Composition | null
): number {
  if (!composition) return 0;

  return Math.min(
    (currentTime - composition.start) / composition.duration,
    1
  );
}