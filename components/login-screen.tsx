import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  GraduationCap, 
  Mail, 
  Lock, 
  User, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  Loader2, 
  Check, 
  Sparkles,
  ArrowRight,
  ExternalLink,
  AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, signInWithGoogle } from '@/lib/firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile
} from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';

export function LoginScreen() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  
  // Field States
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Interaction States
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isOperationNotAllowed, setIsOperationNotAllowed] = useState(false);

  const projectId = firebaseConfig?.projectId || 'gen-lang-client-0769903786';

  // Error translating from Firebase exceptions to user friendly Portuguese
  const translateAuthError = (code: string) => {
    switch (code) {
      case 'auth/email-already-in-use':
        return 'Este endereço de e-mail já está em utilização por outra conta.';
      case 'auth/invalid-email':
        return 'O endereço de e-mail inserido não é válido.';
      case 'auth/user-disabled':
        return 'Esta conta de utilizador foi desativada temporária ou permanentemente.';
      case 'auth/user-not-found':
        return 'Não encontramos nenhuma conta registada com este e-mail.';
      case 'auth/wrong-password':
        return 'A palavra-passe inserida está incorreta. Tente novamente.';
      case 'auth/invalid-credential':
        return 'E-mail ou palavra-passe incorretos. Por favor, verifique os seus dados.';
      case 'auth/weak-password':
        return 'A palavra-passe deve ser mais forte e ter pelo menos 6 caracteres.';
      case 'auth/network-request-failed':
        return 'Falha de rede. Verifique a sua ligação à Internet.';
      case 'auth/too-many-requests':
        return 'Acesso bloqueado temporariamente devido a tentativas consecutivas falhadas. Aguarde um momento.';
      case 'auth/operation-not-allowed':
        return 'O método de início de sessão por E-mail e Palavra-passe não está ativo na consola do Firebase. Por favor, ative-o nas definições do Firebase.';
      default:
        return 'Ocorreu um erro ao processar o seu pedido. Por favor, verifique e tente novamente.';
    }
  };

  const cleanStates = () => {
    setName('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsOperationNotAllowed(false);
  };

  const handleModeSwitch = (newMode: 'login' | 'register') => {
    cleanStates();
    setMode(newMode);
  };

  const handleEmailAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsOperationNotAllowed(false);

    // Initial validations
    if (!email || !password) {
      setErrorMessage('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    if (mode === 'register') {
      if (!name.trim()) {
        setErrorMessage('Por favor, indique o seu nome completo para o perfil.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage('As palavras-passes digitadas não coincidem.');
        return;
      }
      if (password.length < 6) {
        setErrorMessage('A palavra-passe deve conter pelo menos 6 caracteres.');
        return;
      }
    }

    setIsLoading(true);

    try {
      if (mode === 'login') {
        // Sign In
        await signInWithEmailAndPassword(auth, email.trim(), password);
      } else {
        // Sign Up / Register
        const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        
        // Write Name on Profile metadata immediately (failsafe wrapper)
        if (userCredential.user) {
          try {
            await updateProfile(userCredential.user, {
              displayName: name.trim()
            });
            // Reload the user profile locally to apply changes
            await userCredential.user.reload();
          } catch (profileErr) {
            console.error("Erro secundário ao salvar o nome de perfil:", profileErr);
          }
        }
        
        setSuccessMessage('Conta criada com sucesso! A carregar a sua sessão...');
      }
    } catch (err: any) {
      console.error("Authentication action failed: ", err);
      if (err?.code === 'auth/operation-not-allowed') {
        setIsOperationNotAllowed(true);
      }
      setErrorMessage(translateAuthError(err.code));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      console.error("Google authentication action failed: ", err);
      setErrorMessage(translateAuthError(err?.code || ''));
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-background p-4 overflow-hidden select-none font-sans">
      {/* Dynamic ambient lighting bubbles for beautiful UI depth */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-primary/8 dark:bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-purple-500/8 dark:bg-purple-500/5 rounded-full blur-[100px] pointer-events-none" />
      
      {/* Decorative subtle grid background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(120,119,198,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(120,119,198,0.03)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-md z-10"
      >
        <Card className="border-border/60 bg-card/80 backdrop-blur-xl shadow-2xl relative overflow-hidden ring-1 ring-black/5 dark:ring-white/5 rounded-2xl">
          {/* Card Top Glow Decorative Accent */}
          <div className="h-1.5 w-full bg-gradient-to-r from-primary via-purple-500 to-indigo-500 absolute top-0 left-0" />

          <CardHeader className="text-center pt-8 pb-5 px-6 space-y-3">
            <div className="mx-auto bg-primary/10 dark:bg-primary/10 w-16 h-16 rounded-2xl flex items-center justify-center shadow-inner relative group border border-primary/20 transition-all duration-300 hover:scale-105">
              <div className="absolute inset-0 bg-primary/5 rounded-2xl scale-0 group-hover:scale-100 transition-transform duration-300" />
              <GraduationCap className="h-8 w-8 text-primary animate-pulse" />
            </div>
            
            <div className="space-y-1">
              <CardTitle className="text-3xl font-extrabold tracking-tight text-foreground flex items-center justify-center gap-1.5">
                EduGestão
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground max-w-xs mx-auto">
                A plataforma moderna para gerir as suas turmas, estudantes e pautas de avaliação.
              </CardDescription>
            </div>

            {/* Premium Animated Tab Selector */}
            <div className="p-1 bg-muted/60 dark:bg-muted/30 rounded-xl grid grid-cols-2 gap-1 text-xs font-semibold relative mt-4 border border-border/20">
              <button 
                type="button"
                onClick={() => handleModeSwitch('login')}
                className={`py-2.5 px-3 rounded-lg text-center cursor-pointer relative transition-all duration-300 z-10 ${
                  mode === 'login' 
                    ? 'text-primary-foreground font-bold' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {mode === 'login' && (
                  <motion.div 
                    layoutId="active-tab-bg"
                    className="absolute inset-0 bg-primary rounded-lg -z-10 shadow-sm"
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  />
                )}
                Iniciar Sessão
              </button>
              <button 
                type="button"
                onClick={() => handleModeSwitch('register')}
                className={`py-2.5 px-3 rounded-lg text-center cursor-pointer relative transition-all duration-300 z-10 ${
                  mode === 'register' 
                    ? 'text-primary-foreground font-bold' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {mode === 'register' && (
                  <motion.div 
                    layoutId="active-tab-bg"
                    className="absolute inset-0 bg-primary rounded-lg -z-10 shadow-sm"
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  />
                )}
                Criar Conta
              </button>
            </div>
          </CardHeader>

          <CardContent className="px-6 pb-6 pt-1 space-y-4">
            
            {/* Animated Feedback Boxes */}
            <AnimatePresence mode="wait">
              {errorMessage && (
                <motion.div 
                  initial={{ opacity: 0, height: 0, y: -5 }}
                  animate={{ opacity: 1, height: 'auto', y: 0 }}
                  exit={{ opacity: 0, height: 0, y: -5 }}
                  className="bg-red-500/10 dark:bg-red-500/5 text-red-600 dark:text-red-400 p-4 rounded-xl border border-red-500/20 text-xs font-medium flex flex-col gap-3"
                >
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5 text-red-500" />
                    <p className="leading-relaxed flex-1 font-semibold">{errorMessage}</p>
                  </div>

                  {isOperationNotAllowed && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-background/90 dark:bg-background/40 p-3.5 rounded-lg border border-red-500/20 space-y-3"
                    >
                      <div className="space-y-2 text-muted-foreground leading-relaxed text-[11px] font-normal">
                        <span className="text-foreground font-bold flex items-center gap-1.5 text-xs text-red-500 dark:text-red-400">
                          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500 animate-bounce" /> 
                          Como Ativar E-mail/Senha no Firebase:
                        </span>
                        <ol className="list-decimal pl-4.5 space-y-1 text-muted-foreground">
                          <li>Abra a consola do seu projeto clicando no botão abaixo.</li>
                          <li>Clique em <strong className="text-foreground">"Adicionar novo fornecedor"</strong> e escolha <strong className="text-foreground">"Correio eletrónico/Palavra-passe"</strong>.</li>
                          <li>Ative o primeiro comutador (E-mail/senha) e guarde.</li>
                          <li>Depois disso, volte para aqui e o registo funcionará instantaneamente!</li>
                        </ol>
                      </div>
                      <a 
                        href={`https://console.firebase.google.com/project/${projectId}/authentication/providers`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center gap-1.5 w-full py-2 px-3 rounded-lg text-xs font-extrabold bg-primary hover:bg-primary/95 text-primary-foreground transition-all duration-300 shadow-md cursor-pointer mt-1 hover:shadow-primary/10"
                      >
                        <span>Ir para o Firebase Console</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </motion.div>
                  )}
                </motion.div>
              )}

              {successMessage && (
                <motion.div 
                  initial={{ opacity: 0, height: 0, y: -5 }}
                  animate={{ opacity: 1, height: 'auto', y: 0 }}
                  exit={{ opacity: 0, height: 0, y: -5 }}
                  className="bg-green-500/10 dark:bg-green-500/5 text-green-600 dark:text-green-400 p-3 rounded-xl border border-green-500/20 text-xs font-medium flex items-center gap-2.5"
                >
                  <Check className="h-4 w-4 shrink-0" />
                  <p className="leading-relaxed flex-1">{successMessage}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Email & Password Form */}
            <form onSubmit={handleEmailAuthSubmit} className="space-y-3.5">
              <AnimatePresence initial={false} mode="popLayout">
                {mode === 'register' && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-1.5"
                  >
                    <Label htmlFor="fullname" className="text-xs font-bold text-foreground/85 flex items-center gap-1">
                      <Sparkles className="h-3 w-3 text-primary" /> Nome Completo
                    </Label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                      <Input 
                        id="fullname"
                        type="text"
                        placeholder="Ex: Prof. José Maria"
                        className="pl-10 h-11 border-border/60 hover:border-primary/40 focus-visible:ring-primary/20 bg-background/50"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        disabled={isLoading || isGoogleLoading}
                        required
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-bold text-foreground/85">E-mail de Trabalho</Label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                  <Input 
                    id="email"
                    type="email"
                    placeholder="nome@escola.ac.mz"
                    className="pl-10 h-11 border-border/60 hover:border-primary/40 focus-visible:ring-primary/20 bg-background/50"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading || isGoogleLoading}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-bold text-foreground/85">Palavra-passe</Label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                  <Input 
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Verifique os caracteres mínimos"
                    className="pl-10 pr-10 h-11 border-border/60 hover:border-primary/40 focus-visible:ring-primary/20 bg-background/50 font-sans"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading || isGoogleLoading}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/75 hover:text-foreground transition-colors cursor-pointer"
                    title={showPassword ? "Ocultar senha" : "Sinalizar senha"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <AnimatePresence initial={false} mode="popLayout">
                {mode === 'register' && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-1.5"
                  >
                    <Label htmlFor="confirmPassword" className="text-xs font-bold text-foreground/85">Confirmar Palavra-passe</Label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                      <Input 
                        id="confirmPassword"
                        type={showPassword ? "text" : "password"}
                        placeholder="Repita a palavra-passe"
                        className="pl-10 h-11 border-border/60 hover:border-primary/40 focus-visible:ring-primary/20 bg-background/50 font-sans"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        disabled={isLoading || isGoogleLoading}
                        required
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Action Button */}
              <Button 
                type="submit"
                size="lg" 
                className="w-full text-sm font-semibold h-11 bg-primary hover:bg-primary/95 text-primary-foreground transition-all duration-300 shadow-md cursor-pointer !mt-5 flex items-center justify-center gap-2 rounded-xl group"
                disabled={isLoading || isGoogleLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <span>{mode === 'login' ? 'Iniciar Sessão' : 'Submeter & Registar'}</span>
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </Button>
            </form>

            {/* Structured modern divider */}
            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-border/70"></div>
              <span className="flex-shrink mx-4 text-[10px] font-bold text-muted-foreground/80 uppercase tracking-widest leading-none">
                Usa outros métodos alternativos
              </span>
              <div className="flex-grow border-t border-border/70"></div>
            </div>

            {/* Google authentication with colorful branding */}
            <Button 
              type="button"
              variant="outline"
              size="lg" 
              className="w-full text-xs font-bold h-11 border-border/70 hover:bg-muted/30 focus-visible:ring-primary/20 transition-all duration-300 cursor-pointer flex items-center justify-center gap-2 rounded-xl text-foreground"
              onClick={handleGoogleAuth}
              disabled={isLoading || isGoogleLoading}
            >
              {isGoogleLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  {/* Google Custom Colorful SVG Paths: Red, Yellow, Green, Blue */}
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
              )}
              {isGoogleLoading ? 'A conectar...' : 'Continuar com o Google'}
            </Button>
          </CardContent>

          {/* Clean footer info */}
          <CardFooter className="pt-0 pb-6 px-6 justify-center">
            <p className="text-[10px] text-muted-foreground/75 leading-none text-center">
              Proteção de dados EduGestão &copy; {new Date().getFullYear()} — Moçambique
            </p>
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  );
}
