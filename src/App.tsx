import React, { useState, useEffect } from 'react';
import { Plus, Users, BookOpen, School, GraduationCap, ChevronLeft, Trash2, UserPlus, Save, Search, Download, Pencil, Home } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ThemeToggle } from '@/components/theme-toggle';
import { WelcomeScreen } from '@/components/welcome-screen';

type Grades = {
  acs1: string;
  acs2: string;
  acs3: string;
  ap: string;
  exame: string;
};

type Student = {
  id: string;
  studentNumber?: string;
  name: string;
  grades: Grades;
  dob?: string;
  birthplace?: string;
  address?: string;
  parentName?: string;
  parentProfession?: string;
  parentAddress?: string;
  parentContact?: string;
};

type ClassData = {
  id: string;
  school: string;
  level: string;
  section: string;
  subject: string;
  isDirector: boolean;
  students: Student[];
};

const calculateAverage = (grades: Grades) => {
  const values = [grades.acs1, grades.acs2, grades.acs3, grades.ap, grades.exame]
    .map(v => parseFloat(v.replace(',', '.')))
    .filter(v => !isNaN(v));
  if (values.length === 0) return '-';
  const sum = values.reduce((acc, curr) => acc + curr, 0);
  return (sum / values.length).toFixed(1);
};

const getGradeColor = (val: string, isAverage = false) => {
  const num = parseFloat(val.replace(',', '.'));
  if (isNaN(num)) return '';
  
  if (num >= 0 && num <= 6.5) return 'text-red-600 dark:text-red-500';
  if (num > 6.5 && num < 10) return 'text-orange-500 dark:text-orange-400';
  
  if (isAverage && num >= 10) return 'text-emerald-500 dark:text-emerald-400';
  
  if (num >= 10 && num <= 15) return 'text-green-400 dark:text-green-300';
  if (num > 15 && num <= 20) return 'text-green-600 dark:text-green-500';
  
  return '';
};

function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(error);
    }
  };

  return [storedValue, setValue] as const;
}

