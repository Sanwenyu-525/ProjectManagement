import { stripAnsi } from './stripAnsi';

/** Parsed Claude CLI stream-json event */
export interface StreamJsonEvent {
  type: 'system' | 'assistant' | 'user' | 'result' | 'error';
  subtype?: string;
  session_id?: string;
  model?: string;
  tools?: string[];
  cwd?: string;
  attempt?: number;
  max_retries?: number;
  retry_delay_ms?: number;
  error_status?: number;
  message?: {
    content?: Array<{
      type: string;
      text?: string;
      id?: string;
      name?: string;
      input?: Record<string, unknown>;
      tool_use_id?: string;
      thinking?: string;
      is_error?: boolean;
      [key: string]: unknown;
    }>;
  };
  result?: string;
  error?: string;
  is_error?: boolean;
  duration_ms?: number;
  total_cost_usd?: number;
  num_turns?: number;
}

/**
 * Result of extracting JSON objects from a stream buffer.
 * `events` — successfully parsed objects.
 * `buffer` — unconsumed data to pass back into the next call.
 * `pending` — a line that started with `{` but was held back because it
 *             might be an incomplete object split across chunks.
 * `failedLines` — raw lines starting with `{` that failed all parse strategies
 *                  (brace-balanced but unparseable). Consumers can attempt
 *                  provider-specific recovery (e.g. regex session_id extraction).
 */
export interface ExtractResult {
  events: StreamJsonEvent[];
  buffer: string;
  pending: string;
  failedLines: string[];
}

/**
 * Try to parse a JSON object string with progressive fallback strategies.
 * PTY output may contain control characters inside JSON string values
 * (e.g. from terminal escape sequences not fully stripped by stripAnsi),
 * which break JSON.parse. We try multiple strategies to recover.
 *
 * Returns the parsed event on success, null otherwise.
 */
export function tryParseObject(objStr: string): StreamJsonEvent | null {
  // Strategy 1: parse as-is (fast path for clean data)
  try {
    return JSON.parse(objStr) as StreamJsonEvent;
  } catch { /* fall through */ }

  // Strategy 2: strip control characters 0x00-0x1f
  // eslint-disable-next-line no-control-regex -- Intentional: stripping control chars from PTY output
  const cleaned = objStr.replace(/[\x00-\x1f]/g, '');
  try {
    return JSON.parse(cleaned) as StreamJsonEvent;
  } catch { /* fall through */ }

  // Strategy 3: aggressive strip — remove non-printable chars outside basic ASCII
  const aggressive = objStr.replace(/[^\x20-\x7e]/g, '');
  try {
    return JSON.parse(aggressive) as StreamJsonEvent;
  } catch { /* fall through */ }

  // Strategy 4: repair malformed JSON from non-official API backends
  // Some backends emit invalid syntax like `"key"::` (double colon)
  const repaired = repairMalformedJson(cleaned);
  if (repaired !== cleaned) {
    try {
      return JSON.parse(repaired) as StreamJsonEvent;
    } catch { /* fall through */ }
  }

  // Strategy 5: brace-matching — extract first complete JSON object from line
  // Handles trailing garbage, extra content, or line concatenation artifacts
  const extracted = extractFirstJsonObject(aggressive);
  if (extracted && extracted !== aggressive) {
    try {
      return JSON.parse(extracted) as StreamJsonEvent;
    } catch { /* fall through */ }
  }

  return null;
}

/**
 * Check if a line has more open braces than close braces
 * (indicating a split JSON object).
 */
export function hasUnbalancedBraces(s: string): boolean {
  let depth = 0;
  let inString = false;
  let escape = false;
  for (const ch of s) {
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depth++;
    if (ch === '}') depth--;
  }
  return depth > 0;
}

/**
 * Split a string containing multiple concatenated JSON objects into individual objects.
 * E.g. '{"a":1}{"b":2}' -> ['{"a":1}', '{"b":2}']
 */
export function splitJsonObjects(s: string): string[] {
  const objects: string[] = [];
  let depth = 0;
  let inString = false;
  let escape = false;
  let start = -1;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0 && start !== -1) {
        objects.push(s.slice(start, i + 1));
        start = -1;
      }
    }
  }
  return objects;
}

/**
 * Repair common JSON syntax errors from non-official API backends.
 * Currently handles: `"key"::` -> `"key":` (double colon after property name).
 */
export function repairMalformedJson(s: string): string {
  return s.replace(/"(\w+)"::/g, '"$1":');
}

/**
 * Extract the first complete JSON object from a string using brace depth tracking.
 * Handles cases where the line contains extra content before/after the JSON.
 */
export function extractFirstJsonObject(s: string): string | null {
  const start = s.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

/**
 * Extract complete JSON objects from a stream buffer.
 *
 * Strategy: split by newlines first (stream-json is NDJSON — one JSON per line).
 * Lines that don't parse are accumulated. If a line starts with '{' but doesn't
 * parse, we hold it in the buffer waiting for more data. Non-JSON lines (banner
 * text, PTY control output) are discarded.
 *
 * @param jsonBuffer — The current accumulated buffer (raw PTY output, may contain ANSI).
 * @param pending    — A line from a previous call that started with '{' but wasn't
 *                     yet complete (unbalanced braces).
 * @returns Parsed events, remaining buffer, and any new pending line.
 */
export function extractJsonObjects(
  jsonBuffer: string,
  pending: string,
): ExtractResult {
  const events: StreamJsonEvent[] = [];
  const failedLines: string[] = [];

  // Fast path: skip ANSI stripping when buffer contains no escape sequences
  const buf = jsonBuffer.indexOf('\x1b') >= 0
    ? stripAnsi(jsonBuffer)
    : jsonBuffer;
  const lines = buf.split('\n');

  // Last line may be incomplete — hold it back
  const maybePending = lines.pop() ?? '';

  let pendingPartial = pending;

  for (const rawLine of lines) {
    const line = (pendingPartial + rawLine).trim();
    pendingPartial = '';

    if (!line) continue;
    if (!line.startsWith('{')) continue; // skip non-JSON lines (banner, prompts)

    // Try parsing as a single object first (fast path)
    const parsed = tryParseObject(line);
    if (parsed) {
      events.push(parsed);
      continue;
    }

    // Line starts with '{' — might be concatenated JSON objects (no newline between them)
    // Split by brace-depth to extract each complete object
    const objects = splitJsonObjects(line);
    if (objects.length > 1) {
      for (const obj of objects) {
        const p = tryParseObject(obj);
        if (p) events.push(p);
      }
      continue;
    }

    // Line starts with '{' but didn't parse — could be partial (split across lines
    // due to newlines in string values like thinking content). Check brace balance.
    if (hasUnbalancedBraces(line)) {
      pendingPartial = line;
      continue;
    }

    // Brace-balanced but still didn't parse — track for provider-specific recovery
    failedLines.push(line);
  }

  // Whatever is left (pending partial + last incomplete line) goes back to buffer
  const buffer = pendingPartial
    ? pendingPartial + '\n' + maybePending
    : maybePending;

  return { events, buffer, pending: pendingPartial, failedLines };
}
