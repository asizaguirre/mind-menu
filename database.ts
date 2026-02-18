import { PrismaClient } from '@prisma/client';

// Inicializa o Prisma Client
// O Prisma detecta automaticamente a variável DATABASE_URL no .env ou ambiente
const prisma = new PrismaClient();

export const connectDB = async () => {
  try {
    await prisma.$connect();
    console.log('📦 Banco de dados conectado com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao conectar ao banco de dados:', error);
    process.exit(1);
  }
};

export default prisma;