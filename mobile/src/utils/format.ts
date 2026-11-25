export function formatDateTime(value: string | undefined): string {
  if (!value) return 'Unknown time';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown time';
  return date.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatCoordinates(latitude: number, longitude: number): string {
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

export function createClientGeneratedId(): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `okj-${Date.now().toString(36)}-${random}`;
}
