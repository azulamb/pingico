interface IcoData {
  header: Uint8Array;
  block: Uint8Array;
}

function pngToIco(png: Uint8Array): IcoData {
  // Parse width and height from IHDR chunk of the PNG
  if (png.byteLength < 24) {
    throw new Error('Invalid PNG image');
  }

  // IHDR chunk starts at byte 8 after the 8 byte PNG signature
  const width = (png[16] << 24) | (png[17] << 16) | (png[18] << 8) | png[19];
  const height = (png[20] << 24) | (png[21] << 16) | (png[22] << 8) | png[23];

  const header = new Uint8Array(16);

  // Width & height are a single byte. 0 means 256.
  header[0] = width >= 256 ? 0 : width;
  header[1] = height >= 256 ? 0 : height;

  header[2] = 0; // color count (0 if >= 256 colors)
  header[3] = 0; // reserved

  // Planes and bit count. For PNG we set planes = 1 and bitcount = 32.
  header[4] = 1;
  header[5] = 0;
  header[6] = 32;
  header[7] = 0;

  // bytes in resource (little endian)
  const size = png.byteLength;
  header[8] = size & 0xff;
  header[9] = (size >> 8) & 0xff;
  header[10] = (size >> 16) & 0xff;
  header[11] = (size >> 24) & 0xff;

  // offset will be filled in later when generating the ico file
  header[12] = 0;
  header[13] = 0;
  header[14] = 0;
  header[15] = 0;

  return { header, block: png };
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
