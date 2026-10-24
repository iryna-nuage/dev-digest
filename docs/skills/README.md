# Sample skills (L02)

Skill files for the Test Quality Reviewer that are brought in **through the UI** (Skills →
Add Skill → Import from file), so the full import path is exercised. Two more skills
(`branch-coverage-gate`, `mocking-discipline`) are created by the seed — see
`server/src/db/seed-prompts.ts`.

| File | Import as | Shows |
|---|---|---|
| [`edge-case-checklist.md`](edge-case-checklist.md) | `.md` | frontmatter → name, description, type |
| [`api-contract-tests/`](api-contract-tests/) | `.zip` | only `SKILL.md` is read; `scripts/check.sh` is listed as an ignored executable; the `allowed-tools` key is ignored |

Build the archive from this folder (the archive must hold `SKILL.md` at its root or in one
top-level folder):


# Git Bash / macOS / Linux
cd docs/skills && zip -r api-contract-tests.zip api-contract-tests
# PowerShell
Compress-Archive -Path docs/skills/api-contract-tests -DestinationPath api-contract-tests.zip
```

After import, a skill is **disabled**: read the preview, enable it on its Config tab, then
attach it on the agent's Skills tab. Limits and error codes: `server/specs/L02-skills.md`.
