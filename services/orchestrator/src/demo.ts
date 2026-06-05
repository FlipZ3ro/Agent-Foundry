import { Orchestrator } from "./index.js";

async function main() {
  const orchestrator = new Orchestrator();
  const { blueprint, run } = await orchestrator.run("Build a crypto + macro SaaS factory MVP");
  console.log(JSON.stringify({ blueprint, run }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
