import { Orchestrator } from "./index.js";

const orchestrator = new Orchestrator();
const { blueprint, run } = orchestrator.run("Build a crypto + macro SaaS factory MVP");
console.log(JSON.stringify({ blueprint, run }, null, 2));
