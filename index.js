// Chargement des variables d'environnement
import dotenv from "dotenv";
dotenv.config();

const token = process.env.DISCORD_TOKEN;  // uniformisation du nom TOKEN => DISCORD_TOKEN
const clientId = process.env.CLIENT_ID;
const clientSecret = process.env.CLIENT_SECRET;

if (!token || !clientId || !clientSecret) {
  console.error("❌ Erreur : certaines variables d'environnement sont manquantes !");
  process.exit(1);
}

console.log("🔑 Token et identifiants chargés");

console.log("Démarrage du bot...");
process.on('uncaughtException', (error) => {
  console.error('Erreur non capturée:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Rejet non géré:', reason);
});

// Imports nécessaires
import { DisTube } from 'distube';
import { YtDlpPlugin } from '@distube/yt-dlp';
import express from 'express';
import session from 'express-session';
import passport from 'passport';
import { Strategy } from 'passport-discord';
import path from 'path';
import { fileURLToPath } from 'url';
import { EmbedBuilder, PermissionsBitField } from 'discord.js';
import { promises as fsPromises } from 'fs';

import { client } from './client.js';

// Import commandes
import { musiqueCommandes, musiqueHelp } from './commandes/musique.js';
import { moderationCommands, moderationHelp } from './commandes/moderation.js';
import { autoReacts, AutoFeaturesCommands, AutoReactsAndReplies, autoHelp } from './commandes/auto.js';
import { saveJson } from './utils.js';
import { handleOthersCommand, handleButtonInteraction, helpFields } from './commandes/autre.js';

// DisTube avec plugin yt-dlp
export const distube = new DisTube(client, {
  plugins: [new YtDlpPlugin()],
  emitNewSongOnly: true,
});


distube.on("playSong", (queue, song) => {
  console.log(`Lecture de : ${song.name} - ${song.formattedDuration}`);
});

distube.on("error", (channel, error) => {
  console.error(`Erreur DisTube: ${error}`);
});

distube.on("finish", queue => {
  console.log("File d'attente terminée");
});


// Gestion interaction boutons (SONDAGES + LANGUES) - UN seul listener
client.on('interactionCreate', async interaction => {
  if (!interaction.isButton()) return;

  try {
    await handleButtonInteraction(interaction);
  } catch (error) {
    console.error('Erreur dans handleButtonInteraction:', error);
  }
});

// __dirname pour module ES
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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


async function saveGuildSettings(guildId, settings) {
  const settingsPath = path.join(__dirname, 'data', 'guildSettings.json');
  const currentSettings = await loadJson(settingsPath);

  // Normalisation des données
  const normalizedSettings = {
    prefix: typeof settings.prefix === 'string' ? settings.prefix.trim() : '!',
    welcomeEnabled: settings.welcomeEnabled === true,
    welcomeMessage: typeof settings.welcomeMessage === 'string' ? settings.welcomeMessage.trim() : '',
    goodbyeEnabled: settings.goodbyeEnabled === true,
    goodbyeMessage: typeof settings.goodbyeMessage === 'string' ? settings.goodbyeMessage.trim() : '',
    welcomeChannel: typeof settings.welcomeChannel === 'string' ? settings.welcomeChannel.trim() : '',
    langueRoles: {
      fr: settings.langueRoles?.fr?.trim?.() || '',
      en: settings.langueRoles?.en?.trim?.() || '',
      es: settings.langueRoles?.es?.trim?.() || '',
      de: settings.langueRoles?.de?.trim?.() || '',
      pt: settings.langueRoles?.pt?.trim?.() || '',
      ru: settings.langueRoles?.ru?.trim?.() || '',
      hu: settings.langueRoles?.hu?.trim?.() || ''
    }
  };

  currentSettings[guildId] = normalizedSettings;
  console.log(`Mise à jour des paramètres pour le serveur ${guildId} :`, normalizedSettings);
  await saveJson(settingsPath, currentSettings);
}


// Connexion client Discord
client.login(token).catch(err => console.error('Erreur de connexion avec le token :', err));

