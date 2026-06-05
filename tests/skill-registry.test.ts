import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  findSkill,
  renderPrompt,
  skillRegistry,
  skillsForLane
} from "../packages/prompts/src/index.js";

describe("skill registry", () => {
  it("has unique skill ids", () => {
    const ids = skillRegistry.map((skill) => skill.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it("findSkill returns the right entry", () => {
    const skill = findSkill("frontend-shell");
    assert.ok(skill);
    assert.equal(skill!.lane, "frontend");
  });

  it("skillsForLane filters by lane", () => {
    const backend = skillsForLane("backend");
    assert.ok(backend.length >= 1);
    assert.ok(backend.every((s) => s.lane === "backend"));
  });

  it("renderPrompt substitutes vars", () => {
    const skill = findSkill("frontend-shell")!;
    const rendered = renderPrompt(skill, { idea: "Build a CRM" });
    assert.ok(rendered.includes("Build a CRM"));
    assert.ok(!rendered.includes("{{idea}}"));
  });

  it("renderPrompt leaves unknown vars in place", () => {
    const skill = findSkill("frontend-shell")!;
    const rendered = renderPrompt(skill, {});
    assert.ok(rendered.includes("{{idea}}"));
  });
});
