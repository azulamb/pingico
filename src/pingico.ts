interface IcoData {
  header: Uint8Array;
  block: Uint8Array;
}

import { decode } from 'https://deno.land/x/pngs@0.1.1/mod.ts';

function pngToIco(png: Uint8Array): IcoData {
  const { image, width, height } = decode(png);

  const header = new Uint8Array(16);
  header[0] = width >= 256 ? 0 : width;
  header[1] = height >= 256 ? 0 : height;
  header[2] = 0;
  header[3] = 0;
  header[4] = 1;
  header[5] = 0;
  header[6] = 32;
  header[7] = 0;

  const dibHeader = new Uint8Array(40);
  const view = new DataView(dibHeader.buffer);
  view.setUint32(0, 40, true);
  view.setInt32(4, width, true);
  view.setInt32(8, height * 2, true);
  view.setUint16(12, 1, true);
  view.setUint16(14, 32, true);
  view.setUint32(16, 0, true);
  const maskRow = Math.ceil(width / 32) * 4;
  const andMask = new Uint8Array(maskRow * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = image[(y * width + x) * 4 + 3];
      if (a < 12) {
        const byteIndex = ((height - 1 - y) * maskRow) + (x >> 3);
        const bit = 7 - (x & 7);
        andMask[byteIndex] |= 1 << bit;
      }
    }
  }

  view.setUint32(20, width * height * 4 + andMask.length, true);
  view.setUint32(24, 0, true);
  view.setUint32(28, 0, true);
  view.setUint32(32, 0, true);
  view.setUint32(36, 0, true);

  const pixelData = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const src = (y * width + x) * 4;
      const dst = ((height - 1 - y) * width + x) * 4;
      const a = image[src + 3];
      if (a < 12) {
        pixelData[dst] = 0;
        pixelData[dst + 1] = 0;
        pixelData[dst + 2] = 0;
      } else {
        pixelData[dst] = image[src + 2];
        pixelData[dst + 1] = image[src + 1];
        pixelData[dst + 2] = image[src];
      }
      pixelData[dst + 3] = a;
    }
  }

  const block = new Uint8Array(
    dibHeader.length + pixelData.length + andMask.length,
  );
  block.set(dibHeader, 0);
  block.set(pixelData, dibHeader.length);
  block.set(andMask, dibHeader.length + pixelData.length);

  const size = block.length;
  header[8] = size & 0xff;
  header[9] = (size >> 8) & 0xff;
  header[10] = (size >> 16) & 0xff;
  header[11] = (size >> 24) & 0xff;
  header[12] = 0;
  header[13] = 0;
  header[14] = 0;
  header[15] = 0;

  return { header, block };
}

export async function pingico(
  ...images: (Blob | ArrayBuffer | Uint8Array)[]
): Promise<Blob> {
  const entries: IcoData[] = await Promise.all(
    images.map(async (image, index) => {
      if (image instanceof Uint8Array) {
        return image;
      }
      if (image instanceof Blob) {
        return new Uint8Array(await image.arrayBuffer());
      }
      if (image instanceof ArrayBuffer) {
        return new Uint8Array(image);
      }

      console.warn(`Unsupported data: [${index}]`);
      return null;
    }),
  ).then((buffers) => {
    return buffers.filter((buffer) => {
      return buffer !== null;
    });
  }).then((buffers) => {
    return buffers.map((buffer) => {
      return pngToIco(buffer);
    });
  });

  const count = entries.length;
  if (count === 0) {
    return new Blob([]);
  }

  // ICONDIR header
  const iconDir = new Uint8Array(6);
  iconDir[0] = 0;
  iconDir[1] = 0;
  iconDir[2] = 1;
  iconDir[3] = 0;
  iconDir[4] = count & 0xff;
  iconDir[5] = (count >> 8) & 0xff;

  // Each entry is 16 bytes
  const dirTable = new Uint8Array(count * 16);

  let offset = 6 + count * 16;
  entries.forEach((entry, index) => {
    const size = entry.block.byteLength;
    // Write size and offset into the header
    entry.header[8] = size & 0xff;
    entry.header[9] = (size >> 8) & 0xff;
    entry.header[10] = (size >> 16) & 0xff;
    entry.header[11] = (size >> 24) & 0xff;

    entry.header[12] = offset & 0xff;
    entry.header[13] = (offset >> 8) & 0xff;
    entry.header[14] = (offset >> 16) & 0xff;
    entry.header[15] = (offset >> 24) & 0xff;

    dirTable.set(entry.header, index * 16);
    offset += size;
  });

  // Compose final ICO binary
  const output = new Uint8Array(offset);
  output.set(iconDir, 0);
  output.set(dirTable, 6);

  let cursor = 6 + count * 16;
  entries.forEach((entry) => {
    output.set(entry.block, cursor);
    cursor += entry.block.byteLength;
  });

  return new Blob([output], { type: 'image/x-icon' });
}
