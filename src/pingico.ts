interface IcoData {
  header: Uint8Array;
  block: Uint8Array;
}

async function inflate(data: Uint8Array<ArrayBuffer>): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate');
  const stream = new Blob([data]).stream().pipeThrough(ds);
  const ab = await new Response(stream).arrayBuffer();
  return new Uint8Array(ab);
}

async function decodePng(png: Uint8Array): Promise<{
  width: number;
  height: number;
  image: Uint8Array;
}> {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < signature.length; i++) {
    if (png[i] !== signature[i]) {
      throw new Error('Invalid PNG');
    }
  }

  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idats: Uint8Array[] = [];
  let offset = 8;
  while (offset < png.length) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(
      png[offset + 4],
      png[offset + 5],
      png[offset + 6],
      png[offset + 7],
    );
    if (type === 'IHDR') {
      width = view.getUint32(offset + 8);
      height = view.getUint32(offset + 12);
      bitDepth = png[offset + 16];
      colorType = png[offset + 17];
    } else if (type === 'IDAT') {
      idats.push(png.subarray(offset + 8, offset + 8 + length));
    } else if (type === 'IEND') {
      break;
    }
    offset += length + 12;
  }

  if (bitDepth !== 8 || colorType !== 6) {
    throw new Error('Unsupported PNG format');
  }

  const total = idats.reduce((n, c) => n + c.length, 0);
  const compressed = new Uint8Array(total);
  let pos = 0;
  for (const chunk of idats) {
    compressed.set(chunk, pos);
    pos += chunk.length;
  }
  const raw = await inflate(compressed);

  const bpp = 4;
  const rowBytes = width * bpp;
  const image = new Uint8Array(width * height * 4);
  let inPos = 0;
  let outPos = 0;

  const paeth = (a: number, b: number, c: number): number => {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    if (pa <= pb && pa <= pc) return a;
    if (pb <= pc) return b;
    return c;
  };

  for (let y = 0; y < height; y++) {
    const filter = raw[inPos++];
    if (filter === 0) {
      image.set(raw.subarray(inPos, inPos + rowBytes), outPos);
    } else if (filter === 1) {
      for (let x = 0; x < rowBytes; x++) {
        const left = x >= bpp ? image[outPos + x - bpp] : 0;
        image[outPos + x] = (raw[inPos + x] + left) & 0xff;
      }
    } else if (filter === 2) {
      for (let x = 0; x < rowBytes; x++) {
        const up = y > 0 ? image[outPos + x - rowBytes] : 0;
        image[outPos + x] = (raw[inPos + x] + up) & 0xff;
      }
    } else if (filter === 3) {
      for (let x = 0; x < rowBytes; x++) {
        const left = x >= bpp ? image[outPos + x - bpp] : 0;
        const up = y > 0 ? image[outPos + x - rowBytes] : 0;
        image[outPos + x] = (raw[inPos + x] + ((left + up) >> 1)) & 0xff;
      }
    } else if (filter === 4) {
      for (let x = 0; x < rowBytes; x++) {
        const a = x >= bpp ? image[outPos + x - bpp] : 0;
        const b = y > 0 ? image[outPos + x - rowBytes] : 0;
        const c = y > 0 && x >= bpp ? image[outPos + x - rowBytes - bpp] : 0;
        image[outPos + x] = (raw[inPos + x] + paeth(a, b, c)) & 0xff;
      }
    } else {
      throw new Error(`Unsupported filter type: ${filter}`);
    }
    inPos += rowBytes;
    outPos += rowBytes;
  }

  return { width, height, image };
}

async function pngToIco(png: Uint8Array): Promise<IcoData> {
  const { width, height, image } = await decodePng(png);

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
  const strict = width >= 256;
  const maskThreshold = 10;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = image[(y * width + x) * 4 + 3];
      if (a < maskThreshold) {
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
      if (!strict && a < maskThreshold) {
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

/**
 * Converts PNG images to ICO format.
 * @param images Array of image data (Blob, ArrayBuffer, or Uint8Array)
 * @returns Blob containing the ICO file data.
 * @throws Error if the input images are not valid PNGs or if the format is unsupported.
 */
export async function pingico(
  ...images: (Blob | ArrayBuffer | Uint8Array)[]
): Promise<Blob> {
  const buffers: Uint8Array[] = [];
  for (const [index, image] of images.entries()) {
    if (image instanceof Uint8Array) {
      buffers.push(image);
    } else if (image instanceof Blob) {
      buffers.push(new Uint8Array(await image.arrayBuffer()));
    } else if (image instanceof ArrayBuffer) {
      buffers.push(new Uint8Array(image));
    } else {
      console.warn(`Unsupported data: [${index}]`);
    }
  }

  const entries: IcoData[] = [];
  for (const buffer of buffers) {
    entries.push(await pngToIco(buffer));
  }

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
