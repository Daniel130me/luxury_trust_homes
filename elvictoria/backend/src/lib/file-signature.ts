/**
 * File signature ("magic bytes") checks for uploaded media.
 *
 * The MIME type multer reports comes from the client and can be anything.
 * Before a file is stored and served from our origin we confirm that its
 * first bytes really belong to the declared format, so an HTML or SVG file
 * renamed to ".jpg" is rejected instead of being published.
 */

type Signature = { offset: number; bytes: number[] };

/** ASCII helper so the signatures below stay readable. */
const ascii = (text: string) => [...text].map((c) => c.charCodeAt(0));

const SIGNATURES: Record<string, Signature[][]> = {
  // Each inner array is a set of byte runs that must ALL match; the outer
  // array lists alternatives (any one set is enough).
  "image/jpeg": [[{ offset: 0, bytes: [0xff, 0xd8, 0xff] }]],
  "image/png": [[{ offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }]],
  "image/webp": [[
    { offset: 0, bytes: ascii("RIFF") },
    { offset: 8, bytes: ascii("WEBP") },
  ]],
  // MP4 and QuickTime are ISO base media files: bytes 4-7 read "ftyp"
  // (QuickTime files may also start with a "moov"/"mdat"/"wide" atom).
  "video/mp4": [[{ offset: 4, bytes: ascii("ftyp") }]],
  "video/quicktime": [
    [{ offset: 4, bytes: ascii("ftyp") }],
    [{ offset: 4, bytes: ascii("moov") }],
    [{ offset: 4, bytes: ascii("mdat") }],
    [{ offset: 4, bytes: ascii("wide") }],
  ],
  // WebM is a Matroska/EBML container.
  "video/webm": [[{ offset: 0, bytes: [0x1a, 0x45, 0xdf, 0xa3] }]],
};

function runMatches(buffer: Buffer, run: Signature): boolean {
  if (buffer.length < run.offset + run.bytes.length) return false;
  return run.bytes.every((byte, i) => buffer[run.offset + i] === byte);
}

/**
 * True when `buffer` starts with a signature of `mimeType`. Unknown MIME
 * types always return false (deny by default).
 */
export function matchesDeclaredType(buffer: Buffer, mimeType: string): boolean {
  const alternatives = SIGNATURES[mimeType];
  if (!alternatives) return false;
  return alternatives.some((runs) => runs.every((run) => runMatches(buffer, run)));
}
