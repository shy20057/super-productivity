# Remove custom cloud account implementation plan

**Goal:** Remove the added Account page, ChatGPT sign-in and Sites-specific sync service; retain the project's original SuperSync and file-provider authentication.

**Architecture:** Angular continues to persist locally and use its existing sync providers. Prepare Sites as a static Angular deployment using the existing project identity. Existing remote R2 objects and device-local tasks/credentials are retained; no publication or automatic provider migration occurs.

**Tech stack:** Angular, TypeScript, existing sync providers, static Sites hosting.

**Spec:** User request in this chat to delete the added authentication page/function and use original account functionality.

## Constraints and review focus

- Preserve unrelated dirty files, Dropbox `/DEV/`, theme deletion, Chinese UI and schedule styling.
- User approved only the focused sync-dialog/header regression tests in this chat.
- Never erase IndexedDB, saved provider credentials, R2 objects or local preview storage.
- Do not publish or push Sites source before asking whether all local modifications are complete and receiving confirmation.
- Original SuperSync authentication, provider settings, encryption setup and conflict handling remain usable.

## Tasks

- [x] Remove account route/header entry, account component/service/model/specs and deployment config asset. Restore ordinary sync-dialog rendering/save flow without account-specific handoffs.
- [x] Remove obsolete English/Chinese account strings using existing generated-key workflow; remove the now-obsolete account documentation and auth service-worker exceptions.
- [x] Retire the custom Sites server/scaffold while retaining ignored runtime/storage directories. Keep the same Site ID and prepare a dependency-free static hosting manifest and asset-copy helper. Static hosting requires unused d1/r2 bindings to be null; no cloud resource or data deletion is performed by this preparation.
- [x] Run batched checkFile for edited TypeScript, compile Angular and inspect remaining references. Run the focused original sync-dialog/header regressions after approval. Report local-only status and remaining original-server configuration needs.

## Validation and review

- Batched TypeScript checkFile passed: `.tmp/logs/checkFile.1793014598563-58492.log`.
- Focused original sync-dialog/header regressions passed, **76 tests**: `.tmp/logs/test-file.1793014610655-24156.log`.
- Production Angular build passed: `.tmp/logs/ng.1793014734892-23672.log`.
- Translation keys regenerated through `int` and formatted; unrelated locale escape formatting retained.
- Fresh-context review found no concrete P1/P2 issues. Local static output is prepared after compilation; no cloud source push, save or deployment performed.
