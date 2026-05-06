# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 5.1.0 - 2026-05-06

### Fixed
- Add missing peer dependency

## 5.0.0 - 2026-05-06

### Added
- ImmersiveView implementation for media
- New Caption Manager for Media Tray with auto-captioning (ASR) support
- ClosedCaptionPanelV2 wired into AudioOptionsTray
- Real ASR endpoint integration into ClosedCaptionPanelV2
- Delete button for failed ASR caption requests
- Download caption option for Canvas media
- Size selector for audio tray
- Unsaved changes tooltip for audio/video trays
- Inline-edit support via new studio-player version
- Pendo analytics for Canvas media, wired through studio-player
  `onTrackEvent` and extended for new player events

### Changed
- **Breaking:** Upgraded InstUI from v10 to v11
- Upgraded `@instructure/studio-player` to 1.10.0
- Upgraded TypeScript to 6.0.2
- Removed lodash dependency (migrated to es-toolkit)
- Removed `consolidated_media_player` feature flag
- Enhanced error states for manual caption uploads
- DX improvements to canvas-media

### Fixed
- Media recording save with disabled webcam
- Media capture save loop after InstUI v11 upgrade
- Caption file button a11y label format
- A11y: caption creator label associations and accessibility
- A11y: focus management in Caption Manager
- A11y: SR alerts for caption add/delete and file selection
- A11y: caption status text linked to language name via aria-describedby
- A11y: caption file input linked via aria-describedby
- A11y: captions wrapped in semantic list structure
- A11y: corrected heading hierarchy in options tray
- Stabilized flaky ClosedCaptionPanelV2 retry tests

### Security
- Upgraded axios to 1.13.5 (CSRF/security vulnerability)

### Reverted
- "Upgrade MediaCapture package to latest version"

### Localization
- Updated canvas-media translations

## 4.1.0 - 2025-10-16

### Changed
- Upgraded to InstUI 10.26.2

## 4.0.0 - 2025-10-13

### Added
- Immersive view for Canvas media

### Changed
- Upgraded to InstUI 10.25.0
- Upgraded studio-player package to 1.3.5
- Upgraded Biome from 1.9.4 to 2.2.4
- Unified image upload buttons
- Simplified canvas-media format-message configuration

### Fixed
- RCE studio embed improvements to work on Course level
- Predictable Value Range from Previous Values vulnerability
- Snyk canvas-rce/canvas-media CSRF vulnerability (axios)

## 3.0.0 - 2025-03-31

## Changed
- Upgraded Instructure UI dependencies to version 10
- Upgraded studio-player package to 0.4.5
- Removed media_links_use_attachment_id feature flag

## 1.9.0 - 2024-10-18

### Added
- New optional media player for upload previews

### Changed
- Upgraded React to 18

## 1.8.0 - 2023-10-11

### Changed
- Upgraded Instructure UI dependencies to version 8

### Fixed
- A small bug that incorrectly determined media types

## 1.7.1 - 2023-09-26

### Fixed
- An issue where media controls don't respond in Safari
- Accessibility issues when adding media captions
- An issue where inherited media captions don't appear in the media captions list

## 1.7.0 - 2023-08-15

### Added
- Explanations for inherited media captions and associated translations

### Changed
- Reduced amount of console errors when running jest tests by providing missing props, fixing async issues, etc in tests

## 1.6.0 - 2023-06-30

### Added
- An alert if the user uploads a caption file that's too large

### Changed
- Improved the i18n string extraction process

### Fixed
- Some missing translations
- An issue where closed caption selection didn't work in full screen

## 1.4.0 - 2022-11-03

### Changed
- No longer need to provide closed caption language list

## 1.3.0 - 2022-08-17

### Added
- A changelog to make changes clear
