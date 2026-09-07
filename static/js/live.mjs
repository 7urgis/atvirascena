import { createSchedule } from "./live-schedule.mjs";

const scheduleElement = document.querySelector("#live-schedule");
let scheduleJSON = JSON.stringify(JSON.parse(scheduleElement.textContent));
let current = createSchedule(JSON.parse(scheduleJSON));
let refreshing = false;

async function refreshSchedule() {
  if (refreshing) return;
  refreshing = true;
  try {
    const response = await fetch(scheduleElement.dataset.url, { cache: "no-store", signal: AbortSignal.timeout(10000) });
    if (!response.ok) return;
    const data = await response.json();
    const serialized = JSON.stringify(data);
    if (serialized === scheduleJSON) return;
    const updated = createSchedule(data);
    current = updated;
    scheduleJSON = serialized;
    activeSlot = undefined;
    sync();
  } catch {
    // Keep playing the last valid schedule while offline; retry next minute.
  } finally {
    refreshing = false;
  }
}
const title = document.querySelector("#live-title");
const next = document.querySelector("#live-next");
const status = document.querySelector("#live-status");
const join = document.querySelector("#live-join");
let player;
let ready = false;
let activeSlot;
let failed = false;
let resumeNeedsSync = false;

function sync(force = false) {
  const scheduled = current();
  title.textContent = scheduled.track.title;
  next.textContent = `Toliau: ${scheduled.next.title}`;
  if (!ready) return;
  if (activeSlot !== scheduled.slot) {
    activeSlot = scheduled.slot;
    failed = false;
    status.textContent = "Jungiama prie transliacijos…";
    player.loadVideoById({ videoId: scheduled.track.id, startSeconds: scheduled.offset });
  } else if (!failed && (force || player.getPlayerState() === YT.PlayerState.PLAYING)) {
    if (force || Math.abs(player.getCurrentTime() - scheduled.offset) > 3) {
      player.seekTo(scheduled.offset, true);
    }
  }
}

join.addEventListener("click", () => {
  if (!ready) return;
  if (failed) activeSlot = undefined;
  sync(true);
  player.unMute();
  player.playVideo();
});

window.onYouTubeIframeAPIReady = () => {
  player = new YT.Player("live-player", {
    host: "https://www.youtube-nocookie.com",
    width: "100%",
    height: "100%",
    playerVars: { playsinline: 1, origin: window.location.origin },
    events: {
      onReady: () => {
        clearTimeout(loadTimeout);
        ready = true;
        join.disabled = false;
        player.getIframe().title = "AtviraScena Live";
        player.mute();
        sync();
      },
      onStateChange: ({ data }) => {
        if (data === YT.PlayerState.PAUSED) {
          resumeNeedsSync = true;
          status.textContent = "Pristabdyta. Prisijunkite, kad grįžtumėte į tiesioginį laiką.";
        } else if (data === YT.PlayerState.PLAYING) {
          if (resumeNeedsSync) {
            resumeNeedsSync = false;
            sync(true);
          }
          status.textContent = player.isMuted() ? "Grojama be garso. Prisijunkite su garsu." : "Grojama tiesioginiu laiku.";
          join.textContent = player.isMuted() ? "Prisijungti su garsu" : "Grįžti į tiesioginį laiką";
        } else if (data === YT.PlayerState.ENDED) {
          status.textContent = "Laukiama kito koncerto…";
          sync();
        }
      },
      onAutoplayBlocked: () => {
        status.textContent = "Paspauskite „Prisijungti su garsu“, kad pradėtumėte žiūrėti.";
      },
      onError: () => {
        failed = true;
        status.textContent = "Šio įrašo paleisti nepavyko. Bandykite prisijungti dar kartą arba palaukite kito koncerto.";
      }
    }
  });
};

const loadTimeout = setTimeout(() => {
  status.textContent = "Grotuvo įkelti nepavyko. Patikrinkite ryšį ir perkraukite puslapį.";
}, 15000);
sync();
setInterval(() => sync(), 1000);
setInterval(refreshSchedule, 60000);
refreshSchedule();
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    sync();
    refreshSchedule();
  }
});
const script = document.createElement("script");
script.src = "https://www.youtube.com/iframe_api";
script.onerror = () => {
  clearTimeout(loadTimeout);
  status.textContent = "Grotuvo įkelti nepavyko. Patikrinkite ryšį ir perkraukite puslapį.";
};
document.head.append(script);
