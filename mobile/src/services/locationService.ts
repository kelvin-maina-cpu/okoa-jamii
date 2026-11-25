import * as Location from 'expo-location';
import { IncidentLocation } from '../types/incidents';

const GPS_TIMEOUT_MS = 15_000;

export type LocationFailureReason = 'permission-denied' | 'services-disabled' | 'unavailable';

export interface CapturedLocation extends IncidentLocation {
  accuracy?: number;
}

export interface LocationCaptureResult {
  ok: boolean;
  location?: CapturedLocation;
  reason?: LocationFailureReason;
  message: string;
}

export const LOCATION_PERMISSION_RECOVERY =
  'Location permission is off. Open your device settings, choose Okoa Jamii, and allow location while using the app. You can still describe the location manually in a normal report.';

export async function requestForegroundLocationPermission(): Promise<'granted' | 'denied'> {
  const current = await Location.getForegroundPermissionsAsync();
  if (current.status === 'granted') return 'granted';
  if (!current.canAskAgain) return 'denied';

  const requested = await Location.requestForegroundPermissionsAsync();
  return requested.status === 'granted' ? 'granted' : 'denied';
}

export async function getLocationPermissionStatus(): Promise<'granted' | 'denied' | 'undetermined'> {
  const current = await Location.getForegroundPermissionsAsync();
  if (current.status === 'granted') return 'granted';
  return current.canAskAgain ? 'undetermined' : 'denied';
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Location request timed out')), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function toCapturedLocation(position: Location.LocationObject): CapturedLocation {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy ?? undefined,
  };
}

export async function captureCurrentLocation(): Promise<LocationCaptureResult> {
  const permission = await requestForegroundLocationPermission();
  if (permission !== 'granted') {
    return {
      ok: false,
      reason: 'permission-denied',
      message: LOCATION_PERMISSION_RECOVERY,
    };
  }

  const servicesEnabled = await Location.hasServicesEnabledAsync();
  if (!servicesEnabled) {
    return {
      ok: false,
      reason: 'services-disabled',
      message: 'GPS location services are switched off. Turn on location services and try again.',
    };
  }

  try {
    const position = await withTimeout(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      GPS_TIMEOUT_MS,
    );
    return {
      ok: true,
      location: toCapturedLocation(position),
      message: 'GPS location captured.',
    };
  } catch {
    const lastKnown = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60 * 1000 }).catch(() => null);
    if (lastKnown) {
      return {
        ok: true,
        location: toCapturedLocation(lastKnown),
        message: 'Using a recent GPS fix. Accuracy may be reduced.',
      };
    }

    return {
      ok: false,
      reason: 'unavailable',
      message: 'GPS is unavailable right now. Move to an open area and try again.',
    };
  }
}
