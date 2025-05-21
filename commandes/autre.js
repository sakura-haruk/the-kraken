import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { promises as fsPromises } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Fonction pour charger les paramètres du serveur
async function loadJson(filePath) {
  try {
    const data = await fsPromises.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Erreur de lecture du fichier JSON :', err);
    return {};
  }
}

async function getGuildSettings(guildId) {
  const settingsPath = path.join(__dirname, '..', 'data', 'guildSettings.json');
  const guildSettings = await loadJson(settingsPath);
  return guildSettings[guildId] || {};
}

export const helpFields = [
  {
    name: '❓ Aide',
    value: '`[prefix]help` — Affiche ce message d\'aide avec la liste des commandes disponibles.'
  },
  {
    name: '📊 Sondages',
    value: '`[prefix]poll <question> ; <option1> ; <option2> ; ...` — Crée un sondage avec jusqu\'à 10 options.\n' +
           '`[prefix]closepoll <ID>` — Ferme un sondage en cours grâce à son ID.'
  },
  {
    name: '🌐 Langues',
    value: '`[prefix]setlangues` — Affiche des boutons pour choisir ou retirer vos rôles langues (toggle).'
  }
];

// Map pour stocker les sondages actifs : Map<pollId, pollData>
export const activePolls = new Map();

// Emoji lettres pour les options du sondage
const emojiLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

// Définition des langues disponibles
const langueCodes = {
  'fr': { emoji: '🇫🇷', label: 'Français' },
  'en': { emoji: '🇬🇧', label: 'English' },
  'es': { emoji: '🇪🇸', label: 'Español' },
  'de': { emoji: '🇩🇪', label: 'Deutsch' },
  'pt': { emoji: '🇵🇹', label: 'Português' },
  'ru': { emoji: '🇷🇺', label: 'Русский' },
  'hu': { emoji: '🇭🇺', label: 'Magyar' }
};

// Gestion des commandes "diverses" : poll, closepoll, setlangues
export async function handleOthersCommand(command, message, args) {
  const commandBody = message.content.slice(1).trim();
  const [...rest] = commandBody.split(' ');
  const fullArgs = rest.join(' ');

  // === COMMANDES DE SONDAGE ===
  if (command === 'poll') {
    // Parse flags et arguments
    const flags = fullArgs.match(/--\w+(=([^\s]+))?/g) || [];
    const inputWithoutFlags = fullArgs.replace(/--\w+(=([^\s]+))?/g, '').trim();

    const input = inputWithoutFlags.split(';').map(arg => arg.trim());
    if (input.length < 3 || input.length > 11) {
      return message.reply("❌ Utilisation : `!poll Question ?; Option 1; Option 2; ...` (2 à 10 options)");
    }

    const [question, ...options] = input;

    let roles = [];
    let anonymous = false;

    flags.forEach(flag => {
      if (flag.startsWith('--roles=')) {
        roles = flag.split('=')[1].split(',').map(r => r.trim());
      } else if (flag === '--anonymous') {
        anonymous = true;
      }
    });

    // Embed du sondage
    const fields = options.map((opt, i) => ({
      name: `${emojiLetters[i]} ${opt}`,
      value: '\u200b',
    }));

    const pollId = Date.now().toString().slice(-6);

    const embed = new EmbedBuilder()
      .setTitle(`📊 ${question}`)
      .addFields(...fields)
      .setFooter({ text: `ID du sondage : ${pollId}` })
      .setColor('Random');

    // Boutons des options
    const row = new ActionRowBuilder();
    options.forEach((opt, i) => {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`poll_${pollId}_${i}`)
          .setLabel(emojiLetters[i])
          .setStyle(ButtonStyle.Primary)
      );
    });

    const pollMessage = await message.channel.send({ embeds: [embed], components: [row] });

    // Enregistrement du sondage (stockage global par ID)
    activePolls.set(pollId, {
      channelId: message.channel.id,
      message: pollMessage,
      roles,
      anonymous,
      results: {},        // { optionIndex: voteCount }
      voters: new Map()   // { userId: optionIndex }
    });

    return message.reply(`✅ Sondage créé avec l'ID \`${pollId}\`.`);
  }

  if (command === 'closepoll') {
    const pollId = rest[1];
    if (!pollId) return message.reply("❌ Utilisation : `!closepoll [ID]`");

    if (!activePolls.has(pollId)) {
      return message.reply("❌ Aucun sondage actif avec cet ID.");
    }

    const pollData = activePolls.get(pollId);

    // Optionnel : forcer fermeture dans le même salon
    if (pollData.channelId !== message.channel.id) {
      return message.reply("❌ Tu dois fermer le sondage dans le même salon où il a été créé.");
    }

    const pollMessage = pollData.message;
    const results = pollData.results;

    // Format des résultats
    const resultText = emojiLetters
      .slice(0, Object.keys(results).length)
      .map((emoji, i) => `Option ${emoji} : ${results[i] || 0} vote(s)`)
      .join('\n');

    // Désactivation des boutons
    const disabledRow = new ActionRowBuilder().addComponents(
      pollMessage.components[0].components.map(button =>
        ButtonBuilder.from(button).setDisabled(true)
      )
    );

    await pollMessage.edit({ components: [disabledRow] });
    activePolls.delete(pollId);

    return message.channel.send(`📥 Résultats du sondage \`${pollId}\` :\n${resultText}`);
  }

  // === COMMANDE SETLANGUES ===
  if (command === 'setlangues') {
    // Récupérer les paramètres du serveur
    const guildSettings = await getGuildSettings(message.guild.id);
    const langueRoles = guildSettings.langueRoles || {};
    
    // Créer la description du message
    let description = "Clique sur le bouton correspondant à ta langue (un clic pour activer/désactiver) :\n\n";
    for (const [code, info] of Object.entries(langueCodes)) {
      description += `${info.emoji} — ${info.label}\n`;
    }

    const embed = new EmbedBuilder()
      .setColor('#2ecc71')
      .setTitle('🌍 Choisis ta langue')
      .setDescription(description);

    // Créer les boutons pour chaque langue configurée
    const row1 = new ActionRowBuilder();
    const row2 = new ActionRowBuilder();
    const row3 = new ActionRowBuilder();
    
    let buttonCount = 0;
    const buttonsPerRow = 3;
    
    for (const [code, info] of Object.entries(langueCodes)) {
      const roleId = langueRoles[code] || '';
      if (!roleId) continue; // Ignorer les langues sans rôle configuré
      
      const button = new ButtonBuilder()
        .setCustomId(`lang_${code}_${roleId}`)
        .setLabel(`${info.label} ${info.emoji}`)
        .setStyle(ButtonStyle.Primary);
      
      // Ajouter le bouton à la ligne appropriée
      if (buttonCount < buttonsPerRow) {
        row1.addComponents(button);
      } else if (buttonCount < buttonsPerRow * 2) {
        row2.addComponents(button);
      } else {
        row3.addComponents(button);
      }
      buttonCount++;
    }
    
    // Ajouter seulement les rangées qui ont des boutons
    const rows = [];
    if (row1.components.length > 0) rows.push(row1);
    if (row2.components.length > 0) rows.push(row2);
    if (row3.components.length > 0) rows.push(row3);
    
    if (rows.length === 0) {
      return message.reply("❌ Aucun rôle de langue n'a été configuré dans le dashboard pour ce serveur.");
    }
    
    await message.channel.send({ embeds: [embed], components: rows });
    return true;
  }
}

