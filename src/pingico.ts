function pngToIco(png: Uint8Array): {
  header: Uint8Array;
  block: Uint8Array;
} {
  return {
    header: new Uint8Array(16),
    block: png,
  };
}

export async function pingico(
  images: (Blob | ArrayBuffer | Uint8Array)[],
): Promise<Blob> {
  const list: Uint8Array[] = await Promise.all(
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

  return null;
}
