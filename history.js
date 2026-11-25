import { readFile, writeFile, rename } from "node:fs/promises";

async function readLinks(file) {
  let text;

  try {
    text = await readFile(file, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }

  try {
    let links = JSON.parse(text);

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

    if (Array.isArray(links) && links.every((link) => typeof link === "string")) {
      return links;
    }
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
  }

  // A damaged file is set aside and the history starts over, which records
  // the current articles without posting them.
  const backup = `${file}.corrupt`;

  await rename(file, backup);
  console.warn(`Invalid history file moved to ${backup}.`);

  return null;
}

export async function openHistory(file, limit = 100, key = (link) => link) {
  const links = await readLinks(file);
  const seen = new Map();

  function add(link) {
    const id = key(link);

    seen.delete(id);
    seen.set(id, link);
  }

  function trim() {
    while (seen.size > limit) {
      seen.delete(seen.keys().next().value);
    }
  }

  links?.forEach(add);
  trim();

  let initialized = links !== null;
  let dirty = initialized && seen.size !== links.length;

  async function flush() {
    if (!dirty) return;

    const tempFile = `${file}.tmp`;

    await writeFile(tempFile, JSON.stringify([...seen.values()], null, 2));
    await rename(tempFile, file);

    dirty = false;
  }

  async function remember(...links) {
    links.forEach(add);
    trim();

    initialized = true;
    dirty = true;

    await flush();
  }

  return {
    get initialized() {
      return initialized;
    },
    has: (link) => seen.has(key(link)),
    remember,
    flush,
  };
}
