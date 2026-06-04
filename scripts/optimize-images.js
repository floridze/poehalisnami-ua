import path from "node:path";
import { fileURLToPath } from "node:url";
import { cp, mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { optimize } from "svgo";

const projectDirectoryPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDirectoryPath = path.join(projectDirectoryPath, "src/images");
const outputDirectoryPath = path.join(projectDirectoryPath, "site/assets/images");
const outputHtmlFilePath = path.join(projectDirectoryPath, "site/index.html");
const supportedImageExtensions = new Set([".avif", ".jpeg", ".jpg", ".png", ".svg", ".webp"]);
const webpSourceExtensions = new Set([".jpeg", ".jpg", ".png"]);

async function getDirectoryFilePaths(directoryPath) {
  const directoryEntries = await readdir(directoryPath, { withFileTypes: true });
  const filePaths = await Promise.all(
    directoryEntries.map(async (directoryEntry) => {
      const entryPath = path.join(directoryPath, directoryEntry.name);

      if (directoryEntry.isDirectory()) {
        return getDirectoryFilePaths(entryPath);
      }

      return [entryPath];
    })
  );

  return filePaths.flat();
}

function optimizeSvgImage(imageBuffer) {
  const optimizedSvg = optimize(imageBuffer.toString("utf8"), {
    multipass: true,
    plugins: [
      {
        name: "preset-default",
        params: {
          overrides: {
            cleanupIds: false,
            removeHiddenElems: false,
            removeUselessDefs: false,
          },
        },
      },
      "sortAttrs",
    ],
  });

  return Buffer.from(optimizedSvg.data);
}

async function optimizeRasterImage(imageBuffer, imageExtension) {
  const imagePipeline = sharp(imageBuffer, { animated: false });

  switch (imageExtension) {
    case ".avif":
      return imagePipeline.avif({
        effort: 4,
        quality: 82,
      }).toBuffer();
    case ".jpeg":
    case ".jpg":
      return imagePipeline.jpeg({
        mozjpeg: true,
        progressive: true,
        quality: 84,
      }).toBuffer();
    case ".png":
      return imagePipeline.png({
        adaptiveFiltering: true,
        compressionLevel: 9,
      }).toBuffer();
    case ".webp":
      return imagePipeline.webp({
        effort: 4,
        nearLossless: true,
        quality: 92,
      }).toBuffer();
    default:
      return imageBuffer;
  }
}

async function optimizeImageFile(filePath) {
  const imageExtension = path.extname(filePath).toLowerCase();

  if (!supportedImageExtensions.has(imageExtension)) {
    return 0;
  }

  const originalImageBuffer = await readFile(filePath);
  const optimizedImageBuffer =
    imageExtension === ".svg" ? optimizeSvgImage(originalImageBuffer) : await optimizeRasterImage(originalImageBuffer, imageExtension);

  if (optimizedImageBuffer.length >= originalImageBuffer.length) {
    return 0;
  }

  await writeFile(filePath, optimizedImageBuffer);

  return originalImageBuffer.length - optimizedImageBuffer.length;
}

async function createWebpImageFile(filePath) {
  const imageExtension = path.extname(filePath).toLowerCase();

  if (!webpSourceExtensions.has(imageExtension)) {
    return false;
  }

  const webpFilePath = filePath.replace(/\.(jpe?g|png)$/i, ".webp");
  const webpImageBuffer = await sharp(filePath, { animated: false })
    .webp({
      effort: 4,
      quality: 82,
    })
    .toBuffer();

  await writeFile(webpFilePath, webpImageBuffer);

  return true;
}

async function addWebpSourcesToHtmlFile() {
  let html;

  try {
    html = await readFile(outputHtmlFilePath, "utf8");
  } catch {
    return 0;
  }

  let replacementCount = 0;
  const htmlWithWebpSources = html.replace(
    /(<img\b(?=[^>]*\bsrc="(\.\/assets\/images\/[^"]+\.(?:jpe?g|png))")[^>]*\/?>)/g,
    (imageTag, _fullImageTag, imagePath, offset) => {
      const htmlBeforeImage = html.slice(Math.max(0, offset - 120), offset);

      if (htmlBeforeImage.includes("<picture") && !htmlBeforeImage.includes("</picture>")) {
        return imageTag;
      }

      replacementCount += 1;
      const webpPath = imagePath.replace(/\.(jpe?g|png)$/i, ".webp");

      return `<picture><source srcset="${webpPath}" type="image/webp">${imageTag}</picture>`;
    }
  );

  if (replacementCount > 0) {
    await writeFile(outputHtmlFilePath, htmlWithWebpSources);
  }

  return replacementCount;
}

async function rewriteSourceImageLinksInHtmlFile() {
  let html;

  try {
    html = await readFile(outputHtmlFilePath, "utf8");
  } catch {
    return 0;
  }

  let replacementCount = 0;
  const htmlWithAssetLinks = html.replace(
    /href="\.\/src\/images\/([^"]+\.(?:avif|jpe?g|png|svg|webp))"/g,
    (_hrefAttribute, imagePath) => {
      replacementCount += 1;

      return `href="./assets/images/${imagePath}"`;
    }
  );

  if (replacementCount > 0) {
    await writeFile(outputHtmlFilePath, htmlWithAssetLinks);
  }

  return replacementCount;
}

async function main() {
  try {
    await stat(sourceDirectoryPath);
    await mkdir(path.dirname(outputDirectoryPath), { recursive: true });
    await cp(sourceDirectoryPath, outputDirectoryPath, { recursive: true, force: true });
  } catch {
    console.log("No source images found to optimize.");

    return;
  }

  let outputDirectoryStats;

  try {
    outputDirectoryStats = await stat(outputDirectoryPath);
  } catch {
    console.log("No emitted images found to optimize.");

    return;
  }

  if (!outputDirectoryStats.isDirectory()) {
    console.log("No emitted images found to optimize.");

    return;
  }

  const imageFilePaths = await getDirectoryFilePaths(outputDirectoryPath);

  let optimizedImageCount = 0;
  let createdWebpImageCount = 0;
  let savedBytes = 0;

  for (const imageFilePath of imageFilePaths) {
    const currentSavedBytes = await optimizeImageFile(imageFilePath);
    const createdWebpImage = await createWebpImageFile(imageFilePath);

    if (currentSavedBytes > 0) {
      optimizedImageCount += 1;
      savedBytes += currentSavedBytes;
    }

    if (createdWebpImage) {
      createdWebpImageCount += 1;
    }
  }

  console.log(`Optimized ${optimizedImageCount} image${optimizedImageCount === 1 ? "" : "s"} and saved ${savedBytes} bytes.`);

  if (createdWebpImageCount > 0) {
    const htmlImageCount = await addWebpSourcesToHtmlFile();

    console.log(
      `Created ${createdWebpImageCount} WebP image${createdWebpImageCount === 1 ? "" : "s"} and added ${htmlImageCount} HTML source${
        htmlImageCount === 1 ? "" : "s"
      }.`
    );
  }

  const htmlImageLinkCount = await rewriteSourceImageLinksInHtmlFile();

  if (htmlImageLinkCount > 0) {
    console.log(`Rewritten ${htmlImageLinkCount} source image link${htmlImageLinkCount === 1 ? "" : "s"}.`);
  }
}

main().catch((error) => {
  console.error("Image optimization failed.");
  console.error(error);
  process.exitCode = 1;
});
