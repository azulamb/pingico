# pingico

PNG to ICO.

https://jsr.io/@azulamb/pingico

```ts
import * as pingico from "jsr:@azulamb/pingico";

const png = await pingico(png);
const ico = new Uint8Array(await png.arrayBuffer());
```

## Command

```sh
deno run --allow-read --allow-write jsr:@azulamb/pingico png_filepath_0 png_filepath_1 ... ./output_icon.ico
```

## Browser

import `./src/pingico.ts`

## Sample and test

`tests/all.test.ts`
