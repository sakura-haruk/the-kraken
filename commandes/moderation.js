// commands/moderation.js
import ms from 'ms';
import { PermissionsBitField, ChannelType } from 'discord.js';

const warns = new Map();


export const moderationHelp = [{
  name: '🔨 Modération/Sanction',
  value:
    '`[prefix]mute @user` — Mute un utilisateur\n' +
    '`[prefix]unmute @user` — Unmute un utilisateur\n' +
    '`[prefix]tempmute @user [durée]` — Mute temporairement (ex: [prefix]tempmute @user 10m)\n' +
    '`[prefix]ban @user [raison]` — Banni un utilisateur (ex: [prefix]ban @user Raison)\n' +
    '`[prefix]listwarn @user` — Liste les avertissements d\'un utilisateur (ex: [prefix]listwarn @user)\n' +
    '`[prefix]kick @user [raison]` — Expulse un utilisateur (ex: [prefix]kick @user Raison)\n' +
    '`[prefix]unban [userId]` — Débanni un utilisateur (ex: [prefix]unban 123456789012345678)\n' +
    '`[prefix]warn @user [raison]` — Avertit un utilisateur (ex: [prefix]warn @user Raison)\n' +
    '`[prefix]unwarn @user` — Retire un avertissement à un utilisateur\n'
  },
{
  name: '🔨 Modération/Gestion',
  value:
    '`[prefix]clear [nombre]` — Supprime un certain nombre de messages (ex: [prefix]clear 10)\n' +
    '`[prefix]lock` — Verrouille le salon (interdit l\'envoi de messages)\n' +
    '`[prefix]unlock` — Déverrouille le salon (autorise l\'envoi de messages)\n' +
    '`[prefix]slowmode [durée]` — Définit le mode lent (ex: [prefix]slowmode 10s)\n' +
    '`[prefix]lockall` — Verrouille tous les salons\n' +
    '`[prefix]unlockall` — Déverrouille tous les salons\n' +
    '`[prefix]vider-salon` — Supprime le salon et le recrée à l\'identique'
}];


export async function moderationCommands(command, message, args){

    // MUTE
    if (command === 'mute') {
      const member = message.mentions.members.first();
      const reason = args.slice(1).join(' ') || 'Aucune raison fournie';

      if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return message.reply("Tu n'as pas la permission.");
      if (!member) return message.reply('Mentionne un membre.');
      if (!member.moderatable) return message.reply('Je ne peux pas mute ce membre.');

      await member.timeout(60 * 60 * 1000, reason);
      message.channel.send(`${member} a été mute pour 1 heure. Raison: ${reason}`);
    }

    // TEMPMUTE
    if (command === 'tempmute') {
      const member = message.mentions.members.first();
      const time = args[1];
      const reason = args.slice(2).join(' ') || 'Aucune raison fournie';

      if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return message.reply("Tu n'as pas la permission.");
      if (!member || !time) return message.reply('Usage : !tempmute @membre durée raison');
      if (!member.moderatable) return message.reply('Je ne peux pas mute ce membre.');

      await member.timeout(ms(time), reason);
      message.channel.send(`${member} a été temporairement mute pendant ${time}. Raison: ${reason}`);
    }

    // UNMUTE
    if (command === 'unmute') {
      const member = message.mentions.members.first();
      if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return message.reply("Tu n'as pas la permission.");
      if (!member || !member.isCommunicationDisabled()) return message.reply("Ce membre n'est pas mute.");

      await member.timeout(null);
      message.channel.send(`${member} a été unmute.`);
    }

    // BAN
    if (command === 'ban') {
      const member = message.mentions.members.first();
      const reason = args.slice(1).join(' ') || 'Aucune raison fournie';

      if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) return message.reply("Tu n'as pas la permission.");
      if (!member || !member.bannable) return message.reply('Je ne peux pas bannir ce membre.');

      await member.ban({ reason });
      message.channel.send(`${member.user.tag} a été banni. Raison: ${reason}`);
    }

    // UNBAN
    if (command === 'unban') {
      const userId = args[0];
      if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) return message.reply("Tu n'as pas la permission.");
      if (!userId) return message.reply('Fournis un ID à débannir.');

      try {
        await message.guild.bans.remove(userId);
        message.channel.send(`L'utilisateur ${userId} a été débanni.`);
      } catch {
        message.reply("L'utilisateur n'est pas banni ou l'ID est invalide.");
      }
    }

    // KICK
    if (command === 'kick') {
      const member = message.mentions.members.first();
      const reason = args.slice(1).join(' ') || 'Aucune raison fournie';

      if (!message.member.permissions.has(PermissionsBitField.Flags.KickMembers)) return message.reply("Tu n'as pas la permission.");
      if (!member || !member.kickable) return message.reply('Je ne peux pas expulser ce membre.');

      await member.kick(reason);
      message.channel.send(`${member.user.tag} a été expulsé. Raison: ${reason}`);
    }

    // CLEAR
    if (command === 'clear') {
      const amount = parseInt(args[0], 10);
      if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) return message.reply("Tu n'as pas la permission.");
      if (isNaN(amount) || amount < 1 || amount > 100) return message.reply('Entre un nombre entre 1 et 100.');

      await message.channel.bulkDelete(amount, true);
      message.channel.send(`🧹 ${amount} messages supprimés.`).then(msg => setTimeout(() => msg.delete(), 3000));
    }

    // WARN
    if (command === 'warn') {
      const user = message.mentions.users.first();
      const reason = args.slice(1).join(' ') || 'Aucune raison fournie';

      if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return message.reply("Tu n'as pas la permission.");
      if (!user) return message.reply('Mentionne un utilisateur.');

      const key = `${message.guild.id}-${user.id}`;
      const userWarns = warns.get(key) || [];
      userWarns.push({ reason, date: new Date() });
      warns.set(key, userWarns);

      message.channel.send(`${user.tag} a été averti. Raison: ${reason}`);
    }

    // UNWARN
    if (command === 'unwarn') {
      const user = message.mentions.users.first();
      if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return message.reply("Tu n'as pas la permission.");
      if (!user) return message.reply('Mentionne un utilisateur.');

      const key = `${message.guild.id}-${user.id}`;
      warns.delete(key);

      message.channel.send(`Tous les avertissements pour ${user.tag} ont été retirés.`);
    }

    // LISTWARN
    if (command === 'listwarn') {
      const user = message.mentions.users.first();
      if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return message.reply("Tu n'as pas la permission.");
      if (!user) return message.reply('Mentionne un utilisateur.');

      const key = `${message.guild.id}-${user.id}`;
      const userWarns = warns.get(key);

      if (!userWarns || userWarns.length === 0) return message.reply(`${user.tag} n'a aucun avertissement.`);

      const warnList = userWarns.map((w, i) => `${i + 1}. ${w.reason} - ${w.date.toLocaleString()}`).join('\n');
      message.channel.send(`Avertissements pour ${user.tag} :\n${warnList}`);
    }

    // LOCK / UNLOCK
    if (command === 'lock') {
      if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) return message.reply("Tu n'as pas la permission.");
      await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false });
      message.channel.send('🔒 Ce salon est verrouillé.');
    }

    if (command === 'unlock') {
      if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) return message.reply("Tu n'as pas la permission.");
      await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: true });
      message.channel.send('🔓 Ce salon est déverrouillé.');
    }

    // LOCKALL / UNLOCKALL
    if (command === 'lockall') {
      if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) return message.reply("Tu n'as pas la permission.");
      message.guild.channels.cache.forEach(c => {
        if (c.isTextBased() && c.permissionsFor(message.guild.roles.everyone).has(PermissionsBitField.Flags.SendMessages)) {
          c.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false }).catch(() => {});
        }
      });
      message.channel.send('🔒 Tous les salons ont été verrouillés.');
    }

    if (command === 'unlockall') {
      if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) return message.reply("Tu n'as pas la permission.");
      message.guild.channels.cache.forEach(c => {
        if (c.isTextBased()) {
          c.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: true }).catch(() => {});
        }
      });
      message.channel.send('🔓 Tous les salons ont été déverrouillés.');
    }

