#!/usr/bin/env node

const assert = require("assert");
const path = require("path");
const zlib = require("zlib");

const ROOT = path.resolve(__dirname, "..");
const helper = require(path.join(ROOT, "scripts", "browser-live-proof"));

function observation(overrides = {}) {
  const base = {
    target: { url: "http://127.0.0.1:4173/", remote: false, query_present: false, final_location: "same_origin" },
    browser: { family: "chromium", version: "144.0.0.0" },
    viewport: { width: 390, height: 844, device_scale_factor: 1 },
    navigation: {
      http_status: 200,
      ready_state: "complete",
      load_event_observed: true,
      title_present: true,
      duration_ms: 250,
    },
    layout: {
      viewport_width: 390,
      viewport_height: 844,
      document_width: 390,
      document_height: 1200,
      viewport_matches_requested: true,
      horizontal_overflow: false,
    },
    accessibility: {
      language_present: true,
      headings: 3,
      interactive_elements: 4,
      unlabelled_interactive: 0,
      images: 1,
      images_missing_alt: 0,
      videos: 0,
    },
    console: { messages: 0, warnings: 0, errors: 0, exceptions: 0, categories: {} },
    network: { requests: 3, responses: 3, failed_requests: 0, blocked_remote_requests: 0, blocked_remote_documents: 0, status_classes: { "2xx": 3 }, resource_types: { Document: 1 } },
    screenshot: { requested: true, captured: true, filename: "proof.png", bytes: 1024, png_valid: true, nonblank: true, sampled_colors: 2 },
  };
  return {
    ...base,
    ...overrides,
    target: { ...base.target, ...(overrides.target || {}) },
    navigation: { ...base.navigation, ...(overrides.navigation || {}) },
    layout: { ...base.layout, ...(overrides.layout || {}) },
    accessibility: { ...base.accessibility, ...(overrides.accessibility || {}) },
    console: { ...base.console, ...(overrides.console || {}) },
    network: { ...base.network, ...(overrides.network || {}) },
    screenshot: { ...base.screenshot, ...(overrides.screenshot || {}) },
  };
}

function testArgumentAndTargetBoundaries() {
  const args = helper.parseArgs(["--url", "http://localhost:3000", "--viewport", "375x812", "--json"]);
  assert.deepStrictEqual(args.viewport, { width: 375, height: 812 });
  assert.strictEqual(args.json, true);
  assert.strictEqual(helper.validateTarget("http://127.0.0.1:3000", false).hostname, "127.0.0.1");
  assert.throws(() => helper.validateTarget("https://example.com", false), /remote URL blocked/);
  assert.strictEqual(helper.validateTarget("https://example.com", true).hostname, "example.com");
  assert.throws(() => helper.validateTarget("https://user:pass@example.com", true), /credential-bearing/);
  assert.throws(() => helper.validateTarget("https://example.com/?access_token=value", true), /sensitive query/);
  assert.throws(() => helper.validateTarget("file:///tmp/page.html", false), /http or https/);
}

function testRedactionAndClassification() {
  assert.strictEqual(
    helper.safeDisplayUrl("https://example.com/items/123e4567-e89b-12d3-a456-426614174000?view=full#top"),
    "https://example.com/items/[redacted-segment]",
  );
  assert.strictEqual(helper.classifyConsoleMessage("Failed to load resource: net::ERR_FAILED"), "failed_resource");
  assert.strictEqual(helper.classifyConsoleMessage("Uncaught TypeError"), "uncaught_exception");
  assert.strictEqual(helper.classifyConsoleMessage("ordinary diagnostic"), "other");
  assert.strictEqual(
    helper.classifyFinalLocation(new URL("http://127.0.0.1:3000"), "chrome-error://chromewebdata/"),
    "browser_error",
  );
}

function pngChunk(type, data) {
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  chunk.write(type, 4, 4, "ascii");
  data.copy(chunk, 8);
  return chunk;
}

