export const RECORDING_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/ogg;codecs=opus",
  "audio/mp4",
] as const;

export function chooseRecordingMimeType(isSupported: (mimeType: string) => boolean) {
  return RECORDING_MIME_TYPES.find(isSupported) ?? "";
}

export async function blobToBase64(blob: Blob) {
  const buffer = new Uint8Array(await blob.arrayBuffer());
  const chunkSize = 32_768;
  let binary = "";
  for (let offset = 0; offset < buffer.length; offset += chunkSize) {
    binary += String.fromCharCode(...buffer.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}
