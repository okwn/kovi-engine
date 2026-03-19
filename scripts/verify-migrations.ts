import { readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const MIGRATIONS_DIR = resolve(process.cwd(), 'infra', 'migrations');

const run = (): void => {
  let stats;
  try {
    stats = statSync(MIGRATIONS_DIR);
  } catch {
    process.stderr.write(`[migrations-validation] missing directory: ${MIGRATIONS_DIR}\n`);
    process.exit(1);
  }

  if (!stats.isDirectory()) {
    process.stderr.write(
      `[migrations-validation] expected a directory at ${MIGRATIONS_DIR}, but found something else\n`,
    );
    process.exit(1);
  }

  const files = readdirSync(MIGRATIONS_DIR).filter((file) => file.endsWith('.sql')).sort();

  if (files.length === 0) {
    process.stderr.write(
      `[migrations-validation] no .sql files found in ${MIGRATIONS_DIR}; expected at least one migration\n`,
    );
    process.exit(1);
  }

  // Ensure filenames follow the expected "<NNN>_description.sql" pattern and are ordered.
  const pattern = /^(\d{3})_.+\.sql$/;
  const seenNumbers = new Set<number>();

  for (const file of files) {
    const match = file.match(pattern);
    if (!match) {
      process.stderr.write(
        `[migrations-validation] invalid migration filename "${file}". Expected pattern "<NNN>_description.sql"\n`,
      );
      process.exit(1);
    }

    const num = Number(match[1]);
    if (seenNumbers.has(num)) {
      process.stderr.write(
        `[migrations-validation] duplicate migration number ${num.toString().padStart(3, '0')} in "${file}"\n`,
      );
      process.exit(1);
    }
    seenNumbers.add(num);
  }

  // Basic monotonicity check: numbers should start at 1 and be strictly increasing,
  // but we don't enforce contiguity to keep it flexible across branches.
  const sortedNumbers = Array.from(seenNumbers).sort((a, b) => a - b);
  if (sortedNumbers[0] < 1) {
    process.stderr.write(
      `[migrations-validation] lowest migration number must be >= 001, found ${sortedNumbers[0]
        .toString()
        .padStart(3, '0')}\n`,
    );
    process.exit(1);
  }

  process.stdout.write(
    `[migrations-validation] success. Found ${files.length} migration(s) in ${MIGRATIONS_DIR}\n`,
  );
};

try {
  run();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`[migrations-validation] unexpected error: ${message}\n`);
  process.exit(1);
}

