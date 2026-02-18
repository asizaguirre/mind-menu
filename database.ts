import mongoose from 'mongoose';

export const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('A variável de ambiente MONGO_URI não foi definida.');
    }
    await mongoose.connect(mongoUri);
    console.log('📦 Banco de dados MongoDB conectado com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao conectar ao MongoDB:', error);
    process.exit(1);
  }
};

// Não precisamos mais exportar a instância do Prisma
// export default prisma;