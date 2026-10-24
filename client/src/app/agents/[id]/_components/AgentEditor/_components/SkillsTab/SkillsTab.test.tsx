import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { Agent, AgentSkillLink, SkillListItem } from "@devdigest/shared";
import agentsMessages from "../../../../../../../../messages/en/agents.json";
import skillsMessages from "../../../../../../../../messages/en/skills.json";
import { moveItem, orderRows, toggleAttached } from "./helpers";

const mutate = vi.fn();
let links: AgentSkillLink[] = [];
let skills: SkillListItem[] = [];

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("../../../../../../../lib/hooks/agents", () => ({
  useAgentSkills: () => ({ data: links, isLoading: false, isError: false }),
  useSetAgentSkills: () => ({ mutate }),
}));
vi.mock("../../../../../../../lib/hooks/skills", () => ({
  useSkills: () => ({ data: skills, isLoading: false, isError: false }),
}));

import { SkillsTab } from "./SkillsTab";

afterEach(cleanup);

const skill = (name: string, over: Partial<SkillListItem> = {}): SkillListItem => ({
  id: `id-${name}`,
  name,
  description: `${name} description`,
  type: "rubric",
  source: "manual",
  body: "b",
  enabled: true,
  version: 1,
  evidence_files: null,
  agents_count: 0,
  ...over,
});
const link = (name: string, order: number): AgentSkillLink => ({ agent_id: "ag1", skill_id: `id-${name}`, order });
const AGENT = { id: "ag1", name: "Test Quality Reviewer" } as Agent;

function renderTab() {
  return render(
    <NextIntlClientProvider locale="en" messages={{ agents: agentsMessages, skills: skillsMessages }}>
      <SkillsTab agent={AGENT} />
    </NextIntlClientProvider>,
  );
}
const rowNames = () => screen.getAllByRole("listitem").map((li) => li.getAttribute("data-testid"));

beforeEach(() => {
  mutate.mockReset();
  skills = [skill("alpha"), skill("beta"), skill("gamma", { enabled: false }), skill("delta")];
  links = [link("gamma", 0), link("alpha", 1)];
});

describe("SkillsTab helpers", () => {
  it("orders attached skills by link order, then the rest by name", () => {
    expect(orderRows(skills, ["id-gamma", "id-alpha"]).map((r) => [r.skill.name, r.index])).toEqual([
      ["gamma", 0],
      ["alpha", 1],
      ["beta", -1],
      ["delta", -1],
    ]);
  });

  it("toggleAttached appends or removes; moveItem clamps", () => {
    expect(toggleAttached(["a"], "b", true)).toEqual(["a", "b"]);
    expect(toggleAttached(["a", "b"], "a", false)).toEqual(["b"]);
    expect(moveItem(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
    const same = ["a", "b"];
    expect(moveItem(same, 0, -1)).toBe(same);
  });
});

describe("SkillsTab", () => {
  it("shows attached skills first and the attached counter", () => {
    renderTab();
    expect(screen.getByText("2 of 4 attached")).toBeInTheDocument();
    expect(rowNames()).toEqual(["skill-row-gamma", "skill-row-alpha", "skill-row-beta", "skill-row-delta"]);
  });

  it("marks a globally disabled skill", () => {
    renderTab();
    const row = screen.getByTestId("skill-row-gamma");
    expect(within(row).getByText("disabled — not sent to the model")).toBeInTheDocument();
  });

  it("checking a skill appends it; unchecking removes it", () => {
    renderTab();
    fireEvent.click(within(screen.getByTestId("skill-row-beta")).getByRole("checkbox"));
    expect(mutate).toHaveBeenLastCalledWith({ agentId: "ag1", skillIds: ["id-gamma", "id-alpha", "id-beta"] });
    fireEvent.click(within(screen.getByTestId("skill-row-gamma")).getByRole("checkbox"));
    expect(mutate).toHaveBeenLastCalledWith({ agentId: "ag1", skillIds: ["id-alpha"] });
  });

  it("Alt+↓ / Alt+↑ on the handle reorders; a no-op move sends nothing", () => {
    renderTab();
    fireEvent.keyDown(screen.getByRole("button", { name: /Reorder gamma/ }), { key: "ArrowDown", altKey: true });
    expect(mutate).toHaveBeenLastCalledWith({ agentId: "ag1", skillIds: ["id-alpha", "id-gamma"] });
    mutate.mockReset();
    fireEvent.keyDown(screen.getByRole("button", { name: /Reorder gamma/ }), { key: "ArrowUp", altKey: true });
    expect(mutate).not.toHaveBeenCalled();
  });

  it("drag and drop moves the dragged skill to the drop target", () => {
    renderTab();
    const dataTransfer = { effectAllowed: "" };
    fireEvent.dragStart(screen.getByTestId("skill-row-alpha"), { dataTransfer });
    fireEvent.dragOver(screen.getByTestId("skill-row-gamma"), { dataTransfer });
    fireEvent.drop(screen.getByTestId("skill-row-gamma"), { dataTransfer });
    expect(mutate).toHaveBeenLastCalledWith({ agentId: "ag1", skillIds: ["id-alpha", "id-gamma"] });
  });

  it("filtering narrows the rows and disables reordering", () => {
    renderTab();
    fireEvent.change(screen.getByLabelText("Filter skills…"), { target: { value: "alp" } });
    expect(rowNames()).toEqual(["skill-row-alpha"]);
    expect(screen.getByText("Clear the filter to reorder.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Reorder alpha/ })).toBeDisabled();
  });
});
