import fs from "node:fs";
import sharp from "sharp";

const jobs = [
  { path: "public/images/stake37-logo.png", max: 384 },
  { path: "public/profile/avatars-grid.png", max: 512 },
  { path: "public/images/sala-rotativa-lobby-wait.png", max: 960 },
  { path: "public/images/roulette-brasileira-card.png", max: 640 },
  { path: "public/images/roulette-latina-card.png", max: 640 },
];

for (const job of jobs) {
  if (!fs.existsSync(job.path)) {
    console.log("skip", job.path);
    continue;
  }
  const before = fs.statSync(job.path).size;
  const meta = await sharp(job.path).metadata();
  const w = meta.width ?? job.max;
  const h = meta.height ?? job.max;
  const scale = Math.min(1, job.max / Math.max(w, h));
  let pipeline = sharp(job.path);
  if (scale < 1) {
    pipeline = pipeline.resize(Math.round(w * scale), Math.round(h * scale), {
      fit: "inside",
      withoutEnlargement: true,
    });
  }
  const buf = await pipeline.png({ compressionLevel: 9, palette: true }).toBuffer();
  fs.writeFileSync(job.path, buf);
  console.log(`${job.path}: ${Math.round(before / 1024)}KB -> ${Math.round(buf.length / 1024)}KB`);
}
