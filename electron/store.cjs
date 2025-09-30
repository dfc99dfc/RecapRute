const fs = require('fs');
const path = require('path');
const { app } = require('electron');

function getDataPath() {
  const dir = app.getPath('userData');
  return path.join(dir, 'roadready-data.json');
}

function ensureFile() {
  const p = getDataPath();
  if (!fs.existsSync(p)) {
    const init = {
      pins: [],
      speedEdits: {},
      route: null,
      points: 0,
      collectedBy: [],
      center: { lat: 65.7369, lng: 24.5637 },
      radiusM: 10000,
    };
    fs.writeFileSync(p, JSON.stringify(init, null, 2), 'utf-8');
  }
}

async function readData() {
  ensureFile();
  const raw = fs.readFileSync(getDataPath(), 'utf-8');
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function writeData(data) {
  ensureFile();
  fs.writeFileSync(getDataPath(), JSON.stringify(data, null, 2), 'utf-8');
}

async function exportTo(filePath) {
  ensureFile();
  fs.copyFileSync(getDataPath(), filePath);
}

async function importFrom(filePath) {
  ensureFile();
  const raw = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(raw);
  await writeData(data);
}

module.exports = { readData, writeData, exportTo, importFrom };
