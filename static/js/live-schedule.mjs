// The schedule depends only on UTC time, never on when a visitor joins.
export function createSchedule({ epoch, tracks }) {
  const start = Date.parse(epoch);
  if (!Number.isFinite(start) || !Array.isArray(tracks) || !tracks.length ||
      tracks.some(track => !/^[\w-]{11}$/.test(track.id) ||
        !Number.isFinite(track.duration) || track.duration <= 0)) {
    throw new Error("Invalid live schedule");
  }
  const total = tracks.reduce((sum, track) => sum + track.duration, 0);
  return (now = Date.now()) => {
    let offset = (((now - start) / 1000) % total + total) % total;
    for (let index = 0; index < tracks.length; index++) {
      if (offset < tracks[index].duration) {
        return { track: tracks[index], next: tracks[(index + 1) % tracks.length], offset,
          slot: Math.floor((now - start) / (total * 1000)) * tracks.length + index };
      }
      offset -= tracks[index].duration;
    }
  };
}
