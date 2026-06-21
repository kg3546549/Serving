import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const execFileAsync = promisify(execFile);
const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const sourceDir = path.resolve(process.argv[2] ?? process.cwd());
const outputDir = path.resolve(process.argv[3] ?? sourceDir);
const renderDir = await fs.mkdtemp(path.join(os.tmpdir(), "stack-breach-slides-"));
const decks = [["기획서.html", "기획서.pptx"], ["개발계획서.html", "개발계획서.pptx"]];

async function render(htmlPath, name) {
  const html = await fs.readFile(htmlPath, "utf8");
  const count = (html.match(/type:"(?:cover|cards|loop|timeline|table|concept|stage)"/g) ?? []).length;
  const actualCount = name === "기획서" ? 7 : 9;
  if (count === 0) throw new Error(`슬라이드 데이터를 찾지 못했습니다: ${htmlPath}`);
  const images = [];
  for (let i = 0; i < actualCount; i += 1) {
    const png = path.join(renderDir, `${name}-${String(i + 1).padStart(2, "0")}.png`);
    await execFileAsync(chrome, [
      "--headless=new", "--disable-gpu", "--hide-scrollbars",
      "--force-device-scale-factor=1", "--window-size=1280,720",
      `--screenshot=${png}`, `${pathToFileURL(htmlPath).href}?slide=${i}`,
    ]);
    images.push(png);
  }
  return images;
}

async function exportPptx(images, output) {
  const presentation = Presentation.create({ slideSize: { width: 1280, height: 720 } });
  for (const image of images) {
    const bytes = await fs.readFile(image);
    const slide = presentation.slides.add();
    slide.images.add({
      blob: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      contentType: "image/png",
      alt: "HTML로 렌더링한 STACK//BREACH 슬라이드",
      fit: "fill",
      position: { left: 0, top: 0, width: 1280, height: 720 },
    });
  }
  await (await PresentationFile.exportPptx(presentation)).save(output);
}

await fs.mkdir(outputDir, { recursive: true });
for (const [htmlName, pptxName] of decks) {
  const name = path.parse(pptxName).name;
  const images = await render(path.join(sourceDir, htmlName), name);
  const output = path.join(outputDir, pptxName);
  await exportPptx(images, output);
  console.log(`${htmlName} -> ${output} (${images.length} slides)`);
}
console.log(`Rendered images: ${renderDir}`);
