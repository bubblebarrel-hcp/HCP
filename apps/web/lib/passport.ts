export const memoryKindLabel: Record<string, string> = {
  FAVORITE_TRAIL: 'Favourite trail',
  FAVORITE_BEER_STOP: 'Favourite beer stop',
  FAVORITE_PHOTO: 'Favourite photo',
  NOTE: 'Note',
};

export const timelineTypeLabel: Record<string, string> = {
  AWARD: 'Stamp',
  MILESTONE: 'Milestone',
  MEMBERSHIP: 'Membership',
  ROLE: 'Role',
  TRUST_LEVEL: 'Trust level',
  HASH_NAME: 'Hash name',
};

export function formatKm(metres: number) {
  if (!metres) return '0 km';
  return `${(metres / 1000).toFixed(metres >= 10_000 ? 0 : 1)} km`;
}

export function placeLabel(place: { country: string; stateProvince: string; city: string }) {
  return [place.city, place.stateProvince, place.country].filter(Boolean).join(', ');
}
