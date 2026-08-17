import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { UploadService } from "../services/upload.service.js";

async function createImageBuffer({ width = 640, height = 800, format = "png", alpha = false } = {}) {
  const channels = alpha ? 4 : 3;
  const background = alpha
    ? { r: 40, g: 120, b: 220, alpha: 0.5 }
    : { r: 40, g: 120, b: 220 };
  let image = sharp({ create: { width, height, channels, background } });
  if (format === "jpeg") image = image.jpeg({ quality: 92 });
  else if (format === "webp") image = image.webp({ quality: 92 });
  else image = image.png();
  return image.toBuffer();
}

function createService({ failDerivative = "" } = {}) {
  const uploads = [];
  const service = new UploadService();
  service.uploadR2Object = async (objectKey, body, contentType) => {
    if (failDerivative && objectKey.includes(failDerivative)) {
      throw new Error("simulated derivative upload failure");
    }
    uploads.push({ objectKey, body, contentType });
  };
  return { service, uploads };
}

test("createImageDerivatives creates thumbnail and medium WebP without changing original naming", async () => {
  const { service, uploads } = createService();
  const buffer = await createImageBuffer({ width: 1200, height: 1500, format: "png" });
  const derivatives = await service.createImageDerivatives({ originalname: "dress.png", buffer }, "products/original.png");

  assert.equal(uploads.length, 2);
  assert.equal(uploads[0].objectKey, "products/original-thumb.webp");
  assert.equal(uploads[1].objectKey, "products/original-medium.webp");
  assert.equal(uploads[0].contentType, "image/webp");
  assert.equal(derivatives.thumbnail.objectKey, "products/original-thumb.webp");
  assert.equal(derivatives.medium.objectKey, "products/original-medium.webp");

  const thumbMeta = await sharp(uploads[0].body).metadata();
  const mediumMeta = await sharp(uploads[1].body).metadata();
  assert.equal(thumbMeta.format, "webp");
  assert.equal(thumbMeta.width, 480);
  assert.equal(mediumMeta.width, 1000);
});

test("createImageDerivatives supports JPEG and WebP inputs", async () => {
  for (const format of ["jpeg", "webp"]) {
    const { service, uploads } = createService();
    const buffer = await createImageBuffer({ width: 900, height: 900, format });
    const derivatives = await service.createImageDerivatives({ originalname: `image.${format}`, buffer }, `products/image.${format}`);
    assert.equal(uploads.length, 2);
    assert.ok(derivatives.thumbnail.url.endsWith("/products/image-thumb.webp"));
    assert.ok(derivatives.medium.url.endsWith("/products/image-medium.webp"));
  }
});

test("createImageDerivatives preserves alpha for transparent PNG inputs", async () => {
  const { service, uploads } = createService();
  const buffer = await createImageBuffer({ width: 640, height: 640, format: "png", alpha: true });
  await service.createImageDerivatives({ originalname: "transparent.png", buffer }, "products/transparent.png");

  const metadata = await sharp(uploads[0].body).metadata();
  assert.equal(metadata.format, "webp");
  assert.equal(metadata.hasAlpha, true);
});

test("createImageDerivatives does not upscale small images", async () => {
  const { service, uploads } = createService();
  const buffer = await createImageBuffer({ width: 240, height: 300, format: "png" });
  await service.createImageDerivatives({ originalname: "small.png", buffer }, "products/small.png");

  const thumbMeta = await sharp(uploads[0].body).metadata();
  const mediumMeta = await sharp(uploads[1].body).metadata();
  assert.equal(thumbMeta.width, 240);
  assert.equal(mediumMeta.width, 240);
});

test("createImageDerivatives returns null for failed derivatives without throwing", async () => {
  const { service, uploads } = createService({ failDerivative: "medium" });
  const buffer = await createImageBuffer({ width: 800, height: 1000, format: "png" });
  const derivatives = await service.createImageDerivatives({ originalname: "partial.png", buffer }, "products/partial.png");

  assert.equal(uploads.length, 1);
  assert.ok(derivatives.thumbnail);
  assert.equal(derivatives.medium, null);
});
