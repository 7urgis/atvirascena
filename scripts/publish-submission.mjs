import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const MAX_SUBMISSIONS_PER_WINDOW = 5;
export const SUBMISSION_WINDOW_MS = 24 * 60 * 60 * 1000;

export function getYouTubeId(value) {
  let url;

  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  let candidate = null;

  if (host === "youtu.be") {
    candidate = url.pathname.split("/").filter(Boolean)[0];
  } else if (["youtube.com", "m.youtube.com", "music.youtube.com"].includes(host)) {
    if (url.pathname === "/watch") {
      candidate = url.searchParams.get("v");
    } else {
      const parts = url.pathname.split("/").filter(Boolean);
      if (["embed", "shorts", "live"].includes(parts[0])) candidate = parts[1];
    }
  }

  return typeof candidate === "string" && /^[A-Za-z0-9_-]{11}$/.test(candidate)
    ? candidate
    : null;
}

export function readSection(body, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = body.match(new RegExp(`^### ${escaped}\\s*\\n+(.+?)(?=\\n+### |\\n+---|$)`, "ms"));
  return match?.[1].trim() ?? "";
}

function setOutput(name, value) {
  if (!process.env.GITHUB_OUTPUT) return;
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}<<ATVIRA_SCENA_OUTPUT\n${value}\nATVIRA_SCENA_OUTPUT\n`);
}

function finish(status, message, videoId = "") {
  setOutput("status", status);
  setOutput("message", message);
  setOutput("video_id", videoId);
}

export function countRecentSubmissions(videosDirectory, submitter, now = new Date()) {
  if (!fs.existsSync(videosDirectory)) return 0;

  const normalizedSubmitter = submitter.toLowerCase();
  const windowStart = now.getTime() - SUBMISSION_WINDOW_MS;

  return fs.readdirSync(videosDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .reduce((count, entry) => {
      try {
        const content = JSON.parse(fs.readFileSync(path.join(videosDirectory, entry.name), "utf8"));
        const publishedAt = Date.parse(content.date);
        const sameSubmitter = content.submitted_by?.toLowerCase() === normalizedSubmitter;
        const insideWindow = Number.isFinite(publishedAt)
          && publishedAt >= windowStart
          && publishedAt <= now.getTime();

        return sameSubmitter && insideWindow ? count + 1 : count;
      } catch {
        // Older hand-authored Markdown files do not contain submission metadata.
        return count;
      }
    }, 0);
}

export function publish(eventPath, projectRoot, now = new Date()) {
  const event = JSON.parse(fs.readFileSync(eventPath, "utf8"));
  const body = event.issue?.body ?? "";
  const youtubeUrl = readSection(body, "YouTube URL");
  const videoId = getYouTubeId(youtubeUrl);

  if (!videoId) {
    finish("invalid", "Nepavyko rasti galiojančios „YouTube“ nuorodos. Patikrinkite pasiūlymą ir bandykite dar kartą.");
    return;
  }

  const videosDirectory = path.join(projectRoot, "content", "videos");
  const destination = path.join(videosDirectory, `${videoId}.md`);

  if (fs.existsSync(destination)) {
    finish("duplicate", "Šis vaizdo įrašas jau yra svetainėje.", videoId);
    return;
  }

  const submitter = event.issue?.user?.login ?? "unknown";
  const recentSubmissionCount = countRecentSubmissions(videosDirectory, submitter, now);

  if (recentSubmissionCount >= MAX_SUBMISSIONS_PER_WINDOW) {
    finish(
      "rate_limited",
      `Pasiekėte ${MAX_SUBMISSIONS_PER_WINDOW} paskelbtų įrašų limitą per 24 valandas. Bandykite dar kartą vėliau.`
    );
    return;
  }

  const submittedTitle = readSection(body, "Concert title");
  const fallbackTitle = event.issue?.title?.replace(/^\[Video submission\]\s*/, "").trim();
  const title = submittedTitle && submittedTitle !== "(not provided)"
    ? submittedTitle.slice(0, 120)
    : (fallbackTitle || `YouTube concert ${videoId}`).slice(0, 120);
  const frontMatter = {
    title,
    date: now.toISOString(),
    youtube_id: videoId,
    youtube_url: `https://www.youtube.com/watch?v=${videoId}`,
    submitted_by: submitter
  };

  fs.mkdirSync(videosDirectory, { recursive: true });
  fs.writeFileSync(destination, `${JSON.stringify(frontMatter, null, 2)}\n`);
  finish("published", `Ačiū! „${title}“ paskelbtas svetainėje.`, videoId);
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (import.meta.url === invokedPath) {
  const eventPath = process.argv[2];
  const projectRoot = process.argv[3] ?? path.resolve(import.meta.dirname, "..");

  if (!eventPath) {
    console.error("Usage: node publish-submission.mjs EVENT_JSON [PROJECT_ROOT]");
    process.exit(1);
  }

  publish(eventPath, projectRoot);
}

