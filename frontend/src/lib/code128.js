// Encode text for the Libre Barcode 128 font as a valid Code 128 (set B) symbol:
// start character, data, modulo-103 checksum, stop character.
const toChar = (value) => String.fromCharCode(value < 95 ? value + 32 : value + 100);

export function code128B(text) {
  const clean = Array.from(String(text)).filter((c) => {
    const code = c.charCodeAt(0);
    return code >= 32 && code <= 126;
  });
  const START_B = 104;
  const STOP = 106;
  let sum = START_B;
  clean.forEach((c, i) => {
    sum += (c.charCodeAt(0) - 32) * (i + 1);
  });
  return toChar(START_B) + clean.join('') + toChar(sum % 103) + toChar(STOP);
}
