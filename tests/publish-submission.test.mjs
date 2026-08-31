import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { getYouTubeId, publish, readSection } from "../scripts/publish-submission.mjs";

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

test("creates safe Hugo content from an approved issue", () => {
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
