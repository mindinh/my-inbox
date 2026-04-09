/**
 * Sort array to put selected items first
 */
export function sortSelectedFirst<T>(
  items: T[],
  selectedIds: Set<string> | string[],
  getItemId: (item: T) => string
): T[] {
  const selectedSet = selectedIds instanceof Set ? selectedIds : new Set(selectedIds);
  
  return [...items].sort((a, b) => {
    const aSelected = selectedSet.has(getItemId(a));
    const bSelected = selectedSet.has(getItemId(b));
    
    if (aSelected && !bSelected) return -1;
    if (!aSelected && bSelected) return 1;
    return 0;
  });
}
