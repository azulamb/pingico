import * as assert from 'jsr:@std/assert';
import { pingico } from '../src/pingico.ts';

Deno.test('Single icon', async () => {
  console.log('test');
  const png = await Deno.readFile('./tests/icon_16.png');
  const ico = await Deno.readFile('./tests/icon_16.ico');
  const blob = await pingico(png);
  const blobData = new Uint8Array(await blob.arrayBuffer());
  assert.assertEquals(blobData, ico, `Single icon data does not match.`);
});