function testPngAnalysis() {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(2, 0);
  ihdr.writeUInt32BE(1, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const row = Buffer.from([0, 255, 255, 255, 0, 0, 0]);
  const png = Buffer.concat([signature, pngChunk("IHDR", ihdr), pngChunk("IDAT", zlib.deflateSync(row)), pngChunk("IEND", Buffer.alloc(0))]);
  assert.deepStrictEqual(helper.analyzePng(png), { png_valid: true, nonblank: true, sampled_colors: 2 });
  assert.equal(helper.analyzePng(Buffer.from("not png")).png_valid, false);
}

function testTruthClassification() {
  const passing = helper.buildBrowserProofReport(observation());
  assert.strictEqual(passing.status, "PASS");
  assert.deepStrictEqual(helper.validateBrowserProof(passing), []);
  assert.strictEqual(passing.signals.find((signal) => signal.id === "production_correctness").state, "NOT_VERIFIED");
  assert.strictEqual(passing.signals.find((signal) => signal.id === "screenshot").state, "VERIFIED");

  const warning = helper.buildBrowserProofReport(observation({
    console: { errors: 1, exceptions: 1, categories: { uncaught_exception: 1 } },
    accessibility: { unlabelled_interactive: 2 },
  }));
  assert.strictEqual(warning.status, "WARN");

  const failing = helper.buildBrowserProofReport(observation({
    layout: { horizontal_overflow: true, document_width: 420 },
  }));
  assert.strictEqual(failing.status, "FAIL");
  assert.strictEqual(failing.signals.find((signal) => signal.id === "no_horizontal_overflow").state, "FAILED");

  const redirected = helper.buildBrowserProofReport(observation({
    network: { blocked_remote_requests: 1, blocked_remote_documents: 1 },
  }));
  assert.strictEqual(redirected.status, "FAIL");
  assert.strictEqual(redirected.signals.find((signal) => signal.id === "navigation").state, "FAILED");

  const crossOrigin = helper.buildBrowserProofReport(observation({ target: { final_location: "different_origin" } }));
  assert.strictEqual(crossOrigin.status, "WARN");
  assert.strictEqual(crossOrigin.signals.find((signal) => signal.id === "redirect_boundary").state, "WARNING");

  const blankScreenshot = helper.buildBrowserProofReport(observation({ screenshot: { nonblank: false, sampled_colors: 1 } }));
  assert.strictEqual(blankScreenshot.status, "WARN");
  assert.strictEqual(blankScreenshot.signals.find((signal) => signal.id === "screenshot_content").state, "WARNING");

  const viewportMismatch = helper.buildBrowserProofReport(observation({ layout: { viewport_width: 980, viewport_matches_requested: false } }));
  assert.strictEqual(viewportMismatch.status, "WARN");
  assert.strictEqual(viewportMismatch.signals.find((signal) => signal.id === "viewport_application").state, "WARNING");
}

function testNoRawEvidenceOrPrivatePaths() {
  const report = helper.buildBrowserProofReport(observation());
  const serialized = JSON.stringify(report);
  for (const forbidden of ["headers", "cookies", "local_storage", "response_body", "page_text"]) {
    assert(!serialized.includes(`\"${forbidden}\"`));
  }

  const leaky = structuredClone(report);
  leaky.screenshot.filename = ["", "home", "example", "private", "proof.png"].join("/");
  assert(helper.validateBrowserProof(leaky).some((error) => error.includes("private paths")));

  const secretLike = structuredClone(report);
  secretLike.target.url = "https://example.com/?token=Bearer%20abcdefghijklmnopqrstuvwxyz";
  assert(helper.validateBrowserProof(secretLike).some((error) => error.includes("target.url")));
}

function testHumanOutput() {
  const report = helper.buildBrowserProofReport(observation());
  const human = helper.renderHuman(report);
  assert(human.includes("# Browser Live Proof"));
  assert(human.includes("NOT_VERIFIED: production_correctness"));
  assert(!human.includes("ordinary diagnostic"));
}

testArgumentAndTargetBoundaries();
testRedactionAndClassification();
testPngAnalysis();
testTruthClassification();
testNoRawEvidenceOrPrivatePaths();
testHumanOutput();

console.log("browser-live-proof tests passed");
