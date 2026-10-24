/* hooks/skills.ts — React Query hooks for the Skills Lab (L02): skill CRUD,
   who uses a skill, its run stats, and the import preview. Attaching skills to an agent lives
   in hooks/agents.ts (`useAgentSkills` / `useSetAgentSkills`). */
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type {
  Skill,
  SkillAgentRef,
  SkillImportPreview,
  SkillListItem,
  SkillStats,
  SkillType,
} from "@devdigest/shared";

export function useSkills() {
  return useQuery({
    queryKey: ["skills"],
    queryFn: () => api.get<SkillListItem[]>("/skills"),
  });
}

export function useSkill(id: string | null | undefined) {
  return useQuery({
    queryKey: ["skill", id],
    queryFn: () => api.get<Skill>(`/skills/${id}`),
    enabled: !!id,
  });
}

/** Agents that attach a skill (Stats tab). */
export function useSkillAgents(id: string | null | undefined) {
  return useQuery({
    queryKey: ["skill-agents", id],
    queryFn: () => api.get<SkillAgentRef[]>(`/skills/${id}/agents`),
    enabled: !!id,
  });
}

/** Runs of the last 30 days whose prompt carried the skill, and their findings (Stats tab). */
export function useSkillStats(id: string | null | undefined) {
  return useQuery({
    queryKey: ["skill-stats", id],
    queryFn: () => api.get<SkillStats>(`/skills/${id}/stats`),
    enabled: !!id,
  });
}

export interface CreateSkillInput {
  name: string;
  description: string;
  type: SkillType;
  body: string;
  enabled?: boolean;
  source?: "manual" | "imported_file";
}

export function useCreateSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSkillInput) => api.post<Skill>("/skills", input),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["skills"] });
      qc.setQueryData(["skill", data.id], data);
    },
  });
}

export type SkillPatch = Partial<Pick<Skill, "name" | "description" | "type" | "body" | "enabled">>;

/** Write the saved skill into every cache that shows it (detail + list row). */
function writeSkill(qc: ReturnType<typeof useQueryClient>, skill: Skill) {
  qc.setQueryData(["skill", skill.id], skill);
  qc.setQueryData<SkillListItem[]>(["skills"], (list) =>
    list?.map((s) => (s.id === skill.id ? { ...s, ...skill } : s)),
  );
}

/** Save the changed fields of a skill (Config tab). Sends only what is in `patch`. */
export function useUpdateSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: SkillPatch }) => api.put<Skill>(`/skills/${id}`, patch),
    onSuccess: (data) => {
      writeSkill(qc, data);
      qc.invalidateQueries({ queryKey: ["skills"] });
    },
  });
}

/**
 * Global on/off from a list card: saved at once, optimistic, rolled back on
 * error. Sends `{ enabled }` only, so it never overwrites the other fields.
 */
export function useSetSkillEnabled() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      api.put<Skill>(`/skills/${id}`, { enabled }),
    onMutate: async ({ id, enabled }) => {
      await qc.cancelQueries({ queryKey: ["skills"] });
      await qc.cancelQueries({ queryKey: ["skill", id] });
      const prevList = qc.getQueryData<SkillListItem[]>(["skills"]);
      const prevSkill = qc.getQueryData<Skill>(["skill", id]);
      qc.setQueryData<SkillListItem[]>(["skills"], (list) =>
        list?.map((s) => (s.id === id ? { ...s, enabled } : s)),
      );
      qc.setQueryData<Skill>(["skill", id], (s) => (s ? { ...s, enabled } : s));
      return { prevList, prevSkill };
    },
    onError: (_e, { id }, ctx) => {
      qc.setQueryData(["skills"], ctx?.prevList);
      qc.setQueryData(["skill", id], ctx?.prevSkill);
    },
    onSuccess: (data) => writeSkill(qc, data),
  });
}

export function useDeleteSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<{ ok: boolean }>(`/skills/${id}`),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ["skills"] });
      qc.invalidateQueries({ queryKey: ["agent-skills"] });
      qc.removeQueries({ queryKey: ["skill", id] });
      qc.removeQueries({ queryKey: ["skill-agents", id] });
    },
  });
}

/** Parse an uploaded .md / .zip on the server. Nothing is saved. */
export function useImportSkillPreview() {
  return useMutation({
    mutationFn: (input: { filename: string; content_base64: string }) =>
      api.post<SkillImportPreview>("/skills/import/preview", input),
    // Errors are shown inline in the drawer, not as a global toast.
    meta: { silent: true },
  });
}
