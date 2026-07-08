import crypto from 'crypto';

/**
 * Generates a SHA256 hex string from a file buffer for duplicate detection.
 */
export const generateFileHash = (fileBuffer: Buffer): string => {
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
};