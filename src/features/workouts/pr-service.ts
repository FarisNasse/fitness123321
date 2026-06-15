export function estimatedOneRepMax(weight: number, reps: number) {
  if (reps <= 1) {
    return weight;
  }

  return weight * (1 + reps / 30);
}
