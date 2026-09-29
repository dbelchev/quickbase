# Coding Standards

This file is the **index and load protocol** for repo coding standards. Rule bodies live in skills; keep them out of context until a matching branch fires.

Code changes must conform to the skills below. A documented override in this file always wins over a generic skill and over the `code-review` smell baseline.

## Load protocol

1. **Match a branch** in the table — only skills whose branch applies to the work in front of you.
2. **Read that skill's `SKILL.md`** under `.agents/skills/<skill>/` — Quick Reference / rule ids only.
3. **Open only needed `rules/<rule-id>.md` files** for the hunks or APIs you are writing or reviewing.
4. **Cite** as `<skill>` + `<rule-id>` (example: `vercel-react-best-practices` / `async-parallel`).

Stay on that ladder. Treat `rules-map.md` (and any other compiled all-rules dump) as offline reference for humans, not agent context.

For `/code-review` Standards: pass **this file** (skill list + this protocol) to the sub-agent. The sub-agent selects rule files from the diff. Do not paste skill or rule bodies into the parent prompt.

## Skills by branch

| Reach when the work involves… | Skill |
| --- | --- |
| React/Next performance: waterfalls, bundles, RSC/data fetching, re-renders | `vercel-react-best-practices` |
| React composition: boolean props, compound components, providers, variants | `vercel-composition-patterns` |
| Building accessible, composable UI components | `building-components` |
| Web interface / UX guideline review | `web-design-guidelines` |
| Next.js App Router conventions and data patterns | `next-best-practices` |
| Next.js Cache Components (`use cache`, PPR, tags) | `next-cache-components` |
| Upgrading Next.js | `next-upgrade` |
| Turborepo / monorepo pipelines and packages | `turborepo` |

## Overrides

> Project-specific rules that differ from the generic skills, or conventions the skills cannot know. Add entries here as they emerge.
