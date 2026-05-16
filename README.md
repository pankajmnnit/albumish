# Albumish

**Worried about shortlisting hundreds of wedding photos? Albumish helps you quickly review, choose, and copy the photos worth keeping.**

Albumish is a desktop photo-shortlisting app for the moment after a big shoot, trip, event, or wedding album lands on your computer and you realize you now have hundreds or thousands of photos to review.

Instead of opening files one by one in Finder or File Explorer, Albumish lets you move through a folder quickly:

- swipe right or press the right arrow to keep a photo
- swipe left or press the left arrow to pass on it
- rotate sideways previews while reviewing
- undo the last action when you change your mind
- copy only the photos you chose into a new folder when you are done

Your original photos are never deleted or modified.

## The Problem It Solves

Large photo collections are easy to create and tedious to shortlist. Wedding albums, family functions, travel folders, portrait sessions, and camera dumps often contain many near-duplicates. The hard part is not storing them; it is making hundreds of tiny keep-or-pass decisions without losing momentum.

Albumish is built for that exact workflow:

1. Choose the folder containing your photos.
2. Review one image at a time in a focused viewer.
3. Keep or pass with a swipe, click, or keyboard shortcut.
4. Copy only the chosen photos into a destination folder.

This makes the review process feel closer to sorting cards than managing files.

## Features

- Native desktop app for macOS and Windows
- Local-only workflow: photos stay on your machine
- Folder picker for source photos
- One-photo-at-a-time review experience
- Swipe gestures plus keyboard shortcuts
- Smooth keep/pass card transitions
- Rotate left or right during review
- Undo the last action
- Compact progress tracking
- Session persistence after each action
- Safe final copy workflow that leaves originals untouched
- Duplicate filename handling when copying chosen photos

## Keyboard Shortcuts

| Action | Shortcut |
| --- | --- |
| Keep photo | `Right Arrow` |
| Pass photo | `Left Arrow` |
| Undo | `Backspace`, `Ctrl+Z`, or `Cmd+Z` |
| Rotate left | `[` |
| Rotate right | `]` or `R` |

## Supported Photo Formats

Albumish detects:

- JPG / JPEG
- PNG
- GIF
- WebP
- BMP
- TIFF
- HEIC / HEIF

Preview support depends on the image decoders available in Electron/Chromium on the current system.

## How Albumish Stores Data

Albumish saves a small local session so you can continue safely:

- `session.json`
- `selected-photos.txt`

On macOS these are typically stored under:

```text
~/Library/Application Support/Albumish/
```

The session tracks the source folder, chosen photos, passed photos, rotation state, history, and current position.

## Run Locally

Requirements:

- Node.js
- npm

```bash
npm install
npm start
```

## Build Installers

macOS:

```bash
npm run package:mac
```

Windows:

```bash
npm run package:win
```

Build artifacts are written to `dist/`.

Notes:

- Build the macOS `.dmg` on macOS.
- Build the Windows `.exe` on Windows for the most reliable release process.
- Public distribution usually requires platform code signing to avoid security warnings.

## Tech Stack

- Electron
- Plain HTML, CSS, and JavaScript
- Node.js filesystem APIs

## Safety Principles

- Albumish never deletes original photos.
- Albumish copies chosen photos instead of moving them.
- Rotation during review is non-destructive and stored in the session only.
- Full file paths are tracked internally so duplicate filenames in the source folder do not confuse the review state.

## Project Status

Albumish is an MVP that already supports the core shortlisting workflow end to end. Useful future additions could include:

- pause/resume across multiple named sessions
- ZIP export for sharing
- RAW format support
- ratings or favorites
- thumbnails for chosen photos
- signed production installers
