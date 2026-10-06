/** Looks like an MP4 / MOV file (an "ftyp" box right at the start)? */
export function looksLikeMp4(head: Buffer): boolean {
  return head.length >= 12 && head.subarray(4, 8).toString("ascii") === "ftyp";
}

/**
 * The length of an MP4 / MOV video in seconds, read from its "mvhd" header box, or null if it cannot be found.
 * Give it the first and the last part of the file: the header ("moov") is at the start of some files and at the end of others.
 */
export function mp4DurationSeconds(chunk: Buffer): number | null {
  let from = 0;
  while (from < chunk.length) {
    const at = chunk.indexOf("mvhd", from, "ascii");
    if (at < 0 || at + 32 > chunk.length) return null;
    const version = chunk[at + 4];
    let timescale: number, duration: number;
    if (version === 0) { timescale = chunk.readUInt32BE(at + 16); duration = chunk.readUInt32BE(at + 20); }
    else if (version === 1) { timescale = chunk.readUInt32BE(at + 24); duration = Number(chunk.readBigUInt64BE(at + 28)); }
    else { from = at + 4; continue; }
    if (timescale > 0 && Number.isFinite(duration)) return duration / timescale;
    from = at + 4;
  }
  return null;
}
