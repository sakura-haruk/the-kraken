import { DisTube } from 'distube';
import { YtDlpPlugin } from '@distube/yt-dlp';
import { client } from '../client.js';

// Aide musique
export const musiqueHelp = {
  name: '🎶 Musique',
  value:
    '`[prefix]play [nom/lien]` — Joue une musique\n' +
    '`[prefix]playlist [lien/nom]` — Joue une playlist\n' +
    '`[prefix]add [nom/lien]` — Ajoute une musique à la file d\'attente\n' +
    '`[prefix]skip` — Passe à la musique suivante\n' +
    '`[prefix]stop` — Arrête la musique\n' +
    '`[prefix]pause` / `[prefix]resume` — Pause/Reprend la musique\n' +
    '`[prefix]queue` — Affiche la file d\'attente\n' +
    '`[prefix]volume [0-100]` — Définit le volume\n' +
    '`[prefix]loop` — Active/Désactive la boucle\n' +
    '`[prefix]nowplaying` — Affiche la musique en cours'
};

// Initialisation DisTube
const distube = new DisTube(client, {
  emitNewSongOnly: true,
  emitAddListWhenCreatingQueue: true,
  plugins: [new YtDlpPlugin()]
});

distube.setMaxListeners(20);

// Événements DisTube
distube
  .on('playSong', (queue, song) => {
    console.log(`[playSong] ${song.name}`);
    try {
      queue.textChannel.send(`🎶 Maintenant en train de jouer : **${song.name}**`);
    } catch (error) {
      console.error("DisTube playSong error:", error);
    }
  })
  .on('addSong', (queue, song) => {
    console.log(`[addSong] ${song.name}`);
    try {
      queue.textChannel.send(`➕ **${song.name}** a été ajouté à la file.`);
    } catch (error) {
      console.error("DisTube addSong error:", error);
    }
  })
  .on('addList', (queue, playlist) => {
    console.log(`[addList] Playlist : ${playlist.name}, ${playlist.songs.length} musiques`);
    try {
      queue.textChannel.send(`📃 Playlist **${playlist.name}** ajoutée avec ${playlist.songs.length} musiques.`);
    } catch (error) {
      console.error("DisTube addList error:", error);
    }
  })
  .on('finish', queue => {
    console.log(`[finish] File terminée.`);
    try {
      queue.textChannel.send('✅ File terminée.');
    } catch (error) {
      console.error("DisTube finish error:", error);
    }
  })
  .on('error', (channel, error) => {
    console.error('Erreur DisTube :', error);
    if (channel?.send) {
      try {
        channel.send('❌ Une erreur est survenue : ' + error.message);
      } catch (sendError) {
        console.error("DisTube error handler send error:", sendError);
      }
    }
  });

export async function musiqueCommandes(command, message, args) {
  const voiceChannel = message.member?.voice.channel;

  if (!voiceChannel) return message.reply('🔊 Tu dois être dans un salon vocal !');

  const query = args.join(" ");
  const queue = distube.getQueue(message);

  switch (command) {
    case 'play':
      if (!query) return message.reply("❌ Tu dois fournir un lien ou une recherche.");
      try {
        console.log(`[Commande] play ${query}`);
        await distube.play(voiceChannel, query, {
          member: message.member,
          textChannel: message.channel,
        });
      } catch (error) {
        console.error("DisTube play command error:", error);
        message.reply("❌ Erreur lors de la lecture de la musique.");
      }
      break;

    case 'playlist':
      if (!query) return message.reply("❌ Tu dois fournir un lien ou un nom de playlist.");
      try {
        console.log(`[Commande] playlist ${query}`);
        await distube.play(voiceChannel, query, {
          member: message.member,
          textChannel: message.channel,
        });
      } catch (error) {
        console.error("DisTube playlist command error:", error);
        message.reply("❌ Impossible de lire cette playlist.");
      }
      break;

    case 'add':
      if (!query) return message.reply("❌ Tu dois fournir un lien ou une recherche.");
      try {
        console.log(`[Commande] add ${query}`);
        await distube.addToQueue(message.guild, query);
        message.reply(`🎶 **${query}** a été ajouté à la file d'attente.`);
      } catch (error) {
        console.error("DisTube add command error:", error);
        message.reply("❌ Erreur lors de l'ajout de la musique.");
      }
      break;

    case 'skip':
      if (!queue) return message.reply("❌ Aucune musique en cours.");
      try {
        await distube.skip(queue);
        message.reply('⏭️ Musique suivante...');
      } catch (error) {
        console.error("DisTube skip command error:", error);
        message.reply('❌ Aucune chanson à passer ou erreur lors du passage.');
      }
      break;

    case 'stop':
      if (!queue) return message.reply("❌ Aucune musique en cours.");
      try {
        await distube.stop(queue);
        message.reply('⏹️ Musique arrêtée.');
      } catch (error) {
        console.error("DisTube stop command error:", error);
        message.reply('❌ Impossible d’arrêter la musique.');
      }
      break;

    case 'pause':
      if (!queue) return message.reply("❌ Rien à mettre en pause.");
      try {
        await distube.pause(queue);
        message.reply('⏸️ Musique en pause.');
      } catch (error) {
        console.error("DisTube pause command error:", error);
        message.reply('❌ Erreur lors de la mise en pause.');
      }
      break;

    case 'resume':
      if (!queue) return message.reply("❌ Rien à reprendre.");
      try {
        await distube.resume(queue);
        message.reply('▶️ Musique reprise.');
      } catch (error) {
        console.error("DisTube resume command error:", error);
        message.reply('❌ Erreur lors de la reprise.');
      }
      break;

    case 'queue':
      if (!queue || !queue.songs.length) return message.reply("📭 La file est vide.");
      try {
        const songList = queue.songs
          .map((song, index) => `${index + 1}. ${song.name}`)
          .join("\n");
        message.reply(`📜 File d'attente :\n${songList}`);
      } catch (error) {
        console.error("DisTube queue command error:", error);
        message.reply("❌ Erreur lors de l'affichage de la file d'attente.");
      }
      break;

    case 'volume':
      const volume = parseInt(args[0]);
      if (isNaN(volume) || volume < 0 || volume > 100)
        return message.reply("📉 Volume entre 0 et 100.");
      if (!queue) return message.reply("❌ Rien n'est en lecture.");
      try {
        await distube.setVolume(queue, volume);
        message.reply(`🔊 Volume défini à ${volume}%.`);
      } catch (error) {
        console.error("DisTube volume command error:", error);
        message.reply("❌ Erreur lors du réglage du volume.");
      }
      break;

    case 'loop':
      if (!queue) return message.reply("❌ Aucune musique en cours.");
      try {
        const mode = distube.setRepeatMode(queue);
        message.reply(`🔁 Mode boucle : ${mode === 0 ? 'off' : mode === 1 ? 'chanson' : 'file'}`);
      } catch (error) {
        console.error("DisTube loop command error:", error);
        message.reply("❌ Erreur lors du réglage du mode de boucle.");
      }
      break;

    case 'nowplaying':
      if (!queue || !queue.songs.length) return message.reply("❌ Aucune musique n'est en cours.");
      try {
        message.reply(`🎧 En lecture : **${queue.songs[0].name}**`);
      } catch (error) {
        console.error("DisTube nowplaying command error:", error);
        message.reply("❌ Erreur lors de l'affichage de la musique en cours.");
      }
      break;
  }
}
