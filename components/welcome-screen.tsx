import React from 'react';
import { motion } from 'motion/react';
import { GraduationCap, Users, FileSpreadsheet, BookOpen, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WelcomeScreenProps {
  onStart: () => void;
}

export function WelcomeScreen({ onStart }: WelcomeScreenProps) {
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
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] py-12 px-4 sm:px-6 lg:px-8">
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

        <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto mt-12">
          <div className="bg-card p-6 rounded-2xl border border-border shadow-sm hover:shadow-md transition-shadow text-left">
            <div className="w-12 h-12 bg-blue-500/10 text-blue-500 rounded-xl flex items-center justify-center mb-4">
              <Users className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Gestão de Alunos</h3>
            <p className="text-muted-foreground text-sm">
              Organize os dados pessoais e de contacto dos seus alunos e encarregados de educação num só lugar.
            </p>
          </div>

          <div className="bg-card p-6 rounded-2xl border border-border shadow-sm hover:shadow-md transition-shadow text-left">
            <div className="w-12 h-12 bg-emerald-500/10 text-emerald-500 rounded-xl flex items-center justify-center mb-4">
              <BookOpen className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Registo de Avaliações</h3>
            <p className="text-muted-foreground text-sm">
              Lance notas de ACS, AP e Exames com cálculo automático de médias e feedback visual de cores.
            </p>
          </div>

          <div className="bg-card p-6 rounded-2xl border border-border shadow-sm hover:shadow-md transition-shadow text-left">
            <div className="w-12 h-12 bg-amber-500/10 text-amber-500 rounded-xl flex items-center justify-center mb-4">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Exportação Excel</h3>
            <p className="text-muted-foreground text-sm">
              Exporte facilmente as pautas e dados das turmas para ficheiros Excel (.xlsx) com um clique.
            </p>
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="pt-8">
          <Button 
            onClick={onStart} 
            size="lg" 
            className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full px-8 py-6 text-lg shadow-lg hover:shadow-xl transition-all group"
          >
            Começar a usar
            <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
}