client.once('ready', () => {
  console.log(`🤖 Bot connecté en tant que ${client.user.tag}`);
  client.user.setActivity('!help', { type: 'LISTENING' });
});

// Fonction pour ajouter plusieurs réactions à un message
async function addReactions(message, emojis) {
  try {
    await message.reactions.removeAll();
    await Promise.all(emojis.map(emoji => message.react(emoji)));
  } catch (err) {
    console.error('Erreur lors de l\'ajout des réactions :', err);
  }
}

// Middleware d'authentification Express
function isAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect('/login');
}

// Listener unique pour les messages Discord
async function getGuildSettings(guildId) {
  const settingsPath = path.join(__dirname, 'data', 'guildSettings.json');
  const guildSettings = await loadJson(settingsPath);
  return guildSettings[guildId] || {};
}

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;

  // On attend la récupération des paramètres du serveur
  const guildSettings = await getGuildSettings(message.guild.id);

  // Si prefix non défini, on prend '!' par défaut
  const prefix = guildSettings.prefix || '!';

  // Réactions automatiques et réponses automatiques
  try {
    AutoReactsAndReplies(message);
  } catch (error) {
    console.error('Erreur AutoReactsAndReplies:', error);
  }

  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  try {
    // Modules commandes
    AutoFeaturesCommands(command, message, args);
    moderationCommands(command, message, args);
    handleOthersCommand(command, message, args); // poll et closepoll
    musiqueCommandes(command, message, args);

    // Commande help
    if (command === 'help') {
      const helpEmbed = new EmbedBuilder()
        .setTitle('📖 Commandes disponibles')
        .setColor('#0099ff')
        .addFields(
          musiqueHelp,
          ...moderationHelp,
          autoHelp,
          ...helpFields,
        );
      await message.reply({ embeds: [helpEmbed] });
    }
  } catch (err) {
    console.error('Erreur dans le traitement de la commande:', err);
  }
});


// Express setup
const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

passport.use(new Strategy({
  clientID: clientId,
  clientSecret: clientSecret,
  callbackURL: process.env.CALLBACK_URL,
  scope: ['identify', 'guilds']
}, (accessToken, refreshToken, profile, done) => {
  process.nextTick(() => done(null, profile));
}));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// Routes Express

app.get('/login', passport.authenticate('discord'));

app.get('/auth/discord/callback',
  passport.authenticate('discord', { failureRedirect: '/' }),
  (req, res) => {
    console.log('Utilisateur connecté :', req.user.username);
    res.redirect('/');
  }
);

app.get('/logout', (req, res, next) => {
  req.logout(function(err) {
    if (err) { 
      console.error('Erreur logout:', err);
      return next(err);
    }
    res.redirect('/');
  });
});

app.get('/', isAuthenticated, async (req, res) => {
  const ADMIN = BigInt(PermissionsBitField.Flags.Administrator);
  const guilds = req.user.guilds.filter(guild =>
    (BigInt(guild.permissions) & ADMIN) === ADMIN &&
    client.guilds.cache.has(guild.id)
  );
  res.render('index', { user: req.user, guilds });
});

app.get('/server/:id', isAuthenticated, async (req, res) => {
  const guildId = req.params.id;

  if (!client.guilds.cache.has(guildId)) return res.redirect('/');

  // Vérifie que l'utilisateur a accès au serveur avec permissions admin
  const userGuild = req.user.guilds.find(g => g.id === guildId);
  const ADMIN = BigInt(PermissionsBitField.Flags.Administrator);
  if (!userGuild || (BigInt(userGuild.permissions) & ADMIN) !== ADMIN) {
    return res.redirect('/');
  }

  const guild = client.guilds.cache.get(guildId);
  const guildSettings = await getGuildSettings(guildId);

  // Récupère les salons texte valides (exclut les salons vocaux, stage, etc.)
  const channels = guild.channels.cache
    .filter(channel =>
      channel.isTextBased() &&
      channel.type !== 13 && // exclude THREAD_NEWS
      channel.type !== 4     // exclude CATEGORY
    )
    .sort((a, b) => a.position - b.position)
    .map(channel => ({ id: channel.id, name: channel.name }));

  res.render('dashboard-server', {
    user: req.user,
    guild,
    settings: guildSettings,
    channels
  });
});


