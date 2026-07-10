// _shared/moderation.ts
// The deterministic half of review moderation. Pure and dependency-free.
//
// A review body is untrusted input that we hand to a language model. Two
// defences live here, and neither one trusts the model:
//
//   sanitizeUntrusted()  strips the delimiter we wrap the body in, so a review
//                        cannot close the tag and start issuing instructions.
//   publishGate()        decides, in code, whether a body is even eligible to be
//                        published. It runs BEFORE the model sees the body, so a
//                        body that trips it never reaches the prompt at all.
//
// The model can still be wrong about the five abuse axes. It cannot publish a
// review the gate rejected, and it cannot see a body the gate quarantined.

/** The tag we wrap the untrusted review body in when prompting. */
export const REVIEW_BODY_TAG = "review_body";

/**
 * Remove any occurrence of our delimiter from untrusted text. Without this a
 * body containing `</review_body>` could escape the data block and have the
 * rest of its text read as instructions.
 */
export function sanitizeUntrusted(text: unknown): string {
  // Whitespace is permitted everywhere a tokenizer would tolerate it:
  // `< / review_body >` has to die the same way `</review_body>` does.
  return String(text ?? "").replace(
    new RegExp(`<\\s*\\/?\\s*${REVIEW_BODY_TAG}\\s*>`, "gi"),
    "",
  );
}

/** Longest body we will send to the model or publish. */
export const MAX_BODY_LENGTH = 4000;

const URL_RE = /\b(?:https?:\/\/|www\.)\S+/i;
const EMAIL_RE = /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/;
// Candidate phone runs; we count digits afterwards so that dates ("2024-01-01",
// 8 digits) and price ranges ("KSh 1,500-6,000") don't trip it.
const PHONE_CANDIDATE_RE = /\+?\d[\d\s().-]{7,}\d/g;
const MIN_PHONE_DIGITS = 9;

// Phrases that only appear when someone is talking TO the model rather than
// about the business.
const INJECTION_RE = new RegExp(
  [
    "ignore\\s+(?:all\\s+|any\\s+)?(?:previous|prior|above)\\s+instructions",
    "disregard\\s+(?:the\\s+)?(?:above|previous|prior)",
    "system\\s+prompt",
    "you\\s+are\\s+(?:now\\s+)?an?\\s",
    "<\\s*/?\\s*(?:system|instructions?|review_body)\\s*>",
    '"(?:authentic|off_topic|hate_speech|promotional|coordinated)"\\s*:',
    "^\\s*(?:assistant|human)\\s*:",
  ].join("|"),
  "im",
);

export interface GateResult {
  /** True only when the body is eligible for automatic publication. */
  clean: boolean;
  /** Machine-readable reasons, empty when clean. */
  reasons: string[];
}

/** The tool the model is forced to call. Its input IS the classification. */
export const CLASSIFY_TOOL = "record_classification";

export interface Classification {
  authentic: boolean;
  off_topic: boolean;
  hate_speech: boolean;
  promotional: boolean;
  coordinated: boolean;
  reasoning: string;
}

/**
 * Read the forced tool call out of an Anthropic response.
 *
 * We deliberately do NOT fall back to scraping the first `{...}` block out of a
 * text block. That fallback is precisely what let a crafted review body supply
 * its own verdict: write a JSON object in the review, get it parsed as the
 * model's answer. If the model didn't call the tool, we have no classification
 * and the review stays pending for the next run.
 */
export function readClassification(data: unknown): Classification | null {
  const content = (data as { content?: unknown[] })?.content;
  if (!Array.isArray(content)) return null;

  const block = content.find((b) => {
    const candidate = b as { type?: string; name?: string };
    return candidate?.type === "tool_use" && candidate?.name === CLASSIFY_TOOL;
  }) as { input?: Record<string, unknown> } | undefined;

  const input = block?.input;
  if (!input) return null;

  const axes = [
    "authentic",
    "off_topic",
    "hate_speech",
    "promotional",
    "coordinated",
  ] as const;
  if (!axes.every((axis) => typeof input[axis] === "boolean")) return null;

  return {
    authentic: input.authentic as boolean,
    off_topic: input.off_topic as boolean,
    hate_speech: input.hate_speech as boolean,
    promotional: input.promotional as boolean,
    coordinated: input.coordinated as boolean,
    reasoning: typeof input.reasoning === "string" ? input.reasoning : "",
  };
}

function looksLikePhoneNumber(body: string): boolean {
  for (const match of body.matchAll(PHONE_CANDIDATE_RE)) {
    const digits = match[0].replace(/\D/g, "").length;
    if (digits >= MIN_PHONE_DIGITS) return true;
  }
  return false;
}

/**
 * The independent publish gate. A failure here forces `flagged` regardless of
 * what the model concludes — no single model response can promote a review.
 *
 * Failing sends the review to a human, not to the bin, so a false positive
 * costs a moderator a few seconds. That is the direction we want to be wrong in.
 */
export function publishGate(body: string): GateResult {
  const reasons: string[] = [];

  if (body.length > MAX_BODY_LENGTH) reasons.push("too_long");
  if (URL_RE.test(body)) reasons.push("contains_url");
  if (EMAIL_RE.test(body)) reasons.push("contains_email");
  if (looksLikePhoneNumber(body)) reasons.push("contains_phone_number");
  if (INJECTION_RE.test(body)) reasons.push("prompt_injection_marker");

  return { clean: reasons.length === 0, reasons };
}