export default function App() {
  const [classes, setClasses] = useLocalStorage<ClassData[]>('gestao-turmas-classes', []);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [hasSeenWelcome, setHasSeenWelcome] = useLocalStorage<boolean>('edugestao-has-seen-welcome', false);
  
  // Add Class State
  const [isAddClassOpen, setIsAddClassOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editingClass, setEditingClass] = useState<ClassData | null>(null);
  const [studentToDelete, setStudentToDelete] = useState<string | null>(null);
  const [newClass, setNewClass] = useState({
    school: '',
    level: '',
    section: '',
    subject: '',
    isDirector: false
  });

  // Add Student State
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [newStudent, setNewStudent] = useState({
    studentNumber: '',
    name: '',
    dob: '',
    birthplace: '',
    address: '',
    parentName: '',
    parentProfession: '',
    parentAddress: '',
    parentContact: ''
  });

  const [searchQuery, setSearchQuery] = useState('');

  const selectedClass = classes.find(c => c.id === selectedClassId);

  const handleAddClass = () => {
    if (!newClass.school || !newClass.level || !newClass.section || !newClass.subject) return;
    
    const newClassData: ClassData = {
      id: crypto.randomUUID(),
      ...newClass,
      students: []
    };
    
    setClasses([...classes, newClassData]);
    setIsAddClassOpen(false);
    setNewClass({ school: '', level: '', section: '', subject: '', isDirector: false });
  };

  const handleUpdateClass = () => {
    if (!editingClass || !editingClass.school || !editingClass.level || !editingClass.section || !editingClass.subject) return;

    const updatedClasses = classes.map(c => {
      if (c.id === editingClass.id) {
        return editingClass;
      }
      return c;
    });

    setClasses(updatedClasses);
    setEditingClass(null);
  };

  const handleAddStudent = () => {
    if (!selectedClass || !newStudent.name) return;

    const student: Student = {
      id: crypto.randomUUID(),
      studentNumber: newStudent.studentNumber,
      name: newStudent.name,
      grades: { acs1: '', acs2: '', acs3: '', ap: '', exame: '' },
      ...(selectedClass.isDirector ? {
        dob: newStudent.dob,
        birthplace: newStudent.birthplace,
        address: newStudent.address,
        parentName: newStudent.parentName,
        parentProfession: newStudent.parentProfession,
        parentAddress: newStudent.parentAddress,
        parentContact: newStudent.parentContact
      } : {})
    };

    const updatedClasses = classes.map(c => {
      if (c.id === selectedClass.id) {
        return { ...c, students: [...c.students, student] };
      }
      return c;
    });

    setClasses(updatedClasses);
    setIsAddStudentOpen(false);
    setNewStudent({ studentNumber: '', name: '', dob: '', birthplace: '', address: '', parentName: '', parentProfession: '', parentAddress: '', parentContact: '' });
  };

  const handleUpdateStudent = () => {
    if (!selectedClass || !editingStudent || !editingStudent.name) return;

    const updatedClasses = classes.map(c => {
      if (c.id === selectedClass.id) {
        return {
          ...c,
          students: c.students.map(s => s.id === editingStudent.id ? editingStudent : s)
        };
      }
      return c;
    });

    setClasses(updatedClasses);
    setEditingStudent(null);
  };

  const updateGrade = (studentId: string, field: keyof Grades, value: string) => {
    if (!selectedClass) return;
    
    const updatedClasses = classes.map(c => {
      if (c.id === selectedClass.id) {
        return {
          ...c,
          students: c.students.map(s => {
            if (s.id === studentId) {
              return { ...s, grades: { ...s.grades, [field]: value } };
            }
            return s;
          })
        };
      }
      return c;
    });
    
    setClasses(updatedClasses);
  };

  const confirmDeleteStudent = (studentId: string) => {
    setStudentToDelete(studentId);
  };

  const deleteStudent = () => {
    if (!selectedClass || !studentToDelete) return;
    
    const updatedClasses = classes.map(c => {
      if (c.id === selectedClass.id) {
        return { ...c, students: c.students.filter(s => s.id !== studentToDelete) };
      }
      return c;
    });
    
    setClasses(updatedClasses);
    setStudentToDelete(null);
  };

  const deleteClass = (classId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Tem certeza que deseja remover esta turma? Todos os alunos serão apagados.')) return;
    setClasses(classes.filter(c => c.id !== classId));
    if (selectedClassId === classId) setSelectedClassId(null);
  };

  const filteredStudents = selectedClass?.students.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  ).sort((a, b) => {
    const numA = parseInt(a.studentNumber || '9999', 10);
    const numB = parseInt(b.studentNumber || '9999', 10);
    if (!isNaN(numA) && !isNaN(numB) && numA !== numB) return numA - numB;
    return a.name.localeCompare(b.name);
  }) || [];

  const exportToExcel = () => {
    if (!selectedClass) return;

    const hasAcs1 = selectedClass.students.some(s => s.grades.acs1.trim() !== '');
    const hasAcs2 = selectedClass.students.some(s => s.grades.acs2.trim() !== '');
    const hasAcs3 = selectedClass.students.some(s => s.grades.acs3.trim() !== '');
    const hasAp = selectedClass.students.some(s => s.grades.ap.trim() !== '');
    const hasExame = selectedClass.students.some(s => s.grades.exame.trim() !== '');

    const gradesData = selectedClass.students.map(student => {
      const row: Record<string, string> = {
        'Nº': student.studentNumber || '-',
        'Nome do Aluno': student.name,
      };
      if (hasAcs1) row['ACS 1'] = student.grades.acs1;
      if (hasAcs2) row['ACS 2'] = student.grades.acs2;
      if (hasAcs3) row['ACS 3'] = student.grades.acs3;
      if (hasAp) row['AP'] = student.grades.ap;
      if (hasExame) row['Exame'] = student.grades.exame;
      
      row['Média'] = calculateAverage(student.grades);
      return row;
    });

    const wb = XLSX.utils.book_new();
    const wsGrades = XLSX.utils.json_to_sheet(gradesData);
    XLSX.utils.book_append_sheet(wb, wsGrades, 'Avaliações');

    if (selectedClass.isDirector) {
      const personalData = selectedClass.students.map(student => ({
        'Nº': student.studentNumber || '-',
        'Nome do Aluno': student.name,
        'Data de Nascimento': student.dob ? new Date(student.dob).toLocaleDateString('pt-PT') : '',
        'Local de Nascimento': student.birthplace || '',
        'Morada': student.address || '',
        'Encarregado de Educação': student.parentName || '',
        'Profissão do EE': student.parentProfession || '',
        'Contacto do EE': student.parentContact || '',
        'Morada do EE': student.parentAddress || '',
      }));
      const wsPersonal = XLSX.utils.json_to_sheet(personalData);
      XLSX.utils.book_append_sheet(wb, wsPersonal, 'Dados Pessoais');
    }

    const fileName = `Turma_${selectedClass.level}_${selectedClass.section}_${selectedClass.subject}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  return (
    <div className="min-h-screen text-foreground font-sans">
      {/* Header */}
      <header className="bg-card/80 backdrop-blur-md border-b border-border sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-primary">
            <GraduationCap className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-semibold tracking-tight">EduGestão</h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            {hasSeenWelcome && (
              <Button variant="ghost" size="sm" onClick={() => { setHasSeenWelcome(false); setSelectedClassId(null); }} className="text-muted-foreground hover:text-foreground" title="Página Inicial">
                <Home className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Início</span>
              </Button>
            )}
            {selectedClassId && (
              <Button variant="ghost" size="sm" onClick={() => setSelectedClassId(null)} className="text-muted-foreground hover:text-foreground">
                <ChevronLeft className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Voltar às Turmas</span>
                <span className="sm:hidden">Voltar</span>
              </Button>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!hasSeenWelcome ? (
          <WelcomeScreen onStart={() => setHasSeenWelcome(true)} />
        ) : !selectedClassId ? (
          // Dashboard - List of Classes
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-3xl font-light tracking-tight">Minhas Turmas</h2>
                <p className="text-muted-foreground mt-1">Faça a gestão dos seus alunos e avaliações.</p>
              </div>
              
              <Dialog open={isAddClassOpen} onOpenChange={setIsAddClassOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full px-6 shadow-sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Nova Turma
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Adicionar Nova Turma</DialogTitle>
                    <DialogDescription>
                      Preencha os detalhes da turma ou disciplina que leciona.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="school">Escola / Colégio</Label>
                      <Input id="school" value={newClass.school} onChange={e => setNewClass({...newClass, school: e.target.value})} placeholder="Ex: Escola Secundária Central" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="level">Classe / Ano</Label>
                        <Input id="level" value={newClass.level} onChange={e => setNewClass({...newClass, level: e.target.value})} placeholder="Ex: 10ª Classe" />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="section">Turma</Label>
                        <Input id="section" value={newClass.section} onChange={e => setNewClass({...newClass, section: e.target.value})} placeholder="Ex: A" />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="subject">Disciplina</Label>
                      <Input id="subject" value={newClass.subject} onChange={e => setNewClass({...newClass, subject: e.target.value})} placeholder="Ex: Matemática" />
                    </div>
                    <div className="flex items-center space-x-2 mt-2 bg-muted/50 p-3 rounded-md border border-border">
                      <Checkbox 
                        id="isDirector" 
                        checked={newClass.isDirector}
                        onCheckedChange={(checked) => setNewClass({...newClass, isDirector: checked === true})}
                      />
                      <div className="grid gap-1.5 leading-none">
                        <Label htmlFor="isDirector" className="font-medium cursor-pointer">
                          Sou o Diretor desta Turma
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Permite adicionar dados detalhados dos alunos (morada, encarregado, etc).
                        </p>
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsAddClassOpen(false)}>Cancelar</Button>
                    <Button onClick={handleAddClass} className="bg-primary hover:bg-primary/90 text-primary-foreground">Guardar Turma</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog open={!!editingClass} onOpenChange={(open) => !open && setEditingClass(null)}>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Editar Turma</DialogTitle>
                    <DialogDescription>
                      Altere os detalhes da turma ou disciplina.
                    </DialogDescription>
                  </DialogHeader>
                  {editingClass && (
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="edit-school">Escola / Colégio</Label>
                        <Input id="edit-school" value={editingClass.school} onChange={e => setEditingClass({...editingClass, school: e.target.value})} placeholder="Ex: Escola Secundária Central" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="edit-level">Classe / Ano</Label>
                          <Input id="edit-level" value={editingClass.level} onChange={e => setEditingClass({...editingClass, level: e.target.value})} placeholder="Ex: 10ª Classe" />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="edit-section">Turma</Label>
                          <Input id="edit-section" value={editingClass.section} onChange={e => setEditingClass({...editingClass, section: e.target.value})} placeholder="Ex: A" />
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="edit-subject">Disciplina</Label>
                        <Input id="edit-subject" value={editingClass.subject} onChange={e => setEditingClass({...editingClass, subject: e.target.value})} placeholder="Ex: Matemática" />
                      </div>
                      <div className="flex items-center space-x-2 mt-2 bg-muted/50 p-3 rounded-md border border-border">
                        <Checkbox 
                          id="edit-isDirector" 
                          checked={editingClass.isDirector}
                          onCheckedChange={(checked) => setEditingClass({...editingClass, isDirector: checked === true})}
                        />
                        <div className="grid gap-1.5 leading-none">
                          <Label htmlFor="edit-isDirector" className="font-medium cursor-pointer">
                            Sou o Diretor desta Turma
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            Permite adicionar dados detalhados dos alunos (morada, encarregado, etc).
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setEditingClass(null)}>Cancelar</Button>
                    <Button onClick={handleUpdateClass} className="bg-primary hover:bg-primary/90 text-primary-foreground" disabled={!editingClass?.school || !editingClass?.level || !editingClass?.section || !editingClass?.subject}>Guardar Alterações</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {classes.length === 0 ? (
              <div className="text-center py-20 bg-card rounded-2xl border border-dashed border-border">
                <div className="mx-auto w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4">
                  <BookOpen className="h-8 w-8" />
                </div>
                <h3 className="text-lg font-medium text-foreground">Nenhuma turma adicionada</h3>
                <p className="text-muted-foreground mt-1 max-w-sm mx-auto">Comece por adicionar a sua primeira turma para gerir os alunos e as suas avaliações.</p>
                <Button onClick={() => setIsAddClassOpen(true)} variant="outline" className="mt-6 rounded-full">
                  <Plus className="h-4 w-4 mr-2" /> Adicionar Turma
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {classes.map((c) => (
                  <Card 
                    key={c.id} 
                    className="cursor-pointer hover:shadow-md transition-all duration-200 border-border hover:border-primary/50 group bg-card"
                    onClick={() => setSelectedClassId(c.id)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <div className="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-medium mb-3 inline-block">
                          {c.subject}
                        </div>
                        <div className="flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-muted-foreground opacity-100 md:opacity-0 md:group-hover:opacity-100 hover:text-primary transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingClass(c);
                            }}
                            title="Editar Turma"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-muted-foreground opacity-100 md:opacity-0 md:group-hover:opacity-100 hover:text-destructive transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteClass(c.id, e);
                            }}
                            title="Remover Turma"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <CardTitle className="text-xl">{c.level} - Turma {c.section}</CardTitle>
                      <CardDescription className="flex items-center gap-1.5 mt-1.5">
                        <School className="h-3.5 w-3.5" /> {c.school}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span>{c.students.length} Alunos</span>
                        </div>
                        {c.isDirector && (
                          <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded text-xs font-medium">
                            Diretor de Turma
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        ) : (
          // Class Details - Students and Grades
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="bg-card p-6 rounded-2xl border border-border shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="bg-primary/20 text-primary text-xs font-semibold px-2.5 py-0.5 rounded-full">
                    {selectedClass.subject}
                  </span>
                  {selectedClass.isDirector && (
                    <span className="bg-amber-500/20 text-amber-600 dark:text-amber-500 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                      Direção de Turma
                    </span>
                  )}
                </div>
                <h2 className="text-2xl font-bold text-foreground">
                  {selectedClass.level} - Turma {selectedClass.section}
                </h2>
                <p className="text-muted-foreground text-sm flex items-center gap-1.5 mt-1">
                  <School className="h-4 w-4" /> {selectedClass.school}
                </p>
              </div>
              
              <div className="flex items-center gap-3 w-full md:w-auto">
                <div className="relative flex-1 md:w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Procurar aluno..." 
                    className="pl-9 bg-muted/50 border-border"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Button variant="outline" onClick={exportToExcel} className="shadow-sm shrink-0" title="Exportar para Excel" disabled={selectedClass.students.length === 0}>
                  <Download className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Exportar</span>
                </Button>
                <Dialog open={isAddStudentOpen} onOpenChange={setIsAddStudentOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm shrink-0">
                      <UserPlus className="h-4 w-4 mr-2" />
                      Adicionar Aluno
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Adicionar Novo Aluno</DialogTitle>
                      <DialogDescription>
                        Insira os dados do aluno para a turma {selectedClass.section}.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-4 gap-4">
                        <div className="grid gap-2 col-span-1">
                          <Label htmlFor="studentNumber">Nº</Label>
                          <Input id="studentNumber" value={newStudent.studentNumber} onChange={e => setNewStudent({...newStudent, studentNumber: e.target.value})} placeholder="Ex: 1" />
                        </div>
                        <div className="grid gap-2 col-span-3">
                          <Label htmlFor="studentName">Nome Completo <span className="text-red-500">*</span></Label>
                          <Input id="studentName" value={newStudent.name} onChange={e => setNewStudent({...newStudent, name: e.target.value})} placeholder="Ex: João Manuel Silva" />
                        </div>
                      </div>
                      
                      {selectedClass.isDirector && (
                        <>
                          <div className="grid gap-2">
                            <Label htmlFor="dob">Data de Nascimento</Label>
                            <Input id="dob" type="date" value={newStudent.dob} onChange={e => setNewStudent({...newStudent, dob: e.target.value})} />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="birthplace">Local de Nascimento</Label>
                            <Input id="birthplace" value={newStudent.birthplace} onChange={e => setNewStudent({...newStudent, birthplace: e.target.value})} placeholder="Ex: Lisboa" />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="address">Morada do Aluno</Label>
                            <Input id="address" value={newStudent.address} onChange={e => setNewStudent({...newStudent, address: e.target.value})} placeholder="Ex: Bairro Central, Rua 2" />
                          </div>
                          
                          <div className="my-2 border-t border-border pt-4">
                            <h4 className="text-sm font-semibold text-foreground mb-3">Dados do Encarregado de Educação</h4>
                            <div className="grid gap-4">
                              <div className="grid gap-2">
                                <Label htmlFor="parentName">Nome do Pai / Encarregado</Label>
                                <Input id="parentName" value={newStudent.parentName} onChange={e => setNewStudent({...newStudent, parentName: e.target.value})} placeholder="Nome completo" />
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                  <Label htmlFor="parentProfession">Profissão</Label>
                                  <Input id="parentProfession" value={newStudent.parentProfession} onChange={e => setNewStudent({...newStudent, parentProfession: e.target.value})} placeholder="Ex: Professor" />
                                </div>
                                <div className="grid gap-2">
                                  <Label htmlFor="parentContact">Contacto</Label>
                                  <Input id="parentContact" value={newStudent.parentContact} onChange={e => setNewStudent({...newStudent, parentContact: e.target.value})} placeholder="Ex: 9XX XXX XXX" />
                                </div>
                              </div>
                              <div className="grid gap-2">
                                <Label htmlFor="parentAddress">Morada do Encarregado</Label>
                                <Input id="parentAddress" value={newStudent.parentAddress} onChange={e => setNewStudent({...newStudent, parentAddress: e.target.value})} placeholder="Se diferente da morada do aluno" />
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsAddStudentOpen(false)}>Cancelar</Button>
                      <Button onClick={handleAddStudent} className="bg-primary hover:bg-primary/90 text-primary-foreground" disabled={!newStudent.name}>Guardar Aluno</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Dialog open={!!editingStudent} onOpenChange={(open) => !open && setEditingStudent(null)}>
                  <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Editar Aluno</DialogTitle>
                      <DialogDescription>
                        Altere os dados do aluno abaixo.
                      </DialogDescription>
                    </DialogHeader>
                    {editingStudent && (
                      <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 gap-4">
                          <div className="col-span-1 grid gap-2">
                            <Label htmlFor="edit-studentNumber">Nº</Label>
                            <Input id="edit-studentNumber" value={editingStudent.studentNumber || ''} onChange={e => setEditingStudent({...editingStudent, studentNumber: e.target.value})} placeholder="Ex: 1" />
                          </div>
                          <div className="col-span-3 grid gap-2">
                            <Label htmlFor="edit-studentName">Nome Completo <span className="text-red-500">*</span></Label>
                            <Input id="edit-studentName" value={editingStudent.name} onChange={e => setEditingStudent({...editingStudent, name: e.target.value})} placeholder="Ex: João Silva" />
                          </div>
                        </div>
                        
                        {selectedClass?.isDirector && (
                          <>
                            <div className="grid gap-2">
                              <Label htmlFor="edit-dob">Data de Nascimento</Label>
                              <Input id="edit-dob" type="date" value={editingStudent.dob || ''} onChange={e => setEditingStudent({...editingStudent, dob: e.target.value})} />
                            </div>
                            <div className="grid gap-2">
                              <Label htmlFor="edit-birthplace">Local de Nascimento</Label>
                              <Input id="edit-birthplace" value={editingStudent.birthplace || ''} onChange={e => setEditingStudent({...editingStudent, birthplace: e.target.value})} placeholder="Ex: Lisboa" />
                            </div>
                            <div className="grid gap-2">
                              <Label htmlFor="edit-address">Morada do Aluno</Label>
                              <Input id="edit-address" value={editingStudent.address || ''} onChange={e => setEditingStudent({...editingStudent, address: e.target.value})} placeholder="Ex: Bairro Central, Rua 2" />
                            </div>
                            
                            <div className="my-2 border-t border-border pt-4">
                              <h4 className="text-sm font-semibold text-foreground mb-3">Dados do Encarregado de Educação</h4>
                              <div className="grid gap-4">
                                <div className="grid gap-2">
                                  <Label htmlFor="edit-parentName">Nome do Pai / Encarregado</Label>
                                  <Input id="edit-parentName" value={editingStudent.parentName || ''} onChange={e => setEditingStudent({...editingStudent, parentName: e.target.value})} placeholder="Nome completo" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="grid gap-2">
                                    <Label htmlFor="edit-parentProfession">Profissão</Label>
                                    <Input id="edit-parentProfession" value={editingStudent.parentProfession || ''} onChange={e => setEditingStudent({...editingStudent, parentProfession: e.target.value})} placeholder="Ex: Professor" />
                                  </div>
                                  <div className="grid gap-2">
                                    <Label htmlFor="edit-parentContact">Contacto</Label>
                                    <Input id="edit-parentContact" value={editingStudent.parentContact || ''} onChange={e => setEditingStudent({...editingStudent, parentContact: e.target.value})} placeholder="Ex: 9xx xxx xxx" />
                                  </div>
                                </div>
                                <div className="grid gap-2">
                                  <Label htmlFor="edit-parentAddress">Morada do EE</Label>
                                  <Input id="edit-parentAddress" value={editingStudent.parentAddress || ''} onChange={e => setEditingStudent({...editingStudent, parentAddress: e.target.value})} placeholder="Mesma do aluno ou outra" />
                                </div>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setEditingStudent(null)}>Cancelar</Button>
                      <Button onClick={handleUpdateStudent} className="bg-primary hover:bg-primary/90 text-primary-foreground" disabled={!editingStudent?.name}>Guardar Alterações</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Dialog open={!!studentToDelete} onOpenChange={(open) => !open && setStudentToDelete(null)}>
                  <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle>Remover Aluno</DialogTitle>
                      <DialogDescription>
                        Tem certeza que deseja remover este aluno? Esta ação não pode ser desfeita.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setStudentToDelete(null)}>Cancelar</Button>
                      <Button variant="destructive" onClick={deleteStudent}>Remover</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
              {selectedClass.students.length === 0 ? (
                <div className="text-center py-16">
                  <Users className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
                  <h3 className="text-lg font-medium text-foreground">Nenhum aluno nesta turma</h3>
                  <p className="text-muted-foreground mt-1 text-sm">Adicione alunos para começar a registar as avaliações.</p>
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="text-center py-16">
                  <Search className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
                  <h3 className="text-lg font-medium text-foreground">Nenhum aluno encontrado</h3>
                  <p className="text-muted-foreground mt-1 text-sm">Tente procurar por outro nome.</p>
                </div>
              ) : (
                selectedClass.isDirector ? (
                  <Tabs defaultValue="avaliacoes" className="w-full">
                    <div className="px-6 pt-4 border-b border-border">
                      <TabsList className="grid w-full max-w-md grid-cols-2">
                        <TabsTrigger value="avaliacoes">Avaliações</TabsTrigger>
                        <TabsTrigger value="dados">Dados dos Alunos</TabsTrigger>
                      </TabsList>
                    </div>
                    <TabsContent value="avaliacoes" className="m-0">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader className="bg-muted/50">
                            <TableRow>
                              <TableHead className="w-[60px] font-semibold text-foreground">Nº</TableHead>
                              <TableHead className="w-[250px] font-semibold text-foreground">Nome do Aluno</TableHead>
                              <TableHead className="w-[90px] text-center font-semibold text-foreground">ACS 1</TableHead>
                              <TableHead className="w-[90px] text-center font-semibold text-foreground">ACS 2</TableHead>
                              <TableHead className="w-[90px] text-center font-semibold text-foreground">ACS 3</TableHead>
                              <TableHead className="w-[90px] text-center font-semibold text-foreground">AP</TableHead>
                              <TableHead className="w-[90px] text-center font-semibold text-foreground">Exame</TableHead>
                              <TableHead className="w-[90px] text-center font-semibold text-foreground">Média</TableHead>
                              <TableHead className="w-[80px] text-right font-semibold text-foreground">Ações</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredStudents.map((student) => (
                              <TableRow key={student.id} className="hover:bg-muted/50 transition-colors">
                                <TableCell className="font-medium text-muted-foreground">{student.studentNumber || '-'}</TableCell>
                                <TableCell className="font-medium text-foreground">{student.name}</TableCell>
                                <TableCell>
                                  <Input 
                                    className={`h-8 w-16 mx-auto text-center px-1 border-transparent hover:border-border focus:border-primary bg-transparent hover:bg-background transition-all font-medium ${getGradeColor(student.grades.acs1)}`}
                                    value={student.grades.acs1} 
                                    onChange={(e) => updateGrade(student.id, 'acs1', e.target.value)}
                                    placeholder="-"
                                  />
                                </TableCell>
                                <TableCell>
                                  <Input 
                                    className={`h-8 w-16 mx-auto text-center px-1 border-transparent hover:border-border focus:border-primary bg-transparent hover:bg-background transition-all font-medium ${getGradeColor(student.grades.acs2)}`}
                                    value={student.grades.acs2} 
                                    onChange={(e) => updateGrade(student.id, 'acs2', e.target.value)}
                                    placeholder="-"
                                  />
                                </TableCell>
                                <TableCell>
                                  <Input 
                                    className={`h-8 w-16 mx-auto text-center px-1 border-transparent hover:border-border focus:border-primary bg-transparent hover:bg-background transition-all font-medium ${getGradeColor(student.grades.acs3)}`}
                                    value={student.grades.acs3} 
                                    onChange={(e) => updateGrade(student.id, 'acs3', e.target.value)}
                                    placeholder="-"
                                  />
                                </TableCell>
                                <TableCell>
                                  <Input 
                                    className={`h-8 w-16 mx-auto text-center px-1 border-transparent hover:border-border focus:border-primary bg-transparent hover:bg-background transition-all font-medium ${getGradeColor(student.grades.ap)}`}
                                    value={student.grades.ap} 
                                    onChange={(e) => updateGrade(student.id, 'ap', e.target.value)}
                                    placeholder="-"
                                  />
                                </TableCell>
                                <TableCell>
                                  <Input 
                                    className={`h-8 w-16 mx-auto text-center px-1 border-transparent hover:border-border focus:border-primary bg-transparent hover:bg-background transition-all font-medium ${getGradeColor(student.grades.exame)}`}
                                    value={student.grades.exame} 
                                    onChange={(e) => updateGrade(student.id, 'exame', e.target.value)}
                                    placeholder="-"
                                  />
                                </TableCell>
                                <TableCell className={`text-center font-bold ${getGradeColor(calculateAverage(student.grades), true) || 'text-foreground'}`}>
                                  {calculateAverage(student.grades)}
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-1">
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
                                      onClick={() => setEditingStudent(student)}
                                      title="Editar Aluno"
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                      onClick={() => confirmDeleteStudent(student.id)}
                                      title="Remover Aluno"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </TabsContent>
                    <TabsContent value="dados" className="m-0">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader className="bg-muted/50">
                            <TableRow>
                              <TableHead className="w-[60px] font-semibold text-foreground">Nº</TableHead>
                              <TableHead className="w-[200px] font-semibold text-foreground">Nome do Aluno</TableHead>
                              <TableHead className="w-[120px] font-semibold text-foreground">Data Nasc.</TableHead>
                              <TableHead className="w-[150px] font-semibold text-foreground">Local Nasc.</TableHead>
                              <TableHead className="w-[150px] font-semibold text-foreground">Morada</TableHead>
                              <TableHead className="w-[200px] font-semibold text-foreground">Encarregado (EE)</TableHead>
                              <TableHead className="w-[120px] font-semibold text-foreground">Contacto EE</TableHead>
                              <TableHead className="w-[80px] text-right font-semibold text-foreground">Ações</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredStudents.map((student) => (
                              <TableRow key={student.id} className="hover:bg-muted/50 transition-colors">
                                <TableCell className="font-medium text-muted-foreground">{student.studentNumber || '-'}</TableCell>
                                <TableCell className="font-medium text-foreground">{student.name}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">{student.dob ? new Date(student.dob).toLocaleDateString('pt-PT') : '-'}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">{student.birthplace || '-'}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">{student.address || '-'}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  <div className="flex flex-col">
                                    <span>{student.parentName || '-'}</span>
                                    {student.parentProfession && <span className="text-[10px] text-muted-foreground/70">{student.parentProfession}</span>}
                                  </div>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">{student.parentContact || '-'}</TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-1">
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
                                      onClick={() => setEditingStudent(student)}
                                      title="Editar Aluno"
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                      onClick={() => confirmDeleteStudent(student.id)}
                                      title="Remover Aluno"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </TabsContent>
                  </Tabs>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead className="w-[60px] font-semibold text-foreground">Nº</TableHead>
                          <TableHead className="w-[250px] font-semibold text-foreground">Nome do Aluno</TableHead>
                          <TableHead className="w-[90px] text-center font-semibold text-foreground">ACS 1</TableHead>
                          <TableHead className="w-[90px] text-center font-semibold text-foreground">ACS 2</TableHead>
                          <TableHead className="w-[90px] text-center font-semibold text-foreground">ACS 3</TableHead>
                          <TableHead className="w-[90px] text-center font-semibold text-foreground">AP</TableHead>
                          <TableHead className="w-[90px] text-center font-semibold text-foreground">Exame</TableHead>
                          <TableHead className="w-[90px] text-center font-semibold text-foreground">Média</TableHead>
                          <TableHead className="w-[80px] text-right font-semibold text-foreground">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredStudents.map((student) => (
                          <TableRow key={student.id} className="hover:bg-muted/50 transition-colors">
                            <TableCell className="font-medium text-muted-foreground">{student.studentNumber || '-'}</TableCell>
                            <TableCell className="font-medium text-foreground">{student.name}</TableCell>
                            <TableCell>
                              <Input 
                                className={`h-8 w-16 mx-auto text-center px-1 border-transparent hover:border-border focus:border-primary bg-transparent hover:bg-background transition-all font-medium ${getGradeColor(student.grades.acs1)}`}
                                value={student.grades.acs1} 
                                onChange={(e) => updateGrade(student.id, 'acs1', e.target.value)}
                                placeholder="-"
                              />
                            </TableCell>
                            <TableCell>
                              <Input 
                                className={`h-8 w-16 mx-auto text-center px-1 border-transparent hover:border-border focus:border-primary bg-transparent hover:bg-background transition-all font-medium ${getGradeColor(student.grades.acs2)}`}
                                value={student.grades.acs2} 
                                onChange={(e) => updateGrade(student.id, 'acs2', e.target.value)}
                                placeholder="-"
                              />
                            </TableCell>
                            <TableCell>
                              <Input 
                                className={`h-8 w-16 mx-auto text-center px-1 border-transparent hover:border-border focus:border-primary bg-transparent hover:bg-background transition-all font-medium ${getGradeColor(student.grades.acs3)}`}
                                value={student.grades.acs3} 
                                onChange={(e) => updateGrade(student.id, 'acs3', e.target.value)}
                                placeholder="-"
                              />
                            </TableCell>
                            <TableCell>
                              <Input 
                                className={`h-8 w-16 mx-auto text-center px-1 border-transparent hover:border-border focus:border-primary bg-transparent hover:bg-background transition-all font-medium ${getGradeColor(student.grades.ap)}`}
                                value={student.grades.ap} 
                                onChange={(e) => updateGrade(student.id, 'ap', e.target.value)}
                                placeholder="-"
                              />
                            </TableCell>
                            <TableCell>
                              <Input 
                                className={`h-8 w-16 mx-auto text-center px-1 border-transparent hover:border-border focus:border-primary bg-transparent hover:bg-background transition-all font-medium ${getGradeColor(student.grades.exame)}`}
                                value={student.grades.exame} 
                                onChange={(e) => updateGrade(student.id, 'exame', e.target.value)}
                                placeholder="-"
                              />
                            </TableCell>
                            <TableCell className={`text-center font-bold ${getGradeColor(calculateAverage(student.grades), true) || 'text-foreground'}`}>
                              {calculateAverage(student.grades)}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
                                  onClick={() => setEditingStudent(student)}
                                  title="Editar Aluno"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => confirmDeleteStudent(student.id)}
                                  title="Remover Aluno"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
