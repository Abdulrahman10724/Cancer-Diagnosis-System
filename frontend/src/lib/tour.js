export const TOUR_KEY = 'cds.tourDone';

export function tourSeen() {
  try {
    return window.localStorage.getItem(TOUR_KEY) === '1';
  } catch {
    return false;
  }
}
