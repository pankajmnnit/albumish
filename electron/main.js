const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const fs = require("fs/promises");
const path = require("path");
const { pathToFileURL } = require("url");

const supportedExtensions = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".bmp",
  ".tif",
  ".tiff",
  ".heic",
  ".heif"
]);

let mainWindow;

function getSessionPath() {
  return path.join(app.getPath("userData"), "session.json");
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1040,
    height: 700,
    minWidth: 860,
    minHeight: 600,
    title: "Albumish",
    backgroundColor: "#111418",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
}

async function collectImages(folderPath) {
  const photos = [];

  async function walk(currentFolder) {
    const entries = await fs.readdir(currentFolder, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentFolder, entry.name);
      if (entry.isDirectory()) {
        if (!entry.name.startsWith(".")) {
          await walk(fullPath);
        }
        continue;
      }

      if (entry.isFile() && supportedExtensions.has(path.extname(entry.name).toLowerCase())) {
        const stat = await fs.stat(fullPath);
        photos.push({
          path: fullPath,
          name: entry.name,
          size: stat.size,
          url: pathToFileURL(fullPath).toString()
        });
      }
    }
  }

  await walk(folderPath);
  photos.sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }));
  return photos;
}

function makeInitialSession(sourceFolder, photos) {
  return {
    sourceFolder,
    photos,
    selected: [],
    rejected: [],
    skipped: [],
    rotations: {},
    history: [],
    currentIndex: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

async function writeSession(session) {
  const sessionPath = getSessionPath();
  await fs.mkdir(path.dirname(sessionPath), { recursive: true });
  const nextSession = {
    selected: [],
    rejected: [],
    skipped: [],
    rotations: {},
    history: [],
    currentIndex: 0,
    ...session,
    rotations: session.rotations || {},
    updatedAt: new Date().toISOString()
  };
  await fs.writeFile(sessionPath, JSON.stringify(nextSession, null, 2), "utf8");

  const selectedPath = path.join(path.dirname(sessionPath), "selected-photos.txt");
  await fs.writeFile(selectedPath, nextSession.selected.join("\n"), "utf8");

  return {
    session: nextSession,
    sessionPath,
    selectedPath
  };
}

async function readSession() {
  try {
    const raw = await fs.readFile(getSessionPath(), "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

function uniqueDestinationPath(destinationFolder, originalPath, usedNames) {
  const parsed = path.parse(originalPath);
  let candidateName = parsed.base;
  let counter = 1;

  while (usedNames.has(candidateName.toLowerCase())) {
    candidateName = `${parsed.name}_${counter}${parsed.ext}`;
    counter += 1;
  }

  usedNames.add(candidateName.toLowerCase());
  return path.join(destinationFolder, candidateName);
}

ipcMain.handle("photos:choose-source", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Choose photo folder",
    properties: ["openDirectory"]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const sourceFolder = result.filePaths[0];
  const photos = await collectImages(sourceFolder);
  const session = makeInitialSession(sourceFolder, photos);
  return writeSession(session);
});

ipcMain.handle("session:load", async () => {
  const session = await readSession();
  if (!session) {
    return null;
  }

  const sessionPath = getSessionPath();
  return {
    session,
    sessionPath,
    selectedPath: path.join(path.dirname(sessionPath), "selected-photos.txt")
  };
});

ipcMain.handle("session:save", async (_event, session) => writeSession(session));

ipcMain.handle("photos:choose-destination", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Choose destination folder",
    properties: ["openDirectory", "createDirectory"]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
});

ipcMain.handle("photos:copy-selected", async (_event, selectedPaths, destinationFolder) => {
  const existingEntries = await fs.readdir(destinationFolder).catch(() => []);
  const usedNames = new Set(existingEntries.map((name) => name.toLowerCase()));
  const copied = [];
  const failed = [];

  for (const sourcePath of selectedPaths) {
    try {
      await fs.access(sourcePath);
      const destinationPath = uniqueDestinationPath(destinationFolder, sourcePath, usedNames);
      await fs.copyFile(sourcePath, destinationPath);
      copied.push({ sourcePath, destinationPath });
    } catch (error) {
      failed.push({ sourcePath, message: error.message });
    }

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("photos:copy-progress", {
        copied: copied.length,
        failed: failed.length,
        total: selectedPaths.length
      });
    }
  }

  return {
    copied,
    failed,
    destinationFolder
  };
});

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
