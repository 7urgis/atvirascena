function getYouTubeId(value) {
  let url;

  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, "");

  if (host === "youtu.be") {
    return validId(url.pathname.split("/").filter(Boolean)[0]);
  }

  if (host !== "youtube.com" && host !== "m.youtube.com" && host !== "music.youtube.com") {
    return null;
  }

  if (url.pathname === "/watch") {
    return validId(url.searchParams.get("v"));
  }

  const parts = url.pathname.split("/").filter(Boolean);
  if (["embed", "shorts", "live"].includes(parts[0])) {
    return validId(parts[1]);
  }

  return null;
}

function validId(value) {
  return typeof value === "string" && /^[A-Za-z0-9_-]{11}$/.test(value) ? value : null;
}

const videoChoices = document.querySelectorAll(".video-choice");
const featured = document.querySelector("#player");
const featuredFrame = document.querySelector("#featured-frame");
const featuredTitle = document.querySelector("#featured-title");
const featuredArtist = document.querySelector("#featured-artist");
const featuredLink = document.querySelector("#featured-link");
const featuredSubmitter = document.querySelector("#featured-submitter");
const featuredSubmitterLink = document.querySelector("#featured-submitter-link");
const defaultDocumentTitle = document.title;

let activeVideoTitle = "";
let youtubePlayer;
let youtubePlayerReady = false;

function setPlaybackTitle(isPlaying) {
  document.title = isPlaying && activeVideoTitle
    ? `${defaultDocumentTitle} - ${activeVideoTitle}`
    : defaultDocumentTitle;
}

function embedUrl(videoId, autoplay) {
  const params = new URLSearchParams({ enablejsapi: "1" });

  if (autoplay) {
    params.set("autoplay", "1");
  }

  return `https://www.youtube-nocookie.com/embed/${videoId}?${params}`;
}

