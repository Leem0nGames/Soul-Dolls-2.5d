#!/usr/bin/env node
/**
 * Converts an animation video (MP4/WebM with green screen or solid grey background)
 * into a transparent WebP spritesheet using ffmpeg + sharp.
 *
 * Usage:
 *   node scripts/video-to-spritesheet.mjs \
 *     --input public/assets/aistudio/427091123_1794872957946986_d5bb03ea.mp4 \
 *     --output public/assets/attacks/physical_attack_16.webp \
 *     --start 1.1 --end 3.6 --fps 8 --cols 4 --chroma green
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k.startsWith('--')) {
      const key = k.slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
      args[key] = val;
    }
  }
  return args;
}

function stripGreenRgba(buf, tolerance = 50, despill = 0.7) {
  const minDelta = Math.max(12, 95 - tolerance);
  const edgeBand = Math.max(12, tolerance * 0.45);
  for (let i = 0; i < buf.length; i += 4) {
    const r = buf[i];
    const g = buf[i + 1];
    const b = buf[i + 2];
    const maxRB = Math.max(r, b);
    const excess = g - maxRB;
    if (excess > minDelta && g > 70) {
      if (excess > minDelta + edgeBand) {
        buf[i + 3] = 0;
      } else {
        const t = 1 - (excess - minDelta) / edgeBand;
        buf[i + 3] = Math.round(buf[i + 3] * Math.max(0, Math.min(1, t)));
      }
    }
    if (buf[i + 3] > 0 && despill > 0 && g > maxRB) {
      buf[i + 1] = Math.round(maxRB + (g - maxRB) * (1 - despill));
    }
  }
}

function stripGreyRgba(buf, tolerance = 50) {
  const hardDist = Math.max(6, tolerance * 0.2);
  const softDist = hardDist + 18;
  for (let i = 0; i < buf.length; i += 4) {
    const r = buf[i];
    const g = buf[i + 1];
    const b = buf[i + 2];
    const maxDiff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));
    const dist = Math.hypot(r - 180, g - 180, b - 180);
    if (dist <= hardDist && maxDiff <= 5) {
      buf[i + 3] = 0;
    } else if (dist <= softDist && maxDiff <= 7) {
      const t = (dist - hardDist) / (softDist - hardDist);
      const alpha = t * t * (3 - 2 * t);
      buf[i + 3] = Math.round(buf[i + 3] * alpha);
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const input = args.input;
  const output = args.output;
  if (!input || !output) {
    console.error('Missing --input or --output');
    process.exit(1);
  }

  const start = Number(args.start ?? 0);
  const end = args.end !== undefined ? Number(args.end) : null;
  const fps = Number(args.fps ?? 8);
  const cols = Number(args.cols ?? 4);
  const chroma = args.chroma ?? 'green';
  const tolerance = Number(args.tolerance ?? 52);
  const despill = Number(args.despill ?? 0.7);
  const maxFrames = Number(args.maxFrames ?? 25);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'souldoll-anim-'));
  try {
    const ffArgs = ['-y'];
    if (start > 0) ffArgs.push('-ss', String(start));
    ffArgs.push('-i', input);
    if (end !== null && end > start) {
      ffArgs.push('-t', String(end - start));
    }
    ffArgs.push('-vf', `fps=${fps}`, '-frames:v', String(maxFrames), path.join(tmpDir, 'frame_%04d.png'));
    execFileSync('ffmpeg', ffArgs, { stdio: 'inherit' });

    const files = fs
      .readdirSync(tmpDir)
      .filter((f) => f.endsWith('.png'))
      .sort();
    if (files.length === 0) {
      throw new Error('No frames extracted from video.');
    }

    const firstMeta = await sharp(path.join(tmpDir, files[0])).metadata();
    const cellW = firstMeta.width;
    const cellH = firstMeta.height;
    const totalFrames = files.length;
    const rows = Math.ceil(totalFrames / cols);

    const composites = [];
    for (let i = 0; i < totalFrames; i++) {
      const { data } = await sharp(path.join(tmpDir, files[i]))
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      if (chroma === 'green') stripGreenRgba(data, tolerance, despill);
      else if (chroma === 'grey') stripGreyRgba(data, tolerance);

      const cleaned = await sharp(data, { raw: { width: cellW, height: cellH, channels: 4 } })
        .png()
        .toBuffer();

      composites.push({
        input: cleaned,
        left: (i % cols) * cellW,
        top: Math.floor(i / cols) * cellH,
      });
    }

    fs.mkdirSync(path.dirname(output), { recursive: true });
    await sharp({
      create: {
        width: cols * cellW,
        height: rows * cellH,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite(composites)
      .webp({ quality: 92, effort: 4 })
      .toFile(output);

    console.log(
      JSON.stringify(
        {
          output,
          cols,
          rows,
          totalFrames,
          cellW,
          cellH,
          aspectRatio: `${cellW} / ${cellH}`,
          suggestedImpactFrame: Math.floor(totalFrames * 0.45),
        },
        null,
        2
      )
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
