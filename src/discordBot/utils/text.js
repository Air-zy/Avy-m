function toText(value) {
  function circularReplacer() {
    const seen = new WeakSet();
    return (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) return undefined;
        seen.add(value);
      }
      return value;
    };
  }

  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || value instanceof Date) {
    return value.toString();
  }
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object' && value !== null) {
    if (Buffer.isBuffer(value)) return value.toString('utf8');
    return JSON.stringify(value, circularReplacer(), 2);
  }
  return String(value);
}

function reverseLines(originalString) {
  return originalString.split('\n').reverse().join('\n');
}

module.exports = { toText, reverseLines };
