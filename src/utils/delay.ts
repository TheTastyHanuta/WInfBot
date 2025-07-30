// Utility function to delay execution for a given number of milliseconds
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
