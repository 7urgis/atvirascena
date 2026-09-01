import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  countRecentSubmissions,
  getYouTubeId,
  publish,
  readSection
} from "../scripts/publish-submission.mjs";

test("extracts IDs from supported YouTube URLs", () => {
  const id = "VzXYvyFqM4Y";
  assert.equal(getYouTubeId(`https://www.youtube.com/watch?v=${id}&t=10`), id);
  assert.equal(getYouTubeId(`https://youtu.be/${id}`), id);
  assert.equal(getYouTubeId(`https://www.youtube.com/live/${id}`), id);
  assert.equal(getYouTubeId(`https://www.youtube.com/shorts/${id}`), id);
});

test("rejects unsupported and malformed URLs", () => {
  assert.equal(getYouTubeId("not a URL"), null);
  assert.equal(getYouTubeId("https://example.com/watch?v=VzXYvyFqM4Y"), null);
  assert.equal(getYouTubeId("https://youtube.com/watch?v=too-short"), null);
});

test("reads GitHub issue form sections", () => {
  const body = `### YouTube URL\n\nhttps://youtu.be/VzXYvyFqM4Y\n\n### Concert title\n\nLive in France\n\n---\nSubmitted`;
  assert.equal(readSection(body, "YouTube URL"), "https://youtu.be/VzXYvyFqM4Y");
  assert.equal(readSection(body, "Concert title"), "Live in France");
});

test("creates safe Hugo content from a submitted issue", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "atvira-scena-"));
  const eventPath = path.join(directory, "event.json");
  const outputPath = path.join(directory, "output.txt");
  const previousOutput = process.env.GITHUB_OUTPUT;
  const event = {
    issue: {
      title: "[Video submission] Live in France",
      body: "### YouTube URL\n\nhttps://youtu.be/VzXYvyFqM4Y\n\n### Concert title\n\nLive in France",
      user: { login: "concert-fan" }
    }
  };

  try {
    fs.writeFileSync(eventPath, JSON.stringify(event));
    fs.writeFileSync(outputPath, "");
    process.env.GITHUB_OUTPUT = outputPath;
    publish(eventPath, directory);

    const content = JSON.parse(fs.readFileSync(path.join(directory, "content/videos/VzXYvyFqM4Y.md"), "utf8"));
    assert.equal(content.title, "Live in France");
    assert.equal(content.youtube_id, "VzXYvyFqM4Y");
    assert.equal(content.submitted_by, "concert-fan");
    assert.match(fs.readFileSync(outputPath, "utf8"), /status.*published/s);
  } finally {
    if (previousOutput === undefined) delete process.env.GITHUB_OUTPUT;
    else process.env.GITHUB_OUTPUT = previousOutput;
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("counts only a user's successful submissions from the previous 24 hours", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "atvira-scena-"));
  const now = new Date("2026-08-31T12:00:00.000Z");
  const records = [
    ["recent.md", "concert-fan", "2026-08-31T11:00:00.000Z"],
    ["different-case.md", "Concert-Fan", "2026-08-30T13:00:00.000Z"],
    ["old.md", "concert-fan", "2026-08-30T11:59:59.000Z"],
    ["another-user.md", "someone-else", "2026-08-31T11:00:00.000Z"]
  ];

  try {
    for (const [name, submittedBy, date] of records) {
      fs.writeFileSync(
        path.join(directory, name),
        JSON.stringify({ submitted_by: submittedBy, date })
      );
    }
    fs.writeFileSync(path.join(directory, "legacy.md"), "---\ntitle: Legacy\n---\n");

    assert.equal(countRecentSubmissions(directory, "CONCERT-FAN", now), 2);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("rejects a sixth successful submission within 24 hours", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "atvira-scena-"));
  const eventPath = path.join(directory, "event.json");
  const outputPath = path.join(directory, "output.txt");
  const videosDirectory = path.join(directory, "content", "videos");
  const previousOutput = process.env.GITHUB_OUTPUT;
  const now = new Date("2026-08-31T12:00:00.000Z");
  const event = {
    issue: {
      title: "[Video submission] Sixth concert",
      body: "### YouTube URL\n\nhttps://youtu.be/lGUWlDeFfzo\n\n### Concert title\n\nSixth concert",
      user: { login: "concert-fan" }
    }
  };

  try {
    fs.mkdirSync(videosDirectory, { recursive: true });
    for (let index = 0; index < 5; index += 1) {
      fs.writeFileSync(
        path.join(videosDirectory, "existing-" + index + ".md"),
        JSON.stringify({
          submitted_by: "concert-fan",
          date: new Date(now.getTime() - (index + 1) * 60_000).toISOString()
        })
      );
    }
    fs.writeFileSync(eventPath, JSON.stringify(event));
    fs.writeFileSync(outputPath, "");
    process.env.GITHUB_OUTPUT = outputPath;

    publish(eventPath, directory, now);

    assert.equal(fs.existsSync(path.join(videosDirectory, "lGUWlDeFfzo.md")), false);
    assert.match(fs.readFileSync(outputPath, "utf8"), /status.*rate_limited/s);
  } finally {
    if (previousOutput === undefined) delete process.env.GITHUB_OUTPUT;
    else process.env.GITHUB_OUTPUT = previousOutput;
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
