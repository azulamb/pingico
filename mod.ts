import { pingico as convert } from './src/pingico.ts';

export const pingico = convert;

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
    console.error('Usage: deno run --allow-read --allow-write mod.ts <file1> <file2> ... <output>');
    Deno.exit(1);
  }
  const files = Deno.args.map((arg) =>{
    return new URL(arg, import.meta.url);
  });
  const outputFile = <URL>files.pop();
  const icoBlob = await pingFileToIco(...files);
  await Deno.writeFile(outputFile, new Uint8Array(await icoBlob.arrayBuffer()));
}