app.post('/server/:id/update', isAuthenticated, async (req, res) => {
  const guildId = req.params.id;

  // Vérifie que le bot est bien sur le serveur
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return res.redirect('/');

  // Vérifie que l'utilisateur a les droits d'admin sur ce serveur
  const ADMIN = BigInt(PermissionsBitField.Flags.Administrator);
  const userGuild = req.user.guilds.find(g => g.id === guildId);
  if (!userGuild || (BigInt(userGuild.permissions) & ADMIN) !== ADMIN) {
    return res.status(403).send('Accès refusé');
  }

  // Récupère les données du formulaire avec fallback et nettoyage
  const {
    prefix = '',
    welcomeEnabled,
    welcomeMessage = '',
    goodbyeEnabled,
    goodbyeMessage = '',
    welcomeChannel = '',
    lang_fr = '',
    lang_en = '',
    lang_es = '',
    lang_de = '',
    lang_pt = '',
    lang_ru = '',
    lang_hu = ''
  } = req.body;

  // Construit l'objet mis à jour
  const updatedSettings = {
    prefix: prefix.trim() || '!',
    welcomeEnabled: welcomeEnabled === 'true',
    welcomeMessage: welcomeMessage.trim(),
    goodbyeEnabled: goodbyeEnabled === 'true',
    goodbyeMessage: goodbyeMessage.trim(),
    welcomeChannel: welcomeChannel.trim(),
    langueRoles: {
      fr: lang_fr.trim(),
      en: lang_en.trim(),
      es: lang_es.trim(),
      de: lang_de.trim(),
      pt: lang_pt.trim(),
      ru: lang_ru.trim(),
      hu: lang_hu.trim()
    }
  };

  try {
    // Sauvegarde
    await saveGuildSettings(guildId, updatedSettings);
    // Tu peux ici ajouter un message flash ou un log si besoin
  } catch (error) {
    console.error('Erreur lors de la sauvegarde des paramètres :', error);
    // Gestion d’erreur optionnelle (ex: res.status(500).send(...))
  }

  // Redirection
  res.redirect(`/server/${guildId}`);
});

client.on('guildMemberAdd', async (member) => {
  const guildId = member.guild.id;
  const settings = await getGuildSettings(guildId);
  if (!settings.welcomeEnabled) return;
  if (!settings.welcomeChannel) return;

  const channel = member.guild.channels.cache.get(settings.welcomeChannel);
  if (!channel || !channel.isTextBased()) return;

  let msg = settings.welcomeMessage || 'Bienvenue {user} !';
  msg = msg.replace(/{user}/g, `<@${member.id}>`)
           .replace(/{username}/g, member.user.username);

  try {
    await channel.send(msg);
  } catch (err) {
    console.error('Erreur en envoyant le message de bienvenue :', err);
  }
});

client.on('guildMemberRemove', async (member) => {
  const guildId = member.guild.id;
  const settings = await getGuildSettings(guildId);
  if (!settings.goodbyeEnabled) return;
  if (!settings.welcomeChannel) return; // Tu peux décider d'avoir un autre channel goodbyeChannel si tu veux

  const channel = member.guild.channels.cache.get(settings.welcomeChannel);
  if (!channel || !channel.isTextBased()) return;

  let msg = settings.goodbyeMessage || 'Au revoir {user} !';
  msg = msg.replace(/{user}/g, `<@${member.id}>`)
           .replace(/{username}/g, member.user.username);

  try {
    await channel.send(msg);
  } catch (err) {
    console.error('Erreur en envoyant le message d\'au revoir :', err);
  }
});



app.listen(3000, '0.0.0.0', () => {
  console.log("Serveur lancé sur le port 3000");
});

