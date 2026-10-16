# Implemented Code Impact

**Updated**: 2026-09-30

| Module | Change |
|--------|--------|
| `pages/checkin` | One explicit QR action for all devices; no platform or UID branch |
| `pages/route`, `pages/checkin`, `pages/upload`, `pages/profile`, `pages/records` | Scan-specific labels and recovery messages |
| `utils/qr-tags.js`, `utils/qr-validation.js` | Retain exact three-point payloads and current-point matching |
| `utils/progress.js` | QR evidence for new check-ins; keep existing local progress and completed points |
| NFC utilities | Retired from the application package |
| `tests/run-tests.js` | QR contracts, native scanner lifecycle, migration, and platform-independent entry |
| `README.md`, Spec Kit artifacts | QR-only preparation and release criteria |

The three previous NTAG215 UIDs remain in the historical provisioning manifest. They are not required for installation or scanning. No backend is introduced.
