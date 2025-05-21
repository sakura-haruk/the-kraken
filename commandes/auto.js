import { promises as fsPromises, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';




// __dirname pour module ES
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Bloc d'aide exporté
export const autoHelp = {
  name: '🤖 Auto-react/message',
  value: '`[prefix]createcommande [message]` — Crée une commande auto-répondante (ex: [prefix]createcommande ping pong)\n' +
         '`[prefix]delcommande [message]` — Supprime une commande auto-répondante (ex: [prefix]delcommande ping)\n' +
         '`[prefix]listecommandes` — Liste toutes les commandes auto-répondantes\n' +
         '`[prefix]autorespond [message]` — Crée une auto-reponse (ex: Salut à toi 👋 : répond "Salut à toi 👋" quand quelqu\'un dit "bonjour")\n' +
         '`[prefix]delrespond [numero]` — Supprime une auto-réponse (ex: [prefix]delrespond 1)\n' +
         '`[prefix]listrespond` — Liste toutes les auto-réponses\n' +
         '`[prefix]delreact [numero]` — Supprime une auto-réaction (ex: [prefix]delreact 1)\n' +
         '`[prefix]listreact` — Liste toutes les auto-réactions\n' +
         '`[prefix]addreact [mot] [emoji]` — Ajoute une auto-réaction'
};
// Chemins des fichiers
const customCommandsPath = path.join(__dirname, '../data', 'customCommands.json');
const autoRepliesPath = path.join(__dirname, '../data', 'autoReplies.json');
const autoReactsPath = path.join(__dirname, '../data', 'autoReacts.json');

// exemple : déclaration
const autoReacts = new Map();
loadAutoReacts(); // Charge les réactions automatiques

// export
export { autoReacts, /*reloadAutoReacts,*/ /*reactPath */ };

// Chargement des données
const customCommands = new Map();
loadCustomCommands(); // Charge les commandes personnalisées

async function loadCustomCommands() {
  customCommands.clear();
  const rawCommands = await loadJson(customCommandsPath);
  for (const [guildId, commandsObj] of Object.entries(rawCommands)) {
    customCommands.set(guildId, new Map(Object.entries(commandsObj)));
  }
}
const autoReplies = new Map();
loadAutoReplies(); // Charge les réponses automatiques

async function loadAutoReplies() {
  autoReplies.clear();
  const rawReplies = Object.entries(await loadJson(autoRepliesPath));
  for (const [guildId, repliesObj] of rawReplies) {
    autoReplies.set(guildId, repliesObj);
  }
}
async function loadAutoReacts() {
  autoReacts.clear();
  const rawReacts = Object.entries(await loadJson(autoReactsPath));
  for (const [guildId, repliesObj] of rawReacts) {
    autoReacts.set(guildId, repliesObj);
  }
}
// Fonctions utilitaires JSON
async function loadJson(filePath) {
  try {
    const data = await fsPromises.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Erreur de lecture du fichier JSON :', err);
    return {};
  }
}

// Fonction de sauvegarde
async function saveJson(filePath, data) {
  try {
    await fsPromises.writeFile(filePath, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Erreur d\'écriture dans le fichier JSON :', err);
  }
}

// Configuration du préfixe par défaut (à adapter selon votre configuration)
const DEFAULT_PREFIX = '!';

// Fonction principale
export async function AutoReactsAndReplies(message) {
  const content = message.content;

  // Réactions automatiques
  for (const [trigger, emoji] of autoReacts) {
    if (content.toLowerCase().includes(trigger.toLowerCase())) {
      try {
        await message.react(emoji);
      } catch (err) {
        console.error('Erreur de réaction :', err);
      }
    }
  }
  
  
  // Réponses automatiques
  for (const [trigger, response] of autoReplies) {
    
    if (content.toLowerCase().includes(trigger.toLowerCase())) {
      return message.reply(response);
    }
  }
}
export async function AutoFeaturesCommands(command, message, args, prefix = DEFAULT_PREFIX) {


  // Commandes personnalisées
  const guildCommands = customCommands.get(message.guild?.id);
  if (guildCommands && guildCommands.has(command)) {
    return message.reply(guildCommands.get(command));
  }

  if (!command) return;

  // Commande pour créer une commande personnalisée
  if (command === 'createcommande') {
    // Vérification permission administrateur
    if (!message.member.permissions.has('ADMINISTRATOR')) {
      return message.reply("🚫 Tu n'as pas la permission d'utiliser cette commande.");
    }

    // Vérifie les arguments
    const [name, ...response] = args;
    if (!name || response.length === 0) {
      return message.reply(`❌ Utilisation : \`${prefix}createcommande [nom] [réponse]\``);
    }

    // Crée ou récupère la Map des commandes pour ce serveur
    if (!customCommands.has(message.guild.id)) {
      customCommands.set(message.guild.id, new Map());
    }
    const guildCommands = customCommands.get(message.guild.id);

    guildCommands.set(name.toLowerCase(), response.join(' '));

    // Sauvegarde dans le fichier JSON (conversion Map -> objet)
    const objToSave = {};
    for (const [guildId, cmdsMap] of customCommands.entries()) {
      objToSave[guildId] = Object.fromEntries(cmdsMap);
    }
    await saveJson(customCommandsPath, objToSave);
    await loadCustomCommands(); // Recharge les commandes personnalisées

    return message.reply(`✅ Commande \`${name}\` créée.`);
  }

  if (command === 'listecommandes') {
    const guildId = message.guild.id;

    if (!customCommands.has(guildId)) {
      return message.reply('📭 Aucune commande personnalisée enregistrée pour ce serveur.');
    }

    const guildCommands = customCommands.get(guildId);
    const commandNames = [...guildCommands.keys()];

    if (commandNames.length === 0) {
      return message.reply('📭 Aucune commande personnalisée enregistrée pour ce serveur.');
    }

    // Filtrage des noms non pertinents (par exemple, uniquement lettres/chiffres/underscores)
    const filtered = commandNames.filter(name => /^[a-zA-Z0-9_]{2,32}$/.test(name));

    const formatted = filtered
      .sort()
      .map(name => `• \`${prefix}${name}\``)
      .join('\n');

    return message.reply(`📜 Commandes personnalisées :\n${formatted}`);
  }

  if (command === 'delcommande') {
    if (!message.member.permissions.has('ADMINISTRATOR')) {
      return message.reply("🚫 Tu n'as pas la permission d'utiliser cette commande.");
    }

    const name = args[0];
    if (!name) return message.reply(`❌ Utilisation : \`${prefix}delcommande [nom]\``);

    // Vérifie que le serveur a bien des commandes personnalisées
    if (!customCommands.has(message.guild.id)) {
      return message.reply('📭 Aucune commande personnalisée enregistrée.');
    }

    const guildCommands = customCommands.get(message.guild.id);

    // Vérifie que la commande existe
    if (!guildCommands.has(name)) {
      return message.reply(`❌ La commande \`${name}\` n'existe pas.`);
    }

    // Supprime et sauvegarde
    guildCommands.delete(name);

    // Sauvegarde dans le fichier JSON
    const objToSave = {};
    for (const [guildId, cmdsMap] of customCommands.entries()) {
      objToSave[guildId] = Object.fromEntries(cmdsMap);
    }
    await saveJson(customCommandsPath, objToSave);

    return message.reply(`🗑 Commande \`${name}\` supprimée.`);
  }

  if (command === 'listreact') {
    if (autoReacts.size === 0) {
      return message.reply("❌ Aucune réaction automatique définie.");
    }

    const list = [...autoReacts.entries()]
      .map(([trigger, emoji], index) => `${index + 1}. ${trigger} → ${emoji}`)
      .join('\n');

    return message.reply(`📜 Réactions automatiques enregistrées :\n${list}`);
  }

  if (command === 'delreact') {
    if (!message.member.permissions.has('ADMINISTRATOR')) {
      return message.reply("🚫 Tu n'as pas la permission d'utiliser cette commande.");
    }

    const index = parseInt(args[0], 10) - 1;
    if (isNaN(index) || index < 0 || index >= autoReacts.size) {
      return message.reply(`❌ Utilisation : \`${prefix}delreact [numéro]\` où le numéro est un indice valide.`);
    }

    const keys = [...autoReacts.keys()];
    const triggerToDelete = keys[index];
    autoReacts.delete(triggerToDelete);
    await saveJson(autoReactsPath, Object.fromEntries(autoReacts));

    return message.reply(`✅ Réaction associée au déclencheur \`${triggerToDelete}\` supprimée.`);
  }

  // autoreact - ajout d'un alias pour addreact pour correspondre au help
  if (command === 'autoreact') {
    if (!message.member.permissions.has('ADMINISTRATOR')) {
      return message.reply("🚫 Tu n'as pas la permission d'utiliser cette commande.");
    }

    const [trigger, emoji] = args;
    if (!trigger || !emoji) {
      return message.reply(`❌ Utilisation : \`${prefix}autoreact [mot/phrase] [emoji]\``);
    }

    autoReacts.set(trigger, emoji);
    await saveJson(autoReactsPath, Object.fromEntries(autoReacts));
    return message.reply(`✅ Réaction ajoutée : \`${trigger}\` → ${emoji}`);
  }

  // addreact (conservé pour compatibilité)
  // Commande !addreact
  if (command === 'addreact') {
    if (!message.member.permissions.has('ADMINISTRATOR')) {
      return message.reply("🚫 Tu n'as pas la permission d'utiliser cette commande.");
    }

    const trigger = args[0];
    const emoji = args[1];

    if (!trigger || !emoji) {
      return message.reply(`❌ Utilisation : \`${prefix}addreact [mot] [emoji]\``);
    }

    autoReacts.set(trigger.toLowerCase(), emoji);
    await saveJson(autoReactsPath, Object.fromEntries(autoReacts));
    await loadAutoReacts(); // <- 🟢 Recharge ici

    return message.reply(`✅ Je réagirai maintenant à **${trigger}** avec : ${emoji}`);
  }

  if (command === 'autorespond') {
    if (!message.member.permissions.has('ADMINISTRATOR')) {
      return message.reply("🚫 Tu n'as pas la permission d'utiliser cette commande.");
    }

    const trigger = args[0];
    const response = args.slice(1).join(' ');

    if (!trigger || !response) {
      return message.reply(`❌ Utilisation : \`${prefix}autorespond [mot] [message]\``);
    }

    autoReplies.set(trigger.toLowerCase(), response);
    await saveJson(autoRepliesPath, Object.fromEntries(autoReplies)); // Sauvegarde
    await loadAutoReplies(); // Recharge les réponses automatiques

    return message.reply(`✅ Je répondrai maintenant à **${trigger}** par : ${response}`);
  }


  // listrespond
  if (command === 'listrespond') {
    if (autoReplies.size === 0) {
      return message.reply('📭 Aucune auto-réponse enregistrée.');
    }

    const list = [...autoReplies.entries()]
      .map(([trigger, response], i) => `${i + 1}. ${trigger} → ${response}`)
      .join('\n');

    return message.reply(`📜 Auto-réponses enregistrées :\n${list}`);
  }

  // delrespond
  if (command === 'delrespond') {
    if (!message.member.permissions.has('ADMINISTRATOR')) {
      return message.reply("🚫 Tu n'as pas la permission d'utiliser cette commande.");
    }

    const index = parseInt(args[0], 10) - 1;
    if (isNaN(index) || index < 0 || index >= autoReplies.size) {
      return message.reply(`❌ Utilisation : \`${prefix}delrespond [numéro]\``);
    }

    const key = [...autoReplies.keys()][index];
    autoReplies.delete(key);
    await saveJson(autoRepliesPath, Object.fromEntries(autoReplies));
    loadAutoReplies(); // Recharge les réponses automatiques

    return message.reply(`🗑 Auto-réponse pour \`${key}\` supprimée.`);
  }
}