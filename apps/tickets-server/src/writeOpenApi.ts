import { writeFileSync } from "node:fs";
import { openApiDocument } from "./openapi";

const document = await openApiDocument();
writeFileSync(
  new URL("../openapi.json", import.meta.url),
  `${JSON.stringify(document, null, 2)}\n`,
);
