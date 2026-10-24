import { describe, it, expect } from "vitest";
import { formatSkillForPrompt } from "@devdigest/shared/contracts/knowledge";
import {
  buildSkillPatch,
  estimateTokens,
  resolveFields,
  validateSkillFields,
  type SkillFields,
} from "./skill-fields";

const SAVED: SkillFields = {
  name: "branch-gate",
  description: "Use always.",
  type: "rubric",
  body: "# Gate",
  enabled: true,
};

describe("skill-fields", () => {
  it("buildSkillPatch sends only drafted fields that differ from the saved skill", () => {
    expect(buildSkillPatch(SAVED, {})).toEqual({});
    expect(buildSkillPatch(SAVED, { description: "Use always." })).toEqual({});
    expect(buildSkillPatch(SAVED, { description: "New.", body: "# Gate" })).toEqual({ description: "New." });
  });

  it("a list toggle saved meanwhile is not overwritten by an untouched form field", () => {
    // The user edits the description; meanwhile the list card disables the skill.
    const draft = { description: "New." };
    const afterListToggle = { ...SAVED, enabled: false };
    expect(resolveFields(afterListToggle, draft).enabled).toBe(false);
    expect(buildSkillPatch(afterListToggle, draft)).toEqual({ description: "New." });
  });

  it("a form toggle that now matches the server value is dropped from the patch", () => {
    const draft = { enabled: false };
    expect(buildSkillPatch(SAVED, draft)).toEqual({ enabled: false });
    expect(buildSkillPatch({ ...SAVED, enabled: false }, draft)).toEqual({});
  });

  it("validateSkillFields mirrors the API rules", () => {
    expect(validateSkillFields(SAVED)).toEqual({});
    expect(validateSkillFields({ ...SAVED, name: "Bad Name", description: " ", body: "" })).toEqual({
      name: "namePattern",
      description: "descriptionRequired",
      body: "bodyRequired",
    });
    expect(validateSkillFields({ ...SAVED, description: "x".repeat(301), body: "y".repeat(20_001) })).toEqual({
      description: "descriptionTooLong",
      body: "bodyTooLong",
    });
  });

  it("estimateTokens = ceil(chars / 4)", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("abcde")).toBe(2);
  });

  it("the preview string matches the server's prompt format", () => {
    expect(formatSkillForPrompt(SAVED)).toBe("### Skill: branch-gate\nUse always.\n\n# Gate");
  });
});
