# Tasks: 暖橙靛蓝视觉主题

**Input**: Design documents from `/specs/003-warm-orange-indigo-theme/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [visual-direction.md](./visual-direction.md), [contracts/theme-token-contract.md](./contracts/theme-token-contract.md)

**Status**: Production theme implementation is complete. Device and Developer Tools visual verification remains pending.

## Phase 1: Theme Foundation

- [x] T001 Confirm the approved palette and semantic rules in `specs/003-warm-orange-indigo-theme/visual-direction.md`
- [x] T002 [P] Replace the global green-family variables with the approved semantic tokens in `miniprogram/app.wxss`
- [x] T003 [P] Update page background, navigation bar, and TabBar colors in `miniprogram/app.json` and each page JSON
- [x] T004 Add a theme token/static scan to `tests/run-tests.js` without changing business-flow assertions

## Phase 2: Core User Journey Surfaces (P1)

- [x] T005 [P] Recolor route hero, weather, map hint, station states, and fixed CTA in `miniprogram/pages/route/route.wxss`
- [x] T006 [P] Recolor scan waiting, scanning, success, error, and assurance states in `miniprogram/pages/checkin/checkin.wxss`
- [x] T007 [P] Recolor direct QR-to-photo transition and disabled upload CTA in `miniprogram/pages/upload/upload.wxss`
- [x] T008 [P] Recolor photo stage, camera prompt, privacy checkbox, success sheet, and progress bar in `miniprogram/pages/upload/upload.wxss`
- [x] T009 Review the core journey for accidental business markup or event-handler changes in the four page WXML files

## Phase 3: Supporting Surfaces (P2)

- [x] T010 [P] Recolor metrics, calendar, history, and empty states in `miniprogram/pages/records/records.wxss`
- [x] T011 [P] Recolor profile hero, progress track, badges, settings, and auth sheet in `miniprogram/pages/profile/profile.wxss` and `miniprogram/components/profile-auth/profile-auth.wxss`
- [x] T012 [P] Recolor certificate preview in `miniprogram/pages/certificate/certificate.wxss`
- [x] T013 [P] Recolor saved certificate pixels in `miniprogram/pages/certificate/certificate.js` while preserving drawing coordinates and data bindings

## Phase 4: Native Map and Shared Components

- [x] T014 [P] Recolor route line, marker labels, start marker, and native map overlay in `miniprogram/components/route-map/route-map.js`, `miniprogram/components/route-map/route-map.wxss`, and `miniprogram/utils/route.js`
- [x] T015 Run a repository scan for old app-owned green constants and classify unavoidable third-party/map-tile colors

## Phase 5: Verification and Polish

- [x] T016 Run the bundled Node test runner and confirm all existing business-flow tests remain passing
- [ ] T017 Verify route states `0/3`, `1/3`, and `3/3` in the Developer Tools preview
- [ ] T018 Verify check-in success, wrong-point error, scan cancellation, photo selection and upload success states
- [ ] T019 Verify records, profile, certificate preview, and saved certificate image use the same semantic palette
- [ ] T020 Check narrow and normal phone widths for clipping, overlap, safe-area issues, and contrast failures
- [ ] T021 Record final screenshots and update a theme conformance review before release

## Dependencies and Execution Order

- T001 blocks all implementation tasks because the palette must be approved first.
- T002-T004 establish the shared foundation and can be reviewed independently.
- T005-T009 deliver the P1 core journey and should be verified before supporting pages.
- T010-T015 can proceed in parallel after the token foundation, with T013 requiring special Canvas review.
- T016-T021 are release gates and require all source changes to be present.

## Out of Scope

- NFC, QR validation, local storage, route data, photo persistence, backend, cloud service, and user authorization behavior.
- New illustrations, new screens, new animations, dark mode, user-selectable themes, and a runtime theme switch.
