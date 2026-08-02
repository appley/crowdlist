import { seed } from "./seed";
import { simulate } from "./simulate";

await seed();
await simulate();
console.log("CrowdList Stage 1 reseed complete.");
