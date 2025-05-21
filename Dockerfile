FROM node:18-alpine

# Installer les dépendances système nécessaires
RUN apk add --no-cache ffmpeg curl python3 py3-pip make g++ 

# Installer yt-dlp via apk
RUN apk add --no-cache yt-dlp

# Créer dossier app
WORKDIR /app

# Copier package.json et package-lock.json (si tu as)
COPY package*.json ./

# Installer les dépendances Node.js
RUN npm install

# Copier tout le code
COPY . .

# Exposer le port pour Express
EXPOSE 3000

# Démarrer le bot
CMD ["node", "index.js"]
