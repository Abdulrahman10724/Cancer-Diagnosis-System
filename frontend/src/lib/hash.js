// Same polynomial rolling hash as HashMapper::hashKey in C++ (unsigned 64-bit).
// BigInt keeps the exact value; JSON numbers lose precision above 2^53.
const MASK = (1n << 64n) - 1n;

export function hashKey(key) {
  let h = 0n;
  for (const byte of new TextEncoder().encode(key)) {
    h = (h * 31n + BigInt(byte)) & MASK;
  }
  return h;
}

export function bucketFor(key, bucketCount) {
  const hash = hashKey(key);
  return { hash, index: Number(hash % BigInt(bucketCount)) };
}