function showVideo(choice, { autoplay = false, scroll = false } = {}) {
  if (!featuredFrame) return;

  const autoplayQuery = autoplay ? "?autoplay=1" : "";
  const submitter = choice.dataset.videoSubmitter;
  featuredFrame.src = `https://www.youtube-nocookie.com/embed/${choice.dataset.videoId}${autoplayQuery}`;
  featuredFrame.title = choice.dataset.videoTitle;
  featuredTitle.textContent = choice.dataset.videoTitle;
  featuredArtist.textContent = choice.dataset.videoArtist || "";
  featuredLink.href = choice.dataset.videoUrl;
  featuredSubmitter.hidden = !submitter;
  featuredSubmitterLink.textContent = submitter ? `@${submitter}` : "";
  featuredSubmitterLink.href = submitter ? `https://github.com/${encodeURIComponent(submitter)}` : "";

  videoChoices.forEach((item) => {
    const selected = item === choice;
    item.classList.toggle("is-selected", selected);
    item.setAttribute("aria-current", selected ? "true" : "false");
  });

  if (scroll) {
    featured.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

videoChoices.forEach((choice) => {
  choice.addEventListener("click", () => {
    showVideo(choice, { autoplay: true, scroll: true });
  });
});

if (videoChoices.length > 0) {
  const randomIndex = Math.floor(Math.random() * videoChoices.length);
  showVideo(videoChoices[randomIndex]);
}

const form = document.querySelector("#video-submission");

if (form) {
  const urlInput = form.querySelector("#youtube-url");
  const error = form.querySelector("#url-error");
  const previewContainer = form.querySelector("#submission-preview");
  const previewPlayerWrapper = form.querySelector("#preview-player-container");
  const previewTitleEl = form.querySelector("#preview-title");
  const previewDurationEl = form.querySelector("#preview-duration");

  let currentVideoId = null;
  let previewTitle = "";
  let previewDuration = null;
  let previewPlayer = null;
  let durationInterval = null;
  let ytApiPromise = null;

  function loadYouTubeApi() {
    if (ytApiPromise) return ytApiPromise;
    ytApiPromise = new Promise((resolve) => {
      if (window.YT && window.YT.Player) {
        resolve(window.YT);
        return;
      }
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (typeof prev === "function") prev();
        resolve(window.YT);
      };
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(script);
    });
    return ytApiPromise;
  }

  function formatSeconds(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const parts = [];
    if (hours > 0) parts.push(`${hours} val.`);
    if (minutes > 0 || hours > 0) parts.push(`${minutes} min.`);
    parts.push(`${seconds} s`);
    return parts.join(" ");
  }

  function updatePreviewState() {
    if (!previewTitleEl || !previewDurationEl) return;
    previewTitleEl.textContent = previewTitle || "Įkeliamas pavadinimas...";
    if (previewDuration) {
      previewDurationEl.textContent = `Trukmė: ${formatSeconds(previewDuration)}`;
    } else {
      previewDurationEl.textContent = "Nustatoma trukmė...";
    }
  }

  function clearPreview() {
    currentVideoId = null;
    previewTitle = "";
    previewDuration = null;
    if (durationInterval) {
      clearInterval(durationInterval);
      durationInterval = null;
    }
    if (previewPlayer && typeof previewPlayer.destroy === "function") {
      try { previewPlayer.destroy(); } catch {}
      previewPlayer = null;
    }
    if (previewPlayerWrapper) previewPlayerWrapper.replaceChildren();
    if (previewContainer) previewContainer.hidden = true;
  }

  function checkPlayerDuration(player) {
    if (previewDuration) return;
    try {
      const d = player.getDuration();
      if (typeof d === "number" && d > 0) {
        previewDuration = Math.round(d);
        if (durationInterval) {
          clearInterval(durationInterval);
          durationInterval = null;
        }
        updatePreviewState();
      }
    } catch {}
  }

  function loadPreview(videoId) {
    if (videoId === currentVideoId) return;
    clearPreview();
    currentVideoId = videoId;
    if (previewContainer) previewContainer.hidden = false;
    updatePreviewState();

    fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.title && currentVideoId === videoId) {
          previewTitle = data.title;
          updatePreviewState();
        }
      })
      .catch(() => {});

    loadYouTubeApi().then((YT) => {
      if (currentVideoId !== videoId) return;
      const playerEl = document.createElement("div");
      playerEl.id = "preview-yt-player";
      if (previewPlayerWrapper) previewPlayerWrapper.replaceChildren(playerEl);

      previewPlayer = new YT.Player("preview-yt-player", {
        height: "180",
        width: "320",
        videoId: videoId,
        events: {
          onReady: (event) => {
            checkPlayerDuration(event.target);
            if (!previewDuration) {
              durationInterval = setInterval(() => checkPlayerDuration(event.target), 300);
            }
          },
          onStateChange: (event) => {
            checkPlayerDuration(event.target);
          }
        }
      });
    });
  }

  let inputDebounce = null;
  urlInput.addEventListener("input", () => {
    if (inputDebounce) clearTimeout(inputDebounce);
    inputDebounce = setTimeout(() => {
      const videoId = getYouTubeId(urlInput.value);
      if (videoId) {
        urlInput.removeAttribute("aria-invalid");
        error.textContent = "";
        loadPreview(videoId);
      } else {
        clearPreview();
      }
    }, 250);
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const videoId = getYouTubeId(urlInput.value);

    if (!videoId) {
      urlInput.setAttribute("aria-invalid", "true");
      error.textContent = "Įveskite galiojančią „YouTube“ vaizdo įrašo nuorodą.";
      urlInput.focus();
      return;
    }

    urlInput.removeAttribute("aria-invalid");
    error.textContent = "";

    const issueTitle = `[Video submission] ${videoId}`;
    const issueBodyParts = [
      "### YouTube URL",
      "",
      urlInput.value.trim()
    ];

    if (previewTitle) {
      issueBodyParts.push("", "### Title", "", previewTitle);
    }

    if (previewDuration) {
      issueBodyParts.push("", "### Duration", "", String(previewDuration));
    }

    issueBodyParts.push("", "---", "Submitted through the AtviraScena website.");

    const issueBody = issueBodyParts.join("\n");
    const params = new URLSearchParams({ title: issueTitle, body: issueBody });

    window.location.href = `https://github.com/${form.dataset.repository}/issues/new?${params}`;
  });
}
