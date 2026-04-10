# Active Context: JobFit AI

## Current State

**App Status**: ✅ Functional MVP for job-application tailoring

The project is now a Next.js 16 app that lets users upload/paste CV content, paste a job description, and generate a tailored CV plus cover letter via MiniMax API.

## Recently Completed

- [x] Built CV/job description input experience on the home page
- [x] Added results UI with tabs for tailored CV and cover letter
- [x] Added server route at `src/app/api/generate/route.ts` to parse CV and generate outputs
- [x] Switched LLM integration from OpenAI SDK to MiniMax token-based API (`MINIMAX_API_KEY`)
- [x] Removed `openai` dependency from the project
- [x] Added optional reference document upload support (PDF/TXT/MD)
- [x] Updated generation prompts to enforce strict no-fabrication factuality

## Current Structure

| File/Directory | Purpose | Status |
|----------------|---------|--------|
| `src/app/page.tsx` | Home page rendering JobApplyForm | ✅ In use |
| `src/components/JobApplyForm.tsx` | Main upload/input/results UI | ✅ In use |
| `src/app/api/generate/route.ts` | CV parsing + MiniMax generation API | ✅ In use |
| `src/app/layout.tsx` | App metadata and root layout | ✅ Updated |
| `.kilocode/` | AI context, rules, recipes, memory bank | ✅ In use |

## Current Focus

1. Improve output formatting quality for generated CV/cover letter
2. Add support for richer file formats (e.g., DOCX parsing)
3. Add persistence/history for past job applications

## Environment Notes

- Required server env var: `MINIMAX_API_KEY`
- API endpoint used: `https://api.minimax.io/v1/text/chatcompletion_v2`
- Current MiniMax model in use: `MiniMax-Text-01`

## Session History

| Date | Changes |
|------|---------|
| Initial | Template created with base setup |
| 2026-04-10 | Built JobFit AI MVP and switched generation provider from OpenAI to MiniMax |
| 2026-04-10 | Added optional reference uploads and strict fact-only generation constraints |
