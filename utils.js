import { promises as fsPromises } from 'fs';

export async function saveJson(filePath, data) {
  try {
    await fsPromises.writeFile(filePath, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Erreur d\'écriture dans le fichier JSON :', err);
  }
}

export async function loadJson(filePath) {
  try {
    const data = await fsPromises.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Erreur de lecture du fichier JSON :', err);
    return {};
  }
}
