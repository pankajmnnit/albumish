const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("photoApp", {
  chooseSourceFolder: () => ipcRenderer.invoke("photos:choose-source"),
  loadSession: () => ipcRenderer.invoke("session:load"),
  saveSession: (session) => ipcRenderer.invoke("session:save", session),
  chooseDestinationFolder: () => ipcRenderer.invoke("photos:choose-destination"),
  copySelected: (selectedPaths, destinationFolder) =>
    ipcRenderer.invoke("photos:copy-selected", selectedPaths, destinationFolder),
  onCopyProgress: (callback) => {
    const listener = (_event, progress) => callback(progress);
    ipcRenderer.on("photos:copy-progress", listener);
    return () => ipcRenderer.removeListener("photos:copy-progress", listener);
  }
});
