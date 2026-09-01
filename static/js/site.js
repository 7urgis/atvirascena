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

function showVideo(choice, { autoplay = false, scroll = false } = {}) {
  if (!featuredFrame) return;

  const autoplayQuery = autoplay ? "?autoplay=1" : "";
  featuredFrame.src = `https://www.youtube-nocookie.com/embed/${choice.dataset.videoId}${autoplayQuery}`;
  featuredFrame.title = choice.dataset.videoTitle;
  featuredTitle.textContent = choice.dataset.videoTitle;
  featuredArtist.textContent = choice.dataset.videoArtist || "";
  featuredLink.href = choice.dataset.videoUrl;

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
  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const urlInput = form.querySelector("#youtube-url");
    const titleInput = form.querySelector("#concert-title");
    const error = form.querySelector("#url-error");
    const videoId = getYouTubeId(urlInput.value);

    if (!videoId) {
      urlInput.setAttribute("aria-invalid", "true");
      error.textContent = "Įveskite galiojančią „YouTube“ vaizdo įrašo nuorodą.";
      urlInput.focus();
      return;
    }

    urlInput.removeAttribute("aria-invalid");
    error.textContent = "";

    const suppliedTitle = titleInput.value.trim();
    const issueTitle = `[Video submission] ${suppliedTitle || videoId}`;
    const issueBody = [
      "### YouTube URL",
      "",
      urlInput.value.trim(),
      "",
      "### Concert title",
      "",
      suppliedTitle || "(not provided)",
      "",
      "---",
      "Submitted through the Atvira scena website."
    ].join("\n");
    const params = new URLSearchParams({ title: issueTitle, body: issueBody });

    window.location.href = `https://github.com/${form.dataset.repository}/issues/new?${params}`;
  });
}
