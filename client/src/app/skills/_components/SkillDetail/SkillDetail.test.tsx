import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { Skill } from "@devdigest/shared";
import messages from "../../../../../messages/en/skills.json";
import { ToastProvider } from "../../../../lib/toast";
import { ApiError } from "../../../../lib/api";

const update = vi.fn();
const create = vi.fn();
const replace = vi.fn();
const stats = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace }) }));
vi.mock("../../../../lib/hooks/skills", () => ({
  useUpdateSkill: () => ({ mutate: update, isPending: false }),
  useCreateSkill: () => ({ mutate: create, isPending: false }),
  useSkillAgents: () => ({ data: [{ id: "ag1", name: "Test Quality Reviewer", enabled: true }], isLoading: false }),
  useSkillStats: () => stats(),
  useDeleteSkill: () => ({ mutate: vi.fn(), isPending: false }),
}));

import { SkillDetail } from "./SkillDetail";

afterEach(cleanup);
beforeEach(() => {
  update.mockReset();
  create.mockReset();
  replace.mockReset();
  stats.mockReturnValue({
    data: { window_days: 30, runs: 4, findings: 7, accepted: 3, dismissed: 1, accept_rate: 75 },
    isLoading: false,
  });
});

const SKILL: Skill = {
  id: "s1",
  name: "branch-coverage-gate",
  description: "Use on every diff.",
  type: "rubric",
  source: "manual",
  body: "# Gate\nCheck branches.",
  enabled: true,
  version: 3,
  evidence_files: null,
};

function ui(skill: Skill | undefined, tab = "config") {
  return (
    <NextIntlClientProvider locale="en" messages={{ skills: messages }}>
      <ToastProvider>
        <SkillDetail skill={skill} tab={tab} onTab={() => {}} />
      </ToastProvider>
    </NextIntlClientProvider>
  );
}
const save = () => screen.getByRole("button", { name: "Save" });

describe("SkillDetail — Config", () => {
  it("shows the skill, version and the directive hint; Save is disabled until something changes", () => {
    render(ui(SKILL));
    expect(screen.getByRole("heading", { name: "branch-coverage-gate" })).toBeInTheDocument();
    expect(screen.getAllByText("v3").length).toBeGreaterThan(0);
    expect(screen.getByText(/Write it as a directive/)).toBeInTheDocument();
    expect(save()).toBeDisabled();
    expect(screen.queryByText("unsaved")).not.toBeInTheDocument();
  });

  it("sends only the changed fields", () => {
    render(ui(SKILL));
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Use when tests change." } });
    expect(screen.getByText("unsaved")).toBeInTheDocument();
    fireEvent.click(save());
    expect(update).toHaveBeenCalledWith({ id: "s1", patch: { description: "Use when tests change." } }, expect.anything());
  });

  it("a list toggle saved meanwhile is not overwritten by Save", () => {
    const { rerender } = render(ui(SKILL));
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "New." } });
    // The list card disables the skill → the query cache hands us the new value.
    rerender(ui({ ...SKILL, enabled: false }));
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
    fireEvent.click(save());
    expect(update).toHaveBeenCalledWith({ id: "s1", patch: { description: "New." } }, expect.anything());
  });

  it("the form toggle is saved with Save (not immediately)", () => {
    render(ui(SKILL));
    fireEvent.click(screen.getByRole("switch"));
    expect(update).not.toHaveBeenCalled();
    fireEvent.click(save());
    expect(update).toHaveBeenCalledWith({ id: "s1", patch: { enabled: false } }, expect.anything());
  });

  it("blocks invalid input and shows a 409 on the name field", () => {
    render(ui(SKILL));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Bad Name" } });
    expect(screen.getByRole("alert")).toHaveTextContent("Use kebab-case");
    fireEvent.click(save());
    expect(update).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "taken-name" } });
    update.mockImplementation((_vars, opts) => opts.onError(new ApiError("exists", 409, "conflict")));
    fireEvent.click(save());
    expect(screen.getByRole("alert")).toHaveTextContent("A skill with this name already exists.");
  });

  it("colours Markdown heading lines in the body editor", () => {
    const { container } = render(ui({ ...SKILL, body: "# Gate\nCheck branches.\n## Inputs\n#not-a-heading" }));
    const headings = [...container.querySelectorAll("[data-md-heading]")].map((el) => el.textContent);
    expect(headings).toEqual(["# Gate", "## Inputs"]);
  });

  it("asks before deleting and says how many agents lose the skill", () => {
    render(ui(SKILL));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByText("Delete branch-coverage-gate?")).toBeInTheDocument();
    expect(screen.getByText(/attached to 1 agent and will be detached/)).toBeInTheDocument();
  });
});

describe("SkillDetail — create mode", () => {
  it("has no Stats tab and creates a manual skill", () => {
    render(ui(undefined));
    expect(screen.getByRole("heading", { name: "New skill" })).toBeInTheDocument();
    expect(screen.queryByText("Stats")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "edge-cases" } });
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Use when tests change." } });
    fireEvent.change(screen.getByLabelText("Skill body"), { target: { value: "# Edge" } });
    fireEvent.click(screen.getByRole("button", { name: "Create skill" }));
    expect(create).toHaveBeenCalledWith(
      { name: "edge-cases", description: "Use when tests change.", type: "custom", body: "# Edge", enabled: true, source: "manual" },
      expect.anything(),
    );
  });
});

describe("SkillDetail — Preview", () => {
  it("renders the body as a document: headings and lists, without the prompt header", () => {
    render(ui({ ...SKILL, body: "# Gate\nCheck branches.\n\n## Inputs\n- empty value\n- null" }, "preview"));
    const preview = screen.getByTestId("skill-preview");
    expect(within(preview).getByRole("heading", { level: 1, name: "Gate" })).toBeInTheDocument();
    expect(within(preview).getByRole("heading", { level: 2, name: "Inputs" })).toBeInTheDocument();
    expect(within(preview).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["empty value", "null"]);
    expect(preview).toHaveTextContent("Check branches.");
    expect(preview).not.toHaveTextContent("Skill: branch-coverage-gate");
    expect(screen.getByText("Rendered as the reviewing agent receives it.")).toBeInTheDocument();
  });

  it("notes when the skill is disabled", () => {
    render(ui({ ...SKILL, enabled: false }, "preview"));
    expect(screen.getByText(/agents don’t receive this skill/)).toBeInTheDocument();
  });
});

describe("SkillDetail — Stats", () => {
  it("shows Used by, runs, accept rate and findings for 30 days, and the agents with an Open link", () => {
    render(ui(SKILL, "stats"));
    expect(screen.getByText("Used by")).toBeInTheDocument();
    expect(screen.getByText("Runs (30d)").parentElement).toHaveTextContent("4");
    expect(screen.getByText("Findings (30d)").parentElement).toHaveTextContent("7");
    expect(screen.getByText("3 accepted · 1 dismissed")).toBeInTheDocument();
    expect(screen.getAllByText("75").length).toBeGreaterThan(0);
    expect(screen.getByText(/aren’t attributed to one skill/)).toBeInTheDocument();
    expect(screen.getByText("Test Quality Reviewer")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open" })).toBeInTheDocument();
    expect(screen.queryByText(/pull frequency/i)).not.toBeInTheDocument();
  });

  it("shows a dash, not 0%, while no finding is accepted or dismissed", () => {
    stats.mockReturnValue({
      data: { window_days: 30, runs: 3, findings: 0, accepted: 0, dismissed: 0, accept_rate: null },
      isLoading: false,
    });
    render(ui(SKILL, "stats"));
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByText("%")).not.toBeInTheDocument();
  });
});