if (command === 'vider-salon') {
  if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) 
    return message.reply("Tu n'as pas la permission.");

  try {
    const channel = message.channel;

    // Sauvegarde des propriétés du salon
    const {
      name: channelName,
      type: channelType,
      position: channelPosition,
      topic: channelTopic = '',
      nsfw: channelNsfw = false,
      rateLimitPerUser: channelRateLimitPerUser = 0,
      parentId
    } = channel;

    // Sauvegarde des permissions (format brut : bitfields)
    const overwrites = channel.permissionOverwrites.cache.map(overwrite => ({
      id: overwrite.id,
      type: overwrite.type,
      allow: overwrite.allow.bitfield,
      deny: overwrite.deny.bitfield
    }));

    // Message de confirmation
    await message.reply("🔄 Suppression et recréation du salon en cours...");

    // Création du nouveau salon AVEC les permissions d'origine
    const newChannel = await message.guild.channels.create({
      name: channelName,
      type: channelType,
      topic: channelTopic,
      nsfw: channelNsfw,
      rateLimitPerUser: channelRateLimitPerUser,
      parent: parentId,
      permissionOverwrites: overwrites, // ← Permissions appliquées ici
      reason: "Commande vider-salon"
    });

    // Répositionner le salon
    try {
      await newChannel.setPosition(channelPosition);
    } catch (e) {
      console.error("Erreur lors du positionnement du salon:", e);
    }

    // Message de confirmation
    await newChannel.send('✅ Salon vidé avec succès !');

    // Suppression de l'ancien salon
    setTimeout(async () => {
      try {
        await channel.delete("Commande vider-salon");
      } catch (e) {
        console.error("Erreur suppression salon:", e);
        await newChannel.send("⚠️ Impossible de supprimer l'ancien salon.");
      }
    }, 1000);

  } catch (error) {
    console.error("Erreur vider-salon:", error);
    message.reply("❌ Une erreur est survenue : " + error.message);
  }
}


    // SLOWMODE
    if (command === 'slowmode') {
      const seconds = parseInt(args[0], 10);
      if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) return message.reply("Tu n'as pas la permission.");
      if (isNaN(seconds) || seconds < 0 || seconds > 21600) return message.reply('Entre une durée valide entre 0 et 21600 secondes.');

      await message.channel.setRateLimitPerUser(seconds);
      if (seconds === 0) {
        message.channel.send('🕒 Mode lent désactivé.');
      } else {
        message.channel.send(`🕒 Mode lent défini à ${seconds} secondes.`);
      }
    }
};