import { createHash } from 'crypto';
import { createReadStream } from 'fs';

/** SHA-256 di una stringa (usato per manifest, id deterministici, ecc.). */
export function sha256Of(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

/** SHA-256 di un file su disco, in streaming (adatto anche a file grandi come installer/APK). */
export function sha256OfFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

/** Verifica che l'hash calcolato corrisponda a quello atteso (case-insensitive). */
export function verifySha256(actual: string, expected: string): boolean {
  return actual.toLowerCase() === expected.toLowerCase();
}
