/**
 * Strip ANSI escape sequences and stray control characters from a string.
 *
 * Handles CSI sequences (ESC [ ...), OSC sequences (ESC ] ... BEL/ST),
 * and other ESC-prefixed codes. Keeps \n, \r, \t.
 */

// eslint-disable-next-line no-control-regex -- Intentional: matching ANSI/control escape sequences
const ANSI_CSI_RE = /\x1b\[[0-9;]*[a-zA-Z]/g;
// eslint-disable-next-line no-control-regex
const ANSI_OSC_BEL_RE = /\x1b\][^\x07\x1b]*\x07/g;
// eslint-disable-next-line no-control-regex
const ANSI_OSC_ST_RE = /\x1b\][^\x07\x1b]*\x1b\\/g;
// eslint-disable-next-line no-control-regex
const ANSI_OTHER_RE_1 = /\x1b[()][AB012]/g;
// eslint-disable-next-line no-control-regex
const ANSI_OTHER_RE_2 = /\x1b[=>]/g;
// eslint-disable-next-line no-control-regex
const ANSI_DSR_RE = /\x1b\[\?[0-9;]*[a-zA-Z]/g;
// eslint-disable-next-line no-control-regex -- Intentional: matching stray control chars (keep \n \r \t)
const CTRL_CHAR_RE = /[\x00-\x08\x0b\x0c\x0e-\x1f]/g;

export function stripAnsi(str: string): string {
  return str
    .replace(ANSI_CSI_RE, '')
    .replace(ANSI_OSC_BEL_RE, '')
    .replace(ANSI_OSC_ST_RE, '')
    .replace(ANSI_OTHER_RE_1, '')
    .replace(ANSI_OTHER_RE_2, '')
    .replace(ANSI_DSR_RE, '')
    .replace(CTRL_CHAR_RE, '');
}
