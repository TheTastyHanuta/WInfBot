export function normalizeMealName(mealName: string): string {
  return mealName.replace(/\s+/g, ' ').trim();
}
