import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { SkillImportPreview } from "@devdigest/shared";
import messages from "../../../../../../../messages/en/skills.json";
import { ToastProvider } from "../../../../../../lib/toast";
import { ApiError } from "../../../../../../lib/api";
import { checkImportFile } from "./helpers";

const parse = vi.fn();
const create = vi.fn();
const push = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("../../../../../../lib/hooks/skills", () => ({
  useImportSkillPreview: () => ({ mutateAsync: parse }),
  useCreateSkill: () => ({ mutate: create, isPending: false }),
}));

import { ImportSkillDrawer } from "./ImportSkillDrawer";

afterEach(cleanup);
beforeEach(() => {
  parse.mockReset();
  create.mockReset();
  push.mockReset();
});

const PREVIEW: SkillImportPreview = {
  filename: "api.zip",
  name: "api-contract-tests",
  description: "Use when a route changes.",
  type: "custom",
  body: "# API contract tests\nCheck the contract.",
  ignored_files: [
    { path: "api-contract-tests/scripts/check.sh", executable: true },
    { path: "api-contract-tests/notes.txt", executable: false },
  ],
  warnings: [{ code: "executable_ignored", message: "1 executable file(s) ignored." }],
};

function renderDrawer(onClose = vi.fn()) {
  render(
    <NextIntlClientProvider locale="en" messages={{ skills: messages }}>
      <ToastProvider>
        <ImportSkillDrawer onClose={onClose} />
      </ToastProvider>
    </NextIntlClientProvider>,
  );
  return onClose;
}
const pick = (file: File) => fireEvent.change(screen.getByLabelText("Skill file"), { target: { files: [file] } });

describe("checkImportFile", () => {
  it("accepts .md / .zip up to 1 MB", () => {
    expect(checkImportFile({ name: "a.MD", size: 10 })).toBeUndefined();
    expect(checkImportFile({ name: "a.zip", size: 1_048_576 })).toBeUndefined();
    expect(checkImportFile({ name: "a.pdf", size: 10 })).toBe("wrongType");
    expect(checkImportFile({ name: "a.zip", size: 1_048_577 })).toBe("tooLarge");
  });
});

describe("ImportSkillDrawer", () => {
  it("rejects an unsupported file without calling the server", () => {
    renderDrawer();
    pick(new File(["x"], "skill.pdf"));
    expect(screen.getByRole("alert")).toHaveTextContent("Only .md and .zip files can be imported.");
    expect(parse).not.toHaveBeenCalled();
  });

  it("shows the server's error inline", async () => {
    parse.mockRejectedValue(new ApiError("No SKILL.md found at the archive root.", 422, "validation_error"));
    renderDrawer();
    pick(new File(["zip"], "x.zip"));
    expect(await screen.findByRole("alert")).toHaveTextContent("No SKILL.md found");
  });

  it("previews the extracted text, ignored files and warnings, then saves it as an imported (disabled) skill", async () => {
    parse.mockResolvedValue(PREVIEW);
    create.mockImplementation((_input, opts) => opts.onSuccess({ id: "new-id", name: "api-contract-tests" }));
    const onClose = renderDrawer();
    pick(new File(["zip-bytes"], "api.zip"));

    await waitFor(() => expect(parse).toHaveBeenCalledWith({ filename: "api.zip", content_base64: expect.any(String) }));
    expect(atob(parse.mock.calls[0]![0].content_base64)).toBe("zip-bytes");

    expect(await screen.findByText(/saved disabled/)).toBeInTheDocument();
    expect(screen.getByTestId("import-preview-body")).toHaveTextContent("Check the contract.");
    const ignored = screen.getByRole("region", { name: "Ignored files" });
    expect(within(ignored).getByText("api-contract-tests/scripts/check.sh")).toBeInTheDocument();
    expect(within(ignored).getAllByText("executable — not processed")).toHaveLength(1);
    expect(screen.getByRole("region", { name: "Warnings" })).toHaveTextContent("1 executable file(s) ignored.");
    expect(create).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Save skill" }));
    expect(create).toHaveBeenCalledWith(
      {
        name: "api-contract-tests",
        description: "Use when a route changes.",
        type: "custom",
        body: PREVIEW.body,
        source: "imported_file",
      },
      expect.anything(),
    );
    expect(onClose).toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith("/skills/new-id?tab=preview");
  });

  it("requires a description before saving and saves nothing on Cancel", async () => {
    parse.mockResolvedValue({ ...PREVIEW, description: "" });
    const onClose = renderDrawer();
    pick(new File(["md"], "x.md"));
    await screen.findByText(/saved disabled/);

    fireEvent.click(screen.getByRole("button", { name: "Save skill" }));
    expect(create).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("A description is required.");

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });
});
