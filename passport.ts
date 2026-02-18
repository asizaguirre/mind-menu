import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';

// Interface para o perfil do usuário (pode ser movida para um arquivo de tipos)
interface UserProfile {
  id: string;
  displayName: string;
  emails?: { value: string }[];
}

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID as string,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
  callbackURL: process.env.GOOGLE_CALLBACK_URL || "/auth/google/callback"
}, async (accessToken, refreshToken, profile, done) => {
  try {
    // AQUI: Implemente a lógica para buscar ou criar o usuário no seu banco de dados
    // Exemplo:
    // const user = await prisma.user.upsert({ ... });
    
    console.log("Google Profile:", profile.displayName);
    
    // Retorna o perfil do usuário para a sessão
    return done(null, profile);
  } catch (error) {
    return done(error, false);
  }
}));

passport.serializeUser((user: any, done) => {
  done(null, user);
});

passport.deserializeUser((user: any, done) => {
  done(null, user);
});

export default passport;