import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createSchedule } from "../static/js/live-schedule.mjs";

const data = { epoch: "2026-09-01T00:00:00Z", tracks: [
  { id: "aaaaaaaaaaa", title: "First", duration: 10 },
  { id: "bbbbbbbbbbb", title: "Second", duration: 20 }
] };
const epoch = Date.parse(data.epoch);

test("visitors share positions, transition at boundaries, and loop", () => {
  const firstVisitor = createSchedule(data);
  const laterVisitor = createSchedule(data);
  assert.deepEqual(firstVisitor(epoch + 12500), laterVisitor(epoch + 12500));
  assert.equal(firstVisitor(epoch + 12500).offset, 2.5);
  assert.equal(firstVisitor(epoch + 10000).track.id, "bbbbbbbbbbb");
  assert.equal(firstVisitor(epoch + 30000).track.id, "aaaaaaaaaaa");
  assert.equal(firstVisitor(epoch + 30000).offset, 0);
  assert.equal(firstVisitor(epoch + 30000).slot, 2);
  assert.equal(firstVisitor(epoch - 1000).offset, 19);
});

test("published schedule is valid and contains all eight initial concerts", () => {
  const published = JSON.parse(fs.readFileSync(new URL("../data/live.json", import.meta.url)));
  assert.equal(published.tracks.length, 8);
  assert.ok(createSchedule(published)().track);
  assert.throws(() => createSchedule({ ...data, tracks: [] }));
  assert.throws(() => createSchedule({ ...data, tracks: [{ id: "aaaaaaaaaaa", duration: 0 }] }));
});

test("player syncs playback and picks up newly published videos", async () => {
  let now = epoch + 12500;
  let options;
  let tick;
  let refresh;
  let remote = data;
  const calls = [];
  const elements = new Map();
  const player = {
    mute() {}, unMute() {}, playVideo() {}, getIframe: () => ({}),
    loadVideoById: value => calls.push(["load", value]),
    seekTo: value => calls.push(["seek", value]),
    getCurrentTime: () => 0, getPlayerState: () => 1, isMuted: () => true
  };
  const context = {
    createSchedule: value => { const schedule = createSchedule(value); return () => schedule(now); },
    document: {
      querySelector: selector => {
        if (!elements.has(selector)) elements.set(selector, {
          dataset: { url: "/live/schedule.json" },
          textContent: selector === "#live-schedule" ? JSON.stringify(data) : "",
          addEventListener(type, handler) { this[type] = handler; }
        });
        return elements.get(selector);
      },
      addEventListener() {}, createElement: () => ({}), head: { append() {} }
    },
    window: { location: { origin: "https://example.com" } },
    YT: { Player: function (id, config) { options = config; return player; },
      PlayerState: { PLAYING: 1, PAUSED: 2, ENDED: 0 } },
    fetch: async () => ({ ok: true, json: async () => remote }),
    AbortSignal,
    setTimeout() {}, clearTimeout() {}, setInterval(fn, ms) { if (ms === 1000) tick = fn; else refresh = fn; }
  };
  const source = fs.readFileSync(new URL("../static/js/live.mjs", import.meta.url), "utf8");
  vm.runInNewContext(source.replace(/^import .*;\n/, ""), context);
  await new Promise(resolve => setImmediate(resolve));
  context.window.onYouTubeIframeAPIReady();
  options.events.onReady();
  assert.equal(calls[0][1].videoId, "bbbbbbbbbbb");
  assert.equal(calls[0][1].startSeconds, 2.5);
  now = epoch + 19000;
  tick();
  assert.equal(calls.at(-1)[1], 9);
  options.events.onStateChange({ data: 2 });
  now = epoch + 22000;
  options.events.onStateChange({ data: 1 });
  assert.equal(calls.at(-1)[1], 12);
  options.events.onError();
  const count = calls.length;
  tick();
  assert.equal(calls.length, count);
  now = epoch + 31000;
  tick();
  assert.equal(calls.at(-1)[1].videoId, "aaaaaaaaaaa");
  assert.equal(calls.at(-1)[1].startSeconds, 1);
  elements.get("#live-join").click();
  assert.equal(calls.at(-1)[0], "seek");
  remote = { ...data, tracks: [...data.tracks, { id: "ccccccccccc", title: "New", duration: 15 }] };
  await refresh();
  assert.equal(calls.at(-1)[1].videoId, "ccccccccccc");
  assert.equal(calls.at(-1)[1].startSeconds, 1);
  remote = { tracks: [] };
  await refresh();
  now = epoch + 32000;
  tick();
  assert.equal(elements.get("#live-title").textContent, "New");
});
