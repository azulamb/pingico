import * as assert from 'jsr:@std/assert';
import { pingico } from '../mod.ts';

Deno.test('Single icon', async () => {
  const png = await Deno.readFile('./tests/icon_16.png');
  const ico = await Deno.readFile('./tests/icon_16.ico');
  const blob = await pingico(png);
  const blobData = new Uint8Array(await blob.arrayBuffer());
  assert.assertEquals(blobData, ico, `Single icon data does not match.`);
});

Deno.test('Single biggest icon', async () => {
  const png = await Deno.readFile('./tests/icon_256.png');
  const ico = await Deno.readFile('./tests/icon_256.ico');
  const blob = await pingico(png);
  const blobData = new Uint8Array(await blob.arrayBuffer());
  assert.assertEquals(blobData, ico, `Single icon data does not match.`);
});

Deno.test('Multi icon', async () => {
  const pings = await Promise.all([
    16,
    24,
    32,
    48,
    256,
  ].map((size) => {
    return Deno.readFile(`./tests/icon_${size}.png`);
  }));
  const ico = await Deno.readFile('./tests/icon.ico');
  const blob = await pingico(...pings);
  const blobData = new Uint8Array(await blob.arrayBuffer());
  assert.assertEquals(blobData, ico, `Multi icon data does not match.`);
});