// Gestion des clics sur boutons (sondages + setlangues)
export async function handleButtonInteraction(interaction) {
  if (!interaction.isButton()) return false;

  const customId = interaction.customId;

  // --- Gestion des boutons de sondage ---
  if (customId.startsWith('poll_')) {
    const [_, pollId, optionIndexStr] = customId.split('_');
    const optionIndex = parseInt(optionIndexStr);

    if (!activePolls.has(pollId)) {
      await interaction.reply({ 
        content: '❌ Ce sondage n\'existe plus ou est fermé.', 
        ephemeral: true 
      });
      return true;
    }

    const pollData = activePolls.get(pollId);

    // Vérification des rôles requis si nécessaire
    if (pollData.roles.length > 0) {
      const memberRoleIds = interaction.member.roles.cache.map(r => r.id);
      const hasRole = pollData.roles.some(rId => memberRoleIds.includes(rId));
      if (!hasRole) {
        await interaction.reply({ 
          content: '❌ Tu n\'as pas le rôle nécessaire pour voter.', 
          ephemeral: true 
        });
        return true;
      }
    }

    const previousVote = pollData.voters.get(interaction.user.id);

    // Si l'utilisateur vote pour la même option que précédemment
    if (previousVote === optionIndex) {
      await interaction.reply({ 
        content: `✅ Tu as déjà voté pour cette option (${emojiLetters[optionIndex]}).`, 
        ephemeral: true 
      });
      return true;
    }

    // Si l'utilisateur change son vote, on retire son vote précédent
    if (previousVote !== undefined) {
      pollData.results[previousVote] = Math.max(0, (pollData.results[previousVote] || 0) - 1);
    }

    // Enregistrement du nouveau vote
    pollData.voters.set(interaction.user.id, optionIndex);
    pollData.results[optionIndex] = (pollData.results[optionIndex] || 0) + 1;

    // Réponse au votant selon que le sondage est anonyme ou non
    if (pollData.anonymous) {
      await interaction.reply({ 
        content: `✅ Vote enregistré. (sondage anonyme)`, 
        ephemeral: true 
      });
    } else {
      await interaction.reply({ 
        content: `✅ Tu as voté pour l'option ${emojiLetters[optionIndex]}.`, 
        ephemeral: true 
      });
    }

    return true;
  }

  // --- Gestion des boutons de sélection/désélection des rôles langues ---
  if (customId.startsWith('lang_')) {
    const [_, langCode, roleId] = customId.split('_');
    
    const role = interaction.guild.roles.cache.get(roleId);
    if (!role) {
      await interaction.reply({ 
        content: `❌ Le rôle est introuvable (ID: ${roleId}).`, 
        ephemeral: true 
      });
      return true;
    }

    const member = interaction.member;

    try {
      if (member.roles.cache.has(role.id)) {
        await member.roles.remove(role);
        await interaction.reply({ 
          content: `🗑️ Le rôle **${role.name}** t'a été retiré.`, 
          ephemeral: true 
        });
      } else {
        await member.roles.add(role);
        await interaction.reply({ 
          content: `✅ Tu as maintenant le rôle **${role.name}**.`, 
          ephemeral: true 
        });
      }
    } catch (err) {
      console.error('Erreur setlangues:', err);
      await interaction.reply({ 
        content: '❌ Une erreur est survenue.', 
        ephemeral: true 
      });
    }

    return true;
  }

  return false;
}