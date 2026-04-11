import React from 'react';
import { motion } from 'motion/react';
import { GraduationCap, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { User } from 'firebase/auth';

interface WelcomeScreenProps {
  onStart: () => void;
  user: User | null;
}

export function WelcomeScreen({ onStart, user }: WelcomeScreenProps) {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
  };

  return (
    <div className="relative flex flex-col items-center justify-center h-screen overflow-hidden px-4 sm:px-6 lg:px-8">
      <motion.div 
        className="max-w-4xl w-full space-y-12 text-center"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={itemVariants} className="space-y-6">
          <div className="mx-auto w-24 h-24 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-8 shadow-inner">
            <GraduationCap className="h-12 w-12" />
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-foreground">
            Bem-vindo ao <span className="text-primary">EduGestão</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto font-light">
            A plataforma moderna e intuitiva para simplificar a gestão das suas turmas, alunos e avaliações escolares.
          </p>
        </motion.div>

        <motion.div variants={itemVariants} className="pt-8">
          <Button 
            onClick={onStart} 
            size="lg" 
            className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full px-8 py-6 text-lg shadow-lg hover:shadow-xl transition-all group"
          >
            {user ? "Continuar" : "Começar"}
            <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
          </Button>
        </motion.div>
      </motion.div>

      <footer className="absolute bottom-4 left-0 right-0 text-center text-sm text-muted-foreground">
        <p>
          &copy; {new Date().getFullYear()} Direitos reservados a{' '}
          <a 
            href="https://www.linkedin.com/in/saidehassan" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Saide Hassan
          </a>
        </p>
      </footer>
    </div>
  );
}
