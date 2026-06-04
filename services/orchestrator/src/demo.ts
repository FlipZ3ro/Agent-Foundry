import { Orchestrator } from "./index.js";

const orchestrator = new Orchestrator();
const run = orchestrator.run("Build a crypto + macro SaaS factory MVP");
console.log(JSON.stringify(run, null, 2));
