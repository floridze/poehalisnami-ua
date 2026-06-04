import path from "node:path";
import { fileURLToPath } from "node:url";
import { cp, readFile, rm, writeFile } from "node:fs/promises";
import { optimize } from "svgo";

const projectDirectoryPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const siteDirectoryPath = path.join(projectDirectoryPath, "site");
const localDirectoryPath = path.join(projectDirectoryPath, "site-local");
const spriteFilePath = path.join(siteDirectoryPath, "assets/images/sprite-icons.svg");
const scriptFilePath = path.join(siteDirectoryPath, "assets/js/home.js");
const styleFilePath = path.join(siteDirectoryPath, "assets/css/home.css");
const localIndexFilePath = path.join(localDirectoryPath, "index.html");

function optimizeSvgSprite(svg) {
  return optimize(svg, {
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
  }).data;
}

function getAssetMimeType(filePath) {
  switch (path.extname(filePath).toLowerCase()) {
    case ".svg":
      return "image/svg+xml";
    case ".woff2":
      return "font/woff2";
    default:
      return "application/octet-stream";
  }
}

async function replaceAsync(string, pattern, replacer) {
  const matches = [...string.matchAll(pattern)];
  const replacements = await Promise.all(matches.map((match) => replacer(...match)));
  let replacementIndex = 0;

  return string.replace(pattern, () => replacements[replacementIndex++]);
}

async function inlineCssAssets(css) {
  return replaceAsync(css, /url\((["']?)(\.\.\/(?:fonts|images)\/[^"')]+)\1\)/g, async (_match, _quote, assetPath) => {
    const absoluteAssetPath = path.join(siteDirectoryPath, "assets/css", assetPath);
    const assetBuffer = await readFile(absoluteAssetPath);
    const mimeType = getAssetMimeType(absoluteAssetPath);

    return `url("data:${mimeType};base64,${assetBuffer.toString("base64")}")`;
  });
}

async function main() {
  await rm(localDirectoryPath, { recursive: true, force: true });
  await cp(siteDirectoryPath, localDirectoryPath, { recursive: true });

  const spriteSource = await readFile(spriteFilePath, "utf8");
  const sprite = optimizeSvgSprite(spriteSource).replace(
    "<svg ",
    '<svg aria-hidden="true" style="position:absolute;width:0;height:0;overflow:hidden" '
  );

  const script = await readFile(scriptFilePath, "utf8");
  const style = await inlineCssAssets(await readFile(styleFilePath, "utf8"));
  const html = await readFile(localIndexFilePath, "utf8");
  const localHtml = html
    .replace(/\s+crossorigin/g, "")
    .replace(/<body>/, `<body>\n    ${sprite}`)
    .replace(/href="\.\/assets\/images\/sprite-icons\.svg#([^"]+)"/g, 'href="#$1"')
    .replace(/<link rel="stylesheet" href="\.\/assets\/css\/home\.css">/, `<style>\n${style}\n    </style>`)
    .replace(/<script type="module" src="\.\/assets\/js\/home\.js"><\/script>/, `<script>\n${script}\n    </script>`);

  await writeFile(localIndexFilePath, localHtml);

  console.log("Created site-local build.");
}

main().catch((error) => {
  console.error("Local build creation failed.");
  console.error(error);
  process.exitCode = 1;
});
