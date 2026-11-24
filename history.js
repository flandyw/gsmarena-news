import { readFile, writeFile, rename } from "node:fs/promises";

export async function openHistory(file, limit = 100) {
  let links = null;

  try {
    links = JSON.parse(await readFile(file, "utf8"));

    // Migrate the previous timestamp-based format
    if (
      links &&
      typeof links === "object" &&
      !Array.isArray(links) &&
      Object.values(links).every(Number.isSafeInteger)
    ) {
      links = Object.entries(links)
        .sort((a, b) => a[1] - b[1])
        .map(([link]) => link);
    }

    if (
      !Array.isArray(links) ||
      !links.every((link) => typeof link === "string")
    ) {
      throw new Error("Invalid history file.");
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  const seen = new Set(
    [...new Set(links ?? [])].slice(-limit)
  );

  let initialized = links !== null;
  let dirty = initialized;

  async function flush() {
    if (!dirty) return;

    const tempFile = `${file}.tmp`;

    await writeFile(tempFile, JSON.stringify([...seen], null, 2));
    await rename(tempFile, file);

    dirty = false;
  }

  async function remember(...links) {
    for (const link of links) {
      seen.add(link);
    }

    while (seen.size > limit) {
      seen.delete(seen.values().next().value);
    }

    initialized = true;
    dirty = true;

    await flush();
  }

  return {
    get initialized() {
      return initialized;
    },
    has: (link) => seen.has(link),
    remember,
    flush,
  };
}