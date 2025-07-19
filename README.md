# pingico

PNG to ICO.

https://jsr.io/@azulamb/pingico

```ts
import { pingico } from "jsr:@azulamb/pingico/lib";
// or import { pingico } from "jsr:@azulamb/pingico";

const png = await pingico(await Deno.readFile('./tests/icon_16.png'));
// Get ico Blob.
const ico = new Uint8Array(await png.arrayBuffer());
```

```ts
import { pingFileToIco } from "jsr:@azulamb/pingico";

// Get ico Blob.
const ico = await pingFileToIco('./tests/icon_16.png');
```

## Command

```sh
deno run --allow-read --allow-write jsr:@azulamb/pingico file_0.png file_1.png ... ./output.ico
```

## Browser

`jsr:@azulamb/pingico/lib`

## Sample and test

`tests/all.test.ts`
