import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { SkillListItem } from "@devdigest/shared";
import messages from "../../../../../messages/en/skills.json";
import { filterSkills } from "./helpers";

const push = vi.fn();
const setEnabled = vi.fn();
let skills: SkillListItem[] = [];

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), useParams: () => ({ id: "id-beta" }) }));
vi.mock("../../../../lib/hooks/skills", () => ({
  useSkills: () => ({ data: skills, isLoading: false, isError: false }),
  useSetSkillEnabled: () => ({ mutate: setEnabled }),
}));
vi.mock("./_components/ImportSkillDrawer", () => ({ ImportSkillDrawer: () => <div>import drawer</div> }));

import { SkillsListPane } from "./SkillsListPane";

afterEach(cleanup);

const skill = (name: string, over: Partial<SkillListItem> = {}): SkillListItem => ({
  id: `id-${name}`,
  name,
  description: `${name} rule`,
  type: "rubric",
  source: "manual",
  body: "b",
  enabled: true,
  version: 1,
  evidence_files: null,
  agents_count: 1,
  ...over,
});

beforeEach(() => {
  push.mockReset();
  setEnabled.mockReset();
  skills = [skill("alpha", { agents_count: 3 }), skill("beta", { source: "imported_file", enabled: false, agents_count: 0 })];
});

function renderPane() {
  return render(
    <NextIntlClientProvider locale="en" messages={{ skills: messages }}>
      <SkillsListPane />
    </NextIntlClientProvider>,
  );
}

describe("SkillsListPane", () => {
  it("filterSkills matches name or description, case-insensitively", () => {
    expect(filterSkills(skills, "ALP").map((s) => s.name)).toEqual(["alpha"]);
    expect(filterSkills(skills, "beta rule").map((s) => s.name)).toEqual(["beta"]);
    expect(filterSkills(skills, " ")).toHaveLength(2);
  });

  it("renders cards with type, source and agent counts; marks the active one", () => {
    renderPane();
    expect(screen.getByText("3 agents")).toBeInTheDocument();
    expect(screen.getByText("0 agents")).toBeInTheDocument();
    expect(screen.getByText("Imported")).toBeInTheDocument();
    expect(screen.getByText("beta").closest("[role=button]")).toHaveAttribute("aria-current", "true");
  });

  it("the toggle saves `enabled` at once and does not open the skill", () => {
    renderPane();
    fireEvent.click(screen.getAllByRole("switch")[1]!);
    expect(setEnabled).toHaveBeenCalledWith({ id: "id-beta", enabled: true });
    expect(push).not.toHaveBeenCalled();
  });

  it("clicking a card opens it; search filters the list", () => {
    renderPane();
    fireEvent.click(screen.getByText("alpha"));
    expect(push).toHaveBeenCalledWith("/skills/id-alpha?tab=config");
    fireEvent.change(screen.getByLabelText("Search skills…"), { target: { value: "zzz" } });
    expect(screen.getByText("No skills match “zzz”.")).toBeInTheDocument();
  });
});
