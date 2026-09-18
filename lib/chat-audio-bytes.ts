const MIN_AUDIO_BYTES = 256;
const FTYP = [0x66, 0x74, 0x79, 0x70]; // ftyp

export function assertRecordedAudioBytes(bytes: Uint8Array) {
  const head = new TextDecoder().decode(bytes.subarray(0, 32));
  if (head.includes('File not found')) {
    throw new Error('Recording file could not be read from disk.');
  }

  if (bytes.byteLength < MIN_AUDIO_BYTES) {
    throw new Error('Recording file is empty or incomplete.');
  }

  const hasFtyp =
    bytes.byteLength >= 8 &&
    FTYP.every((value, index) => bytes[4 + index] === value);
  if (!hasFtyp) {
    throw new Error('Recording file is not a valid audio clip.');
  }
}
