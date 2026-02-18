import { Router } from 'express';
import passport from 'passport';

const router = Router();

// Rota para iniciar o fluxo de login com Google
router.get('/google', passport.authenticate('google', {
  scope: ['profile', 'email']
}));

// Callback de retorno do Google
router.get('/google/callback', 
  passport.authenticate('google', { failureRedirect: '/auth/failure' }),
  (req, res) => {
    // Sucesso: Retorna os dados do usuário logado (para teste)
    res.json({
      status: 'success',
      message: 'Login com Google realizado com sucesso!',
      user: req.user
    });
  }
);

router.get('/failure', (req, res) => {
  res.status(401).json({ status: 'error', message: 'Falha na autenticação' });
});

export default router;