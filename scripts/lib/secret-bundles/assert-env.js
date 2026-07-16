#!/usr/bin/env node

const expected = process.argv.slice(2);
const missing = expected.filter((name) => !Object.prototype.hasOwnProperty.call(process.env, name) || !process.env[name]);

// This child communicates only by exit status because its parent suppresses all
// child output. It never prints environment names or values.
process.exit(missing.length === 0 ? 0 : 1);
