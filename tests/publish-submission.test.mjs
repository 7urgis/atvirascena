import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  countRecentSubmissions,
  getYouTubeId,
  parseDuration,
  getVideoMetadata,
  lookupWithRetry,
  publish,
  readSection
} from "../scripts/publish-submission.mjs";

test("transient metadata failures retry and permanent failures stop after three attempts", async () => {
  let calls = 0;
  const metadata = { title: "Concert", duration: 120 };
  assert.deepEqual(await lookupWithRetry("VzXYvyFqM4Y", async () => {
    if (++calls < 3) throw new Error("Temporary failure");
    return metadata;
  }, async () => {}), metadata);
  assert.equal(calls, 3);
  calls = 0;
  await assert.rejects(lookupWithRetry("VzXYvyFqM4Y", async () => {
    calls++;
    throw new Error("Unavailable");
  }, async () => {}), /Unavailable/);
  assert.equal(calls, 3);
});

test("extracts IDs from supported YouTube URLs", () => {
  const id = "VzXYvyFqM4Y";
  assert.equal(getYouTubeId(`https://www.youtube.com/watch?v=${id}&t=10`), id);
  assert.equal(getYouTubeId(`https://youtu.be/${id}`), id);
  assert.equal(getYouTubeId(`https://www.youtube.com/live/${id}`), id);
  assert.equal(getYouTubeId(`https://www.youtube.com/shorts/${id}`), id);
});

test("parses YouTube durations including long concerts", () => {
  assert.equal(parseDuration("PT1H2M18S"), 3738);
  assert.equal(parseDuration("PT45M"), 2700);
  assert.equal(parseDuration("P1DT2H"), 93600);
  for (const value of [undefined, "", "PT0S", "PT", "invalid"]) assert.throws(() => parseDuration(value));
});

test("extracts metadata using issue body duration and oEmbed title", async () => {
  const id = "qYOr8TlnqsY";
  const expectedTitle = 'Grupė — "Gyvai" & draugai';
  const fetchImpl = async (url) => {
    assert.equal(new URL(url).hostname, "www.youtube.com");
    return { ok: true, json: async () => ({ title: expectedTitle }) };
  };

  const bodyWithDuration = "### YouTube URL\n\nhttps://youtu.be/qYOr8TlnqsY\n\n### Duration\n\n3738";
  assert.deepEqual(await getVideoMetadata(id, fetchImpl, bodyWithDuration), { title: expectedTitle, duration: 3738 });

  const bodyWithBoth = "### YouTube URL\n\nhttps://youtu.be/qYOr8TlnqsY\n\n### Title\n\nCustom Title\n\n### Duration\n\n1234";
  assert.deepEqual(await getVideoMetadata(id, fetchImpl, bodyWithBoth), { title: "Custom Title", duration: 1234 });

  await assert.rejects(getVideoMetadata(id, fetchImpl, "### YouTube URL\n\nhttps://youtu.be/qYOr8TlnqsY"), /valid recording duration/);
  await assert.rejects(getVideoMetadata(id, async () => ({ ok: false, status: 404 }), bodyWithDuration), /HTTP 404/);
});

test("failed duration lookup leaves the concert and playlist unpublished", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "atvira-scena-"));
  try {
    const eventPath = path.join(directory, "event.json");
    fs.writeFileSync(eventPath, JSON.stringify({ issue: {
      body: "### YouTube URL\n\nhttps://youtu.be/VzXYvyFqM4Y\n\n### Concert title\n\nTest",
      user: { login: "fan" }
    } }));
    await publish(eventPath, directory, new Date(), async () => { throw new Error("Unavailable"); });
    assert.equal(fs.existsSync(path.join(directory, "content")), false);
    assert.equal(fs.existsSync(path.join(directory, "data")), false);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
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

test("creates safe Hugo content and adds the submission to Live", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "atvira-scena-"));
  const eventPath = path.join(directory, "event.json");
  const outputPath = path.join(directory, "output.txt");
  const previousOutput = process.env.GITHUB_OUTPUT;
  const event = {
    issue: {
      title: "[Video submission] VzXYvyFqM4Y",
      body: "### YouTube URL\n\nhttps://youtu.be/VzXYvyFqM4Y",
      user: { login: "concert-fan" }
    }
  };

  try {
    fs.writeFileSync(eventPath, JSON.stringify(event));
    fs.writeFileSync(outputPath, "");
    process.env.GITHUB_OUTPUT = outputPath;
    fs.mkdirSync(path.join(directory, "data"));
    fs.writeFileSync(path.join(directory, "data/live.json"), JSON.stringify({epoch: "2026-09-01T00:00:00Z", tracks: []}));
    await publish(eventPath, directory, new Date(), async () => ({ title: "Live in France", duration: 1234 }));
    const schedule = JSON.parse(fs.readFileSync(path.join(directory, "data/live.json")));
    assert.deepEqual(schedule.tracks, [{id: "VzXYvyFqM4Y", title: "Live in France", duration: 1234}]);

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

test("rejects a sixth successful submission within 24 hours", async () => {
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

    await publish(eventPath, directory, now);

    assert.equal(fs.existsSync(path.join(videosDirectory, "lGUWlDeFfzo.md")), false);
    assert.match(fs.readFileSync(outputPath, "utf8"), /status.*rate_limited/s);
  } finally {
    if (previousOutput === undefined) delete process.env.GITHUB_OUTPUT;
    else process.env.GITHUB_OUTPUT = previousOutput;
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
