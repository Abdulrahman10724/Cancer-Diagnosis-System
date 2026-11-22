// Same polynomial hash as HashMapper::hashKey in C++: h = h * 31 + byte, unsigned 64-bit.
const MASK = (1n << 64n) - 1n;

export function hashSteps(key) {
  const bytes = new TextEncoder().encode(key);
  let h = 0n;
  const steps = [];
  bytes.forEach((code, i) => {
    h = (h * 31n + BigInt(code)) & MASK;
    steps.push({ char: key[i] ?? '?', code, h });
  });
  return { steps, hash: h };
}

export const bucketOf = (key, bucketCount) => Number(hashSteps(key).hash % BigInt(bucketCount));
