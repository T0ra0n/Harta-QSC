/* Scop: Generează automat assets/locations.json scanând folderele assets/lucrari/<locatie> (meta.json + descriere.txt + imagini). */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const projectRoot = process.cwd();
const lucrariDir = path.join(projectRoot, 'assets', 'lucrari');
const outputFile = path.join(projectRoot, 'assets', 'locations.json');

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const THUMB_SUFFIX = '_thumb';

function toPosixPath(p) {
  return p.split(path.sep).join('/');
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readUtf8OrEmpty(filePath) {
  if (!(await exists(filePath))) return '';
  return (await fs.readFile(filePath, 'utf8')).trim();
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function listDirectories(dirPath) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => e.name);
}

async function listImages(dirPath) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const files = entries
    .filter((e) => e.isFile())
    .map((e) => e.name)
    .filter((name) => IMAGE_EXTENSIONS.has(path.extname(name).toLowerCase()))
    .filter((name) => !path.basename(name, path.extname(name)).endsWith(THUMB_SUFFIX))
    .sort((a, b) => a.localeCompare(b, 'ro'));

  return files;
}

async function findThumbnail(dirPath, fileName) {
  const ext = path.extname(fileName);
  const base = path.basename(fileName, ext);

  const expectedSameExt = path.join(dirPath, `${base}${THUMB_SUFFIX}${ext}`);
  if (await exists(expectedSameExt)) return `${base}${THUMB_SUFFIX}${ext}`;

  for (const candidateExt of IMAGE_EXTENSIONS) {
    const candidate = path.join(dirPath, `${base}${THUMB_SUFFIX}${candidateExt}`);
    if (await exists(candidate)) return `${base}${THUMB_SUFFIX}${candidateExt}`;
  }

  return null;
}

export async function generateLocations() {
  const locationFolders = await listDirectories(lucrariDir);

  const locations = [];

  for (const folder of locationFolders) {
    const folderPath = path.join(lucrariDir, folder);
    const metaPath = path.join(folderPath, 'meta.json');

    if (!(await exists(metaPath))) {
      console.warn(`Lipsește meta.json în: assets/lucrari/${folder}/ (ignor)`);
      continue;
    }

    const meta = await readJson(metaPath);
    const description = await readUtf8OrEmpty(path.join(folderPath, 'descriere.txt'));

    const images = await listImages(folderPath);
    if (images.length === 0) {
      console.warn(`Nu există imagini în: assets/lucrari/${folder}/ (ignor)`);
      continue;
    }

    const normalizedImages = [];
    for (let index = 0; index < images.length; index += 1) {
      const fileName = images[index];
      const rel = toPosixPath(path.join('assets', 'lucrari', folder, fileName));

      const thumbFileName = await findThumbnail(folderPath, fileName);
      const thumbRel = thumbFileName
        ? toPosixPath(path.join('assets', 'lucrari', folder, thumbFileName))
        : rel;

      normalizedImages.push({
        src: `./${rel}`,
        thumb: `./${thumbRel}`,
        alt: meta.title ? `${meta.title} - Imagine ${index + 1}` : `Imagine ${index + 1}`,
      });
    }

    locations.push({
      id: meta.id ?? folder,
      title: meta.title ?? folder,
      subtitle: meta.subtitle ?? '',
      description,
      lat: meta.lat,
      lng: meta.lng,
      images: normalizedImages,
    });
  }

  locations.sort((a, b) => String(a.title).localeCompare(String(b.title), 'ro'));

  const output = {
    version: 1,
    generatedAt: new Date().toISOString(),
    locations,
  };

  await fs.mkdir(path.dirname(outputFile), { recursive: true });
  await fs.writeFile(outputFile, JSON.stringify(output, null, 2) + '\n', 'utf8');

  console.log(`OK: generat ${toPosixPath(path.relative(projectRoot, outputFile))} cu ${locations.length} locații.`);
}

const isDirectRun = import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  generateLocations().catch((err) => {
    console.error('Eroare la generare locations.json:', err);
    process.exitCode = 1;
  });
}
