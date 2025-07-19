import { pingico as convert } from './src/pingico.ts';

/**
 * Converts PNG images to ICO format.
 * @param images Array of image data (Blob, ArrayBuffer, or Uint8Array)
 * @returns Blob containing the ICO file data.
 * @throws Error if the input images are not valid PNGs or if the format is unsupported.
 */
export const pingico = convert;

/**
 * Converts PNG files to ICO format function only Deno.
 * @param files Array of file paths or URLs to PNG images.
 * @returns
 */
export async function pingFileToIco(
  ...files: (string | URL)[]
): Promise<Blob> {
  return convert(
    ...await Promise.all(files.map(async (file) => {
      return await Deno.readFile(file);
    })),
  );
}

if (import.meta.main) {
  if (Deno.args.length < 2) {
    console.error(
      'Usage: deno run --allow-read --allow-write mod.ts <file1> <file2> ... <output>',
    );
    Deno.exit(1);
  }
  const files = [...Deno.args];
  const outputFile = <string> files.pop();
  const icoBlob = await pingFileToIco(...files);
  await Deno.writeFile(outputFile, new Uint8Array(await icoBlob.arrayBuffer()));
}
