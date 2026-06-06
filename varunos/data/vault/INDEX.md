# VarunOS Vault

The second brain. Markdown files you can open in Obsidian, edit by hand, version with git.

## Structure

```
vault/
├── daily/         one file per day, the actual log
├── workouts/      per-session detail
├── insights/      pattern detections (Hermes-side)
├── decisions/     why-we-changed-X notes
├── research/      articles, studies, video notes
├── recipes/       tested meals with macros
├── form/          form-cue video analysis notes
├── injuries/      pain log + recovery timeline
├── programs/      program-level notes
├── goals/         goal tracking with projection
└── prs/           personal record log
```

## Conventions

- **Filename** = `YYYY-MM-DD-slug.md` (sortable, searchable)
- **YAML frontmatter** for machine parsing
- **Tag taxonomy** in frontmatter; body is human
- **One concept per file**; link liberally with `[[wikilinks]]`
- **Plain text, no proprietary formats**

## What lives here vs. the encrypted vault

| Here (this folder) | Encrypted vault (medical/) |
|---|---|
| Workouts, sets, PRs | Raw BP readings |
| Meals (with macros) | Lipid panel values |
| Daily notes | CGM/EKG data |
| Form notes | HbA1c results |
| Decisions | Family history detail |
| Goals | Lab reports (PDFs) |
| Programs | Doctor visit notes |

The encrypted vault is opt-in, AES-256, never leaves the box.
This folder is git-versioned, can be opened on your laptop, can be backed up to a private repo.

## First 5 files to create after onboarding

1. `goals/main-2026.md`
2. `programs/PPL-Power.md`
3. `research/cut-vs-recomp.md`
4. `recipes/dal-paneer-500kcal.md`
5. `form/bench-cue-2026-06.md`
