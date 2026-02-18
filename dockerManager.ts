import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';

export async function createRestaurantDockerImage(restaurantName: string): Promise<string> {
  // Define o caminho para criar a pasta do restaurante (ajuste conforme sua estrutura de pastas real)
  const folder = path.join(__dirname, `../../../restaurants/${restaurantName}`);
  const dockerfilePath = path.join(folder, 'Dockerfile');

  // Criar pasta do restaurante
  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder, { recursive: true });
  }

  // Criar Dockerfile básico
  const dockerfileContent = `
  FROM node:18
  WORKDIR /app
  COPY package*.json ./
  RUN npm install
  COPY . .
  ENV PORT=4000
  EXPOSE 4000
  CMD ["npm", "start"]
  `;

  fs.writeFileSync(dockerfilePath, dockerfileContent);

  // Executar build e push para Railway
  // Nota: O token deve estar disponível nas variáveis de ambiente como RAILWAY_TOKEN
  return new Promise((resolve, reject) => {
    const command = `cd ${folder} && docker build -t ${restaurantName}-service . && railway up --service=${restaurantName}-service --token ${process.env.RAILWAY_TOKEN}`;
    
    console.log(`[DockerManager] Executando: ${command}`);

    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`[DockerManager] Erro ao criar imagem Docker: ${error.message}`);
        return reject(error);
      }
      console.log(`[DockerManager] Output: ${stdout}`);
      resolve(stdout);
    });
  });
}