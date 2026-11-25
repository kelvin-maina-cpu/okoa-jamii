import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { IncidentEvidence } from '../types/incidents';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp'];
const AUDIO_MIME_TYPES = ['audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/wav', 'audio/x-wav', 'audio/m4a', 'audio/x-m4a', 'audio/ogg'];

export const EVIDENCE_NOT_UPLOADED_NOTICE =
  'Evidence stays on this device. Upload infrastructure is not configured yet, so the server only receives evidence details, not the files.';

export type EvidencePickResult =
  | { ok: true; evidence: IncidentEvidence }
  | { ok: false; cancelled?: boolean; message?: string };

function extensionOf(value: string): string {
  const clean = value.split('?')[0];
  const index = clean.lastIndexOf('.');
  return index >= 0 ? clean.slice(index + 1).toLowerCase() : '';
}

function mimeFromName(name: string): string {
  const extension = extensionOf(name);
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  if (extension === 'png') return 'image/png';
  if (extension === 'heic') return 'image/heic';
  if (extension === 'webp') return 'image/webp';
  if (extension === 'm4a') return 'audio/m4a';
  if (extension === 'mp3') return 'audio/mpeg';
  if (extension === 'wav') return 'audio/wav';
  if (extension === 'aac') return 'audio/aac';
  if (extension === 'ogg') return 'audio/ogg';
  return 'application/octet-stream';
}

function validateAttachment(
  kind: 'photo' | 'audio',
  mimeType: string,
  sizeBytes: number | undefined,
): string | null {
  const allowed = kind === 'photo' ? IMAGE_MIME_TYPES : AUDIO_MIME_TYPES;
  const limit = kind === 'photo' ? MAX_IMAGE_BYTES : MAX_AUDIO_BYTES;
  const label = kind === 'photo' ? 'Photo' : 'Audio';

  if (!allowed.includes(mimeType.toLowerCase())) {
    return `${label} format is not supported. Use ${kind === 'photo' ? 'JPG, PNG, HEIC or WebP' : 'MP3, M4A, AAC, WAV or OGG'}.`;
  }
  if (typeof sizeBytes === 'number' && sizeBytes > limit) {
    return `${label} is larger than ${Math.round(limit / (1024 * 1024))} MB. Choose a smaller file.`;
  }
  return null;
}

export async function pickPhotoEvidence(): Promise<EvidencePickResult> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    return {
      ok: false,
      message: permission.canAskAgain
        ? 'Photo access was denied. Allow photo access to attach evidence.'
        : 'Photo access is off. Enable it for Okoa Jamii in device settings to attach evidence.',
    };
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.7,
    allowsMultipleSelection: false,
  });

  if (result.canceled || !result.assets?.length) {
    return { ok: false, cancelled: true };
  }

  const asset = result.assets[0];
  const name = asset.fileName ?? `photo-${Date.now()}.jpg`;
  const mimeType = (asset.mimeType ?? mimeFromName(name)).toLowerCase();
  const error = validateAttachment('photo', mimeType, asset.fileSize);
  if (error) return { ok: false, message: error };

  return {
    ok: true,
    evidence: {
      kind: 'photo',
      uri: asset.uri,
      name,
      mimeType,
      sizeBytes: asset.fileSize,
      capturedAt: new Date().toISOString(),
    },
  };
}

export async function pickAudioEvidence(): Promise<EvidencePickResult> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['audio/*'],
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled || !result.assets?.length) {
    return { ok: false, cancelled: true };
  }

  const asset = result.assets[0];
  const mimeType = (asset.mimeType ?? mimeFromName(asset.name)).toLowerCase();
  const error = validateAttachment('audio', mimeType, asset.size);
  if (error) return { ok: false, message: error };

  return {
    ok: true,
    evidence: {
      kind: 'audio',
      uri: asset.uri,
      name: asset.name,
      mimeType,
      sizeBytes: asset.size,
      capturedAt: new Date().toISOString(),
    },
  };
}
