import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { createSeededRandom } from '../src/services/demo-data.service';
import { analyzeImageLocally } from '../src/services/photo-assist.service';

describe('final production regressions', () => {
  it('keeps seeded demo random values in the [0, 1) range and produces mixed outcomes', () => {
    const random = createSeededRandom('smartmetrix-demo');
    const values = Array.from({ length: 200 }, () => random());

    expect(values.every((value) => value >= 0 && value < 1)).toBe(true);
    expect(values.some((value) => value > 0.85)).toBe(true);
    expect(values.some((value) => value <= 0.85)).toBe(true);
  });

  it('analyzes a valid uploaded image locally when the AI service is unavailable', async () => {
    const image = await sharp({
      create: {
        width: 32,
        height: 24,
        channels: 3,
        background: { r: 110, g: 150, b: 190 }
      }
    }).png().toBuffer();

    const result = await analyzeImageLocally(image);

    expect(result.status).toBe('SUCCESS');
    expect(result.qualityMetrics.resolution).toEqual({ width: 32, height: 24 });
    expect(result.qualityMetrics.overallQualityScore).toBeGreaterThanOrEqual(0);
    expect(result.disclaimer).toContain('Local image-quality fallback');
  });

  it('rejects invalid uploaded image bytes', async () => {
    await expect(analyzeImageLocally(Buffer.from('not-an-image'))).rejects.toThrow();
  });
});
