# Albumish

Public website and download page for Albumish.

Albumish is the fastest way to shortlist event photos. The desktop app helps users group similar shots, find likely face matches with local AI beta, choose keepers, and export a clean shortlist.

## Download Links

The page currently points to the latest `v0.1.3` GitHub Release asset URLs:

```text
https://github.com/pankajmnnit/albumish/releases/latest/download/Albumish-0.1.3-arm64.dmg
https://github.com/pankajmnnit/albumish/releases/latest/download/Albumish.Setup.0.1.3.exe
```

When you create a GitHub release, upload your installer files with exactly these names, or update the links in `index.html`.

Recommended release asset names:

```text
Albumish-0.1.3-arm64.dmg
Albumish.Setup.0.1.3.exe
```

The current Mac link is for Apple Silicon. The Windows link is for x64 Windows 10/11. For Intel Macs, publish an x64 Mac build or a universal Mac build and add another button.

## Current Page Highlights

- Mac and Windows installer buttons point to the latest GitHub release.
- Face AI Beta is promoted as a local feature for finding likely matching photos from a reference face photo.
- The page explains that Face AI Beta only adds likely matches to that review flow.

## Free Hosting Option 1: GitHub Pages

1. Push this repository to GitHub.
2. Go to the repository on GitHub.
3. Open Settings -> Pages.
4. Under "Build and deployment", choose "Deploy from a branch".
5. Choose the `main` branch and `/root`.

Your website will be available at:

```text
https://pankajmnnit.github.io/albumish/
```

## Free Hosting Option 2: Netlify

1. Go to Netlify.
2. Choose "Add new site" -> "Deploy manually".
3. Drag this repository folder into Netlify.
4. Netlify will give you a public URL.

## Free Hosting Option 3: Vercel

1. Import the GitHub repo into Vercel.
2. Keep the project root as the repository root.
3. Deploy.

## Local Preview

Open `index.html` directly in a browser, or run:

```bash
npx serve .
```
