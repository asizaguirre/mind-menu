# Usando Node.js LTS
FROM node:18

# Diretório de trabalho
WORKDIR /restaurant

# Copiar dependências
COPY package*.json ./
RUN npm install

# Copiar código
COPY . .

# Variáveis de ambiente (Railway irá injetar)
ENV PORT=4000

# Expor porta
EXPOSE 4000

# Comando de inicialização
CMD ["npm", "start"]