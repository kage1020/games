import { readFileSync, writeFileSync } from "node:fs";
import { type Tokens, tokensToCss } from "./lib/tokens-to-css.ts";

const source = new URL("../src/design-system/vendor/tokens.json", import.meta.url);
const target = new URL("../src/design-system/tokens.css", import.meta.url);

const tokens = JSON.parse(readFileSync(source, "utf8")) as Tokens;
writeFileSync(target, tokensToCss(tokens));
console.log(`wrote ${target.pathname}`);
