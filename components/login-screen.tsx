import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Mail, 
  Lock, 
  User, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  Loader2, 
  Check, 
  ArrowRight,
  ExternalLink,
  AlertTriangle,
  GraduationCap,
  Calendar,
  Users,
  FileSpreadsheet
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

  // Translating Firebase errors to European Portuguese (pt-PT)
  const translateAuthError = (code: string) => {
    switch (code) {
      case 'auth/email-already-in-use':
        return 'Este endereço de e-mail já está em utilização por outra conta.';
      case 'auth/invalid-email':
        return 'O endereço de e-mail inserido não é válido.';
      case 'auth/user-disabled':
        return 'Esta conta de utilizador foi desativada.';
      case 'auth/user-not-found':
        return 'Não foi encontrada nenhuma conta registada com este e-mail.';
      case 'auth/wrong-password':
        return 'A palavra-passe inserida está incorreta. Tente novamente.';
      case 'auth/invalid-credential':
        return 'E-mail ou palavra-passe incorretos. Por favor, verifique os seus dados.';
      case 'auth/weak-password':
        return 'A palavra-passe deve ter pelo menos 6 caracteres.';
      case 'auth/network-request-failed':
        return 'Falha de rede. Verifique a sua ligação à Internet.';
      case 'auth/too-many-requests':
        return 'Acesso bloqueado temporariamente por excesso de tentativas. Aguarde um momento.';
      case 'auth/operation-not-allowed':
        return 'O método de início de sessão por E-mail/Senha não está ativo na consola do Firebase.';
      default:
        return 'Ocorreu um erro ao processar o seu pedido. Por favor, tente novamente.';
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

    // Form inputs checks
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
        setErrorMessage('As palavras-passe introduzidas não coincidem.');
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
        await signInWithEmailAndPassword(auth, email.trim(), password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        
        if (userCredential.user) {
          try {
            await updateProfile(userCredential.user, {
              displayName: name.trim()
            });
            await userCredential.user.reload();
          } catch (profileErr) {
            console.error("Erro secundário ao guardar o nome de perfil:", profileErr);
          }
        }
        
        setSuccessMessage('Conta criada com sucesso! A carregar...');
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
    <div className="h-[100dvh] w-full flex bg-background text-foreground overflow-hidden font-sans select-none relative">
      {/* Dynamic Aurora Styling & Animations */}
      <style>{`
        @keyframes aurora1 {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(40px, -60px) scale(1.15); }
          66% { transform: translate(-30px, 30px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        @keyframes aurora2 {
          0% { transform: translate(0px, 0px) scale(1.05); }
          50% { transform: translate(-50px, 40px) scale(0.95); }
          100% { transform: translate(0px, 0px) scale(1.05); }
        }
        .animate-aurora-1 {
          animation: aurora1 12s infinite ease-in-out;
        }
        .animate-aurora-2 {
          animation: aurora2 15s infinite ease-in-out;
        }
      `}</style>

      {/* Background Soft Floating Animated Blobs (rely on primary color theme) */}
      <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-primary/8 dark:bg-primary/12 blur-[120px] pointer-events-none animate-aurora-1" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-primary/6 dark:bg-primary/10 blur-[130px] pointer-events-none animate-aurora-2" />

      {/* Split Layout 40% Left Panel, 60% Right Auth Panel */}
      <div className="flex w-full h-full">
        
        {/* DESKTOP LEFT PANEL (40% width, hidden on screens smaller than lg) */}
        <div className="hidden lg:flex lg:w-[40%] h-full bg-gradient-to-br from-card/35 via-card/75 to-card/25 dark:from-card/15 dark:via-card/30 dark:to-background relative overflow-hidden flex-col justify-between p-11 border-r border-border/40 z-10 shrink-0 select-none">
          {/* Subtle overlay grid */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(128,128,128,0.03)_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />
          
          {/* Top Logo Title */}
          <div className="flex items-center gap-2.5">
            <div className="bg-primary/10 dark:bg-primary/25 p-2 rounded-xl border border-primary/25 shadow-inner">
              <GraduationCap className="h-6 w-6 text-primary" />
            </div>
            <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-foreground via-foreground/90 to-primary bg-clip-text text-transparent">
              EduGestão
            </span>
          </div>

          {/* Central Illustration Info */}
          <div className="my-auto space-y-8 max-w-sm">
            <div className="relative inline-block">
              {/* Abstract decorative glowing graduation cap SVG */}
              <div className="w-15 h-15 rounded-2xl bg-gradient-to-tr from-primary to-primary/60 p-0.5 shadow-lg shadow-primary/10">
                <div className="w-full h-full bg-card rounded-[14px] flex items-center justify-center">
                  <GraduationCap className="h-8 w-8 text-primary" />
                </div>
              </div>
              <div className="absolute -inset-1 bg-primary/15 rounded-2xl blur-lg -z-10" />
            </div>

            <h2 className="text-3xl font-extrabold tracking-tight leading-tight text-foreground">
              Gerir turmas nunca foi tão simples.
            </h2>

            {/* Bullets */}
            <div className="space-y-4 text-foreground/80">
              <div className="flex items-start gap-4">
                <div className="mt-0.5 p-1.5 rounded-lg bg-card/60 border border-border/40">
                  <Calendar className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-foreground">Turmas Organizadas</h4>
                  <p className="text-xs text-muted-foreground">Gestão inteligente de horários e diários escolares.</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="mt-0.5 p-1.5 rounded-lg bg-card/60 border border-border/40">
                  <Users className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-foreground">Controlo de Estudantes</h4>
                  <p className="text-xs text-muted-foreground">Perfis completos com histórico e chamadas diárias.</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="mt-0.5 p-1.5 rounded-lg bg-card/60 border border-border/40">
                  <FileSpreadsheet className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-foreground">Lançamento de Pautas</h4>
                  <p className="text-xs text-muted-foreground">Notas e avaliações calculadas de forma instantânea.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Info */}
          <div className="text-[10px] text-muted-foreground/50 tracking-wider uppercase select-none">
            SISTEMA INTEGRADO DE AUTO-GESTÃO COMPATÍVEL COM O SISTEMA PORTUGUÊS DE ENSINO
          </div>
        </div>

        {/* RIGHT AUTH CARD PANEL (60% width, full width on mobile/tablet) */}
        <div className="w-full lg:w-[60%] h-full flex items-center justify-center p-3 sm:p-6 lg:p-12 relative overflow-hidden z-10">
          
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="w-full max-w-[420px] max-h-[95vh] sm:max-h-[90vh] flex flex-col justify-center"
          >
            {/* System Theme Adaptive Frosted Glass Card with absolute zero vertical overflow */}
            <Card 
              id="auth-main-card"
              className="border-border/60 bg-card/75 dark:bg-card/45 backdrop-blur-[20px] shadow-2xl relative overflow-hidden rounded-[24px] flex flex-col justify-between py-5 px-5 sm:px-6 max-h-full"
            >
              {/* Premium Top Multi-Gradient Line Accent */}
              <div className="h-[3px] w-full bg-gradient-to-r from-[#a855f7] via-[#6366f1] to-[#06b6d4] absolute top-0 left-0" />

              {/* Title Header with constrained vertical spacing */}
              <div className="text-center space-y-1 mb-2.5">
                <h1 className="text-[clamp(1.60rem,3.2vw,1.90rem)] font-extrabold tracking-tight text-foreground flex items-center justify-center gap-1.5">
                  EduGestão
                </h1>
                <p className="text-[0.75rem] text-muted-foreground/80 leading-normal max-w-[280px] mx-auto line-clamp-2">
                  A plataforma moderna para gerir as suas turmas, estudantes e pautas de avaliação.
                </p>
              </div>

              {/* Tab Switcher - Rounded Compact Pill */}
              <div className="p-1 bg-muted/40 border border-border/50 rounded-full grid grid-cols-2 gap-1 text-[0.80rem] font-bold relative mb-3 max-w-[340px] mx-auto w-full shrink-0 select-none">
                <button 
                  type="button"
                  onClick={() => handleModeSwitch('login')}
                  className={`py-1 px-3 rounded-full text-center cursor-pointer relative transition-all duration-300 z-10 w-full ${
                    mode === 'login' 
                      ? 'text-primary-foreground' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {mode === 'login' && (
                    <motion.div 
                      layoutId="active-pill-bg"
                      className="absolute inset-0 bg-primary rounded-full -z-10 shadow-md"
                      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                    />
                  )}
                  Iniciar Sessão
                </button>
                <button 
                  type="button"
                  onClick={() => handleModeSwitch('register')}
                  className={`py-1 px-3 rounded-full text-center cursor-pointer relative transition-all duration-300 z-10 w-full ${
                    mode === 'register' 
                      ? 'text-primary-foreground' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {mode === 'register' && (
                    <motion.div 
                      layoutId="active-pill-bg"
                      className="absolute inset-0 bg-primary rounded-full -z-10 shadow-md"
                      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                    />
                  )}
                  Criar Conta
                </button>
              </div>

              {/* Core Login/Register View Area */}
              <CardContent className="p-0 flex-grow overflow-hidden flex flex-col justify-center">
                
                {/* Feedback Alerts */}
                <AnimatePresence mode="wait">
                  {errorMessage && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0, scale: 0.95 }}
                      animate={{ opacity: 1, height: 'auto', scale: 1 }}
                      exit={{ opacity: 0, height: 0, scale: 0.95 }}
                      className="bg-red-500/10 dark:bg-red-950/30 text-red-700 dark:text-red-300 p-2.5 rounded-xl border border-red-500/20 text-[0.70rem] font-medium flex flex-col gap-1.5 mb-2.5 shrink-0 shadow-sm"
                    >
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-red-500" />
                        <span className="leading-snug flex-1 font-semibold">{errorMessage}</span>
                      </div>

                      {isOperationNotAllowed && (
                        <div className="bg-background/80 p-2 rounded-lg border border-red-500/15 space-y-1 text-foreground/85">
                          <span className="text-foreground font-extrabold flex items-center gap-1 text-[0.70rem] text-red-500 dark:text-red-400">
                            <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" /> Ativar Email/Senha:
                          </span>
                          <ol className="list-decimal pl-3 text-[0.65rem] space-y-0.5 text-muted-foreground">
                            <li>Abra o Console clicando no link abaixo.</li>
                            <li>Ative o fornecedor de <strong className="text-foreground">"E-mail/senha"</strong> nas definições.</li>
                          </ol>
                          <a 
                            href={`https://console.firebase.google.com/project/${projectId}/authentication/providers`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center justify-center gap-1 w-full py-1.5 px-2 rounded-md text-[0.65rem] font-semibold bg-primary hover:bg-primary/90 text-primary-foreground transition-all shadow-sm cursor-pointer mt-1"
                          >
                            <span>Configurar no Firebase</span>
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        </div>
                      )}
                    </motion.div>
                  )}

                  {successMessage && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0, scale: 0.95 }}
                      animate={{ opacity: 1, height: 'auto', scale: 1 }}
                      exit={{ opacity: 0, height: 0, scale: 0.95 }}
                      className="bg-green-500/10 dark:bg-green-950/30 text-green-700 dark:text-green-300 p-2.5 rounded-xl border border-green-500/20 text-[0.70rem] font-semibold flex items-center gap-2 mb-2.5 shrink-0 shadow-sm"
                    >
                      <Check className="h-3.5 w-3.5 shrink-0 text-green-500" />
                      <span className="leading-snug flex-1">{successMessage}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Form Elements with explicit strict sizes to guarantee zero-scroll */}
                <form id="auth-form" onSubmit={handleEmailAuthSubmit} className="space-y-2">
                  <div className="relative">
                    <AnimatePresence mode="popLayout" initial={false}>
                      {mode === 'register' && (
                        <motion.div 
                          key="field-name"
                          initial={{ opacity: 0, height: 0, y: -8 }}
                          animate={{ opacity: 1, height: 'auto', y: 0 }}
                          exit={{ opacity: 0, height: 0, y: -8 }}
                          transition={{ duration: 0.2 }}
                          className="space-y-1 mb-2 h-[56px]"
                        >
                          <Label htmlFor="fullname" className="text-[0.68rem] uppercase tracking-wider font-bold text-foreground/80 block select-none">
                            Nome Completo
                          </Label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center w-3.5 h-3.5 opacity-50">
                              <User className="h-3.5 w-3.5 text-foreground" />
                            </span>
                            <Input 
                              id="fullname"
                              type="text"
                              placeholder="Filipe Celestino"
                              className="pl-9 h-[40px] border-border/80 hover:border-primary/50 focus-visible:ring-1 focus-visible:ring-primary/40 focus-visible:border-primary bg-background/55 text-foreground text-[0.85rem] rounded-[10px] focus:outline-none transition-all placeholder:text-muted-foreground/50"
                              value={name}
                              onChange={(e) => setName(e.target.value)}
                              disabled={isLoading || isGoogleLoading}
                              required
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Email View Block */}
                    <div className="space-y-1 mb-2">
                      <Label htmlFor="email" className="text-[0.68rem] uppercase tracking-wider font-bold text-foreground/80 block select-none">
                        E-mail de Trabalho
                      </Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center w-3.5 h-3.5 opacity-50">
                          <Mail className="h-3.5 w-3.5 text-foreground" />
                        </span>
                        <Input 
                          id="email"
                          type="email"
                          placeholder="exemplo@escola.ac.mz"
                          className="pl-9 h-[40px] border-border/80 hover:border-primary/50 focus-visible:ring-1 focus-visible:ring-primary/40 focus-visible:border-primary bg-background/55 text-foreground text-[0.85rem] rounded-[10px] focus:outline-none transition-all placeholder:text-muted-foreground/50"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          disabled={isLoading || isGoogleLoading}
                          required
                        />
                      </div>
                    </div>

                    {/* Password View Block */}
                    <div className="space-y-1 mb-2">
                      <Label htmlFor="password" className="text-[0.68rem] uppercase tracking-wider font-bold text-foreground/80 block select-none">
                        Palavra-passe
                      </Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center w-3.5 h-3.5 opacity-50">
                          <Lock className="h-3.5 w-3.5 text-foreground" />
                        </span>
                        <Input 
                          id="password"
                          type={showPassword ? "text" : "password"}
                          placeholder={mode === 'register' ? "Mínimo de 6 caracteres" : "Digite a sua senha"}
                          className="pl-9 pr-9 h-[40px] border-border/80 hover:border-primary/50 focus-visible:ring-1 focus-visible:ring-primary/40 focus-visible:border-primary bg-background/55 text-foreground text-[0.85rem] rounded-[10px] focus:outline-none transition-all placeholder:text-muted-foreground/50"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          disabled={isLoading || isGoogleLoading}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground transition-colors cursor-pointer flex items-center justify-center w-4 h-4"
                          title={showPassword ? "Ocultar palavra-passe" : "Mostrar palavra-passe"}
                        >
                          {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>

                    {/* Confirm Password Verification View Block */}
                    <AnimatePresence mode="popLayout" initial={false}>
                      {mode === 'register' && (
                        <motion.div 
                          key="field-confirm"
                          initial={{ opacity: 0, height: 0, y: -8 }}
                          animate={{ opacity: 1, height: 'auto', y: 0 }}
                          exit={{ opacity: 0, height: 0, y: -8 }}
                          transition={{ duration: 0.2 }}
                          className="space-y-1 h-[56px]"
                        >
                          <Label htmlFor="confirmPassword" className="text-[0.68rem] uppercase tracking-wider font-bold text-foreground/80 block select-none">
                            Confirmar Palavra-passe
                          </Label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center w-3.5 h-3.5 opacity-50">
                              <Lock className="h-3.5 w-3.5 text-foreground" />
                            </span>
                            <Input 
                              id="confirmPassword"
                              type={showPassword ? "text" : "password"}
                              placeholder="Repita a palavra-passe"
                              className="pl-9 h-[40px] border-border/80 hover:border-primary/50 focus-visible:ring-1 focus-visible:ring-primary/40 focus-visible:border-primary bg-background/55 text-foreground text-[0.85rem] rounded-[10px] focus:outline-none transition-all placeholder:text-muted-foreground/50"
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              disabled={isLoading || isGoogleLoading}
                              required
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Primary submit action */}
                  <Button 
                    type="submit"
                    className="w-full text-[0.85rem] font-bold h-[40px] bg-primary text-primary-foreground hover:bg-primary/95 hover:scale-[1.01] active:scale-100 rounded-[11px] transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 shadow-sm shrink-0 group relative overflow-hidden"
                    disabled={isLoading || isGoogleLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <span>{mode === 'login' ? 'Iniciar Sessão' : 'Criar Conta'}</span>
                        <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
                      </>
                    )}
                  </Button>
                </form>

                {/* Only display Google authentication on Login Mode */}
                {mode === 'login' && (
                  <>
                    {/* Divider Line */}
                    <div className="relative flex items-center py-2 shrink-0">
                      <div className="flex-grow border-t border-border/40" />
                      <span className="flex-shrink mx-3 text-[0.63rem] font-bold text-muted-foreground/60 uppercase tracking-[0.08em] leading-none shrink-0 select-none">
                        Usa outros métodos alternativos
                      </span>
                      <div className="flex-grow border-t border-border/40" />
                    </div>

                    {/* Secure Google alternative authentication access */}
                    <Button 
                      type="button"
                      variant="outline"
                      className="w-full text-xs font-bold h-[40px] border-border bg-card/45 hover:bg-muted focus-visible:ring-1 focus-visible:ring-primary/40 transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 rounded-[11px] text-foreground shrink-0 hover:scale-[1.01]"
                      onClick={handleGoogleAuth}
                      disabled={isLoading || isGoogleLoading}
                    >
                      {isGoogleLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/50" />
                      ) : (
                        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
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
                      {isGoogleLoading ? 'A ligar...' : 'Continuar com o Google'}
                    </Button>
                  </>
                )}
              </CardContent>

              {/* Legal Copyright Clean Info */}
              <div className="text-center pt-3 shrink-0 select-none">
                <p className="text-[0.63rem] text-muted-foreground/45 font-medium tracking-wide">
                  Desenvolvido por{' '}
                  <a 
                    href="https://www.linkedin.com/in/saidehassan5" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="hover:text-primary transition-colors font-bold underline decoration-dotted underline-offset-2 cursor-pointer"
                  >
                    Saide Hassan
                  </a>{' '}
                  | {new Date().getFullYear()}
                </p>
              </div>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
