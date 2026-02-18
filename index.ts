import express from 'express';
import session from 'express-session';
import passport from './passport';
import { connectDB } from './database';
import authRoutes from './routes/auth';
import restaurantRoutes from './routes/restaurants';

const app = express();
const PORT = process.env.PORT || 3000;

// Configuração básica de sessão (necessária para o Passport)
app.use(session({
  secret: process.env.SESSION_SECRET || 'mind-menu-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production' } // Secure true em produção (HTTPS)
}));

// Inicialização do Passport
app.use(passport.initialize());
app.use(passport.session());

// Rotas
app.use('/auth', authRoutes);
app.use('/restaurants', restaurantRoutes);

app.get('/', (req, res) => {
  res.send('Mind-Menu Admin API is running 🚀');
});

// Inicialização do Servidor e Banco de Dados
const startServer = async () => {
  // Testa a conexão com o Postgres ao iniciar
  await connectDB();
  
  app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
  });
};

startServer();