import React, { useState, useEffect } from 'react';
import { Plus, Users, BookOpen, School, GraduationCap, ChevronLeft, Trash2, UserPlus, Save, Search, Download, Pencil, Home, LogOut, Star, Layers } from 'lucide-react';
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
import { LoginScreen } from '@/components/login-screen';
import { auth, db, logout } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, onSnapshot, doc, setDoc, deleteDoc, query, where } from 'firebase/firestore';
import { toast } from 'sonner';

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
  userId: string;
  school: string;
  level: string;
  section: string;
  subject: string;
  academicYear: string;
  isDirector: boolean;
  students: Student[];
  createdAt?: string;
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
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);
  const [hasSeenWelcome, setHasSeenWelcome] = useLocalStorage<boolean>('edugestao-has-seen-welcome', false);
  
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isAuthReady || !user) {
      setClasses([]);
      return;
    }

    const q = query(collection(db, 'classes'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const classesData: ClassData[] = [];
      snapshot.forEach((doc) => {
        classesData.push({ id: doc.id, ...doc.data() } as ClassData);
      });
      setClasses(classesData);
    }, (error) => {
      console.error("Error fetching classes:", error);
    });

    return () => unsubscribe();
  }, [user, isAuthReady]);
  
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
    academicYear: new Date().getFullYear().toString(),
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

  const handleAddClass = async () => {
    if (!newClass.level || !newClass.academicYear || !user) return;
    
    const newClassData: ClassData = {
      id: crypto.randomUUID(),
      userId: user.uid,
      school: newClass.school || 'EduGestão',
      section: newClass.section || 'A',
      subject: newClass.subject || 'Geral',
      ...newClass,
      students: [],
      createdAt: new Date().toISOString()
    };
    
    try {
      await setDoc(doc(db, 'classes', newClassData.id), newClassData);
      toast.success('Turma guardada com sucesso!');
      setNewClass({ 
        school: newClass.school || '', 
        level: selectedLevel || '', 
        section: '', 
        subject: '', 
        academicYear: newClass.academicYear || new Date().getFullYear().toString(),
        isDirector: false 
      });
    } catch (error) {
      console.error("Error adding class:", error);
      toast.error('Erro ao guardar turma.');
    }
  };

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [levelToDelete, setLevelToDelete] = useState<{level: string, year: string} | null>(null);

  const handleDeleteLevel = async () => {
    if (!levelToDelete || !user) return;

    try {
      const classesToDelete = classes.filter(c => c.level === levelToDelete.level && c.academicYear === levelToDelete.year);
      const deletePromises = classesToDelete.map(c => deleteDoc(doc(db, 'classes', c.id)));
      await Promise.all(deletePromises);
      toast.success('Classe eliminada com sucesso!');
      setIsDeleteDialogOpen(false);
      setLevelToDelete(null);
    } catch (error) {
      console.error("Error deleting level:", error);
      toast.error('Erro ao eliminar classe.');
    }
  };

  const handleUpdateClass = async () => {
    if (!editingClass || !editingClass.level || !editingClass.academicYear || !user) return;

    try {
      await setDoc(doc(db, 'classes', editingClass.id), editingClass);
      setEditingClass(null);
    } catch (error) {
      console.error("Error updating class:", error);
    }
  };

  const handleAddStudent = async () => {
    if (!selectedClass || !newStudent.name || !user) return;

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

    const updatedClass = { ...selectedClass, students: [...selectedClass.students, student] };

    try {
      await setDoc(doc(db, 'classes', selectedClass.id), updatedClass);
      toast.success('Aluno guardado com sucesso!');
      setNewStudent({ studentNumber: '', name: '', dob: '', birthplace: '', address: '', parentName: '', parentProfession: '', parentAddress: '', parentContact: '' });
    } catch (error) {
      console.error("Error adding student:", error);
      toast.error('Erro ao guardar aluno.');
    }
  };

  const handleUpdateStudent = async () => {
    if (!selectedClass || !editingStudent || !editingStudent.name || !user) return;

    const updatedClass = {
      ...selectedClass,
      students: selectedClass.students.map(s => s.id === editingStudent.id ? editingStudent : s)
    };

    try {
      await setDoc(doc(db, 'classes', selectedClass.id), updatedClass);
      setEditingStudent(null);
    } catch (error) {
      console.error("Error updating student:", error);
    }
  };

  const updateGrade = async (studentId: string, field: keyof Grades, value: string) => {
    if (!selectedClass || !user) return;
    
    const updatedClass = {
      ...selectedClass,
      students: selectedClass.students.map(s => {
        if (s.id === studentId) {
          return { ...s, grades: { ...s.grades, [field]: value } };
        }
        return s;
      })
    };
    
    try {
      await setDoc(doc(db, 'classes', selectedClass.id), updatedClass);
    } catch (error) {
      console.error("Error updating grade:", error);
    }
  };

  const confirmDeleteStudent = (studentId: string) => {
    setStudentToDelete(studentId);
  };

  const deleteStudent = async () => {
    if (!selectedClass || !studentToDelete || !user) return;
    
    const updatedClass = {
      ...selectedClass,
      students: selectedClass.students.filter(s => s.id !== studentToDelete)
    };
    
    try {
      await setDoc(doc(db, 'classes', selectedClass.id), updatedClass);
      setStudentToDelete(null);
    } catch (error) {
      console.error("Error deleting student:", error);
    }
  };

  const deleteClass = async (classId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Tem certeza que deseja remover esta turma? Todos os alunos serão apagados.')) return;
    
    try {
      await deleteDoc(doc(db, 'classes', classId));
      if (selectedClassId === classId) setSelectedClassId(null);
    } catch (error) {
      console.error("Error deleting class:", error);
    }
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

  const sortedClasses = [...classes].sort((a, b) => {
    if (a.isDirector && !b.isDirector) return -1;
    if (!a.isDirector && b.isDirector) return 1;

    const getLevelNum = (levelStr: string) => parseInt(levelStr.replace(/\D/g, '')) || 0;
    const levelA = getLevelNum(a.level);
    const levelB = getLevelNum(b.level);
    
    if (levelA !== levelB) {
      return levelA - levelB;
    }

    return a.section.localeCompare(b.section);
  });

  const levels = Array.from(
    new Map<string, { level: string; year: string }>(
      classes.map(c => [`${c.level}-${c.academicYear}`, { level: c.level, year: c.academicYear }])
    ).values()
  ).sort((a, b) => {
    const getLevelNum = (str: string) => parseInt(str.replace(/\D/g, '')) || 0;
    if (a.level !== b.level) {
      return getLevelNum(a.level) - getLevelNum(b.level);
    }
    return b.year.localeCompare(a.year);
  });

  const filteredByLevel = selectedLevel 
    ? sortedClasses.filter(c => c.level === selectedLevel)
    : sortedClasses;

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!hasSeenWelcome) {
    return (
      <div className="min-h-screen text-foreground font-sans">
        <WelcomeScreen onStart={() => setHasSeenWelcome(true)} user={user} />
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

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
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={logout} title="Terminar Sessão" className="text-muted-foreground hover:text-destructive">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!selectedClassId ? (
          // Dashboard - List of Classes
          <div className="space-y-6">
            {selectedLevel ? (
              <div className="space-y-4">
                {/* Class Card with header and back button */}
                <div className="bg-card/40 p-5 sm:p-6 rounded-2xl border border-border/50 flex items-center justify-between gap-4">
                  <div className="flex flex-col min-w-0 text-left">
                    <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground truncate">
                      {selectedLevel}
                    </h2>
                    <p className="text-muted-foreground text-xs sm:text-sm mt-1">
                      Gestão das turmas e disciplinas da classe.
                    </p>
                  </div>

                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setSelectedLevel(null)} 
                    className="h-10 w-10 sm:w-auto sm:px-4 border border-border/80 bg-card/20 hover:bg-card/40 text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all rounded-xl shadow-sm flex items-center justify-center sm:gap-1.5 font-semibold text-sm cursor-pointer shrink-0"
                    title="Voltar para Minhas Classes"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span className="hidden sm:inline">Voltar</span>
                  </Button>
                </div>

                {/* Floating FAB to Add New Turma */}
                <Dialog open={isAddClassOpen} onOpenChange={(open) => {
                  setIsAddClassOpen(open);
                  if (open) {
                    setNewClass(prev => ({ ...prev, level: selectedLevel }));
                  }
                }}>
                  <DialogTrigger render={
                    <Button 
                      className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 z-50 rounded-full w-14 h-14 p-0 bg-primary hover:bg-primary/95 text-primary-foreground shadow-lg shadow-primary/25 border border-primary-foreground/10 hover:shadow-xl hover:shadow-primary/35 ring-4 ring-primary/5 hover:ring-primary/15 transition-all duration-300 hover:scale-110 active:scale-95 cursor-pointer flex items-center justify-center" 
                      title="Adicionar Nova Turma"
                    >
                      <Plus className="h-7 w-7" />
                    </Button>
                  } />
                  <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle>Adicionar Nova Turma</DialogTitle>
                      <DialogDescription>
                        Crie uma nova turma para a {selectedLevel}.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="school">Escola / Colégio</Label>
                        <Input id="school" value={newClass.school || ''} onChange={e => setNewClass({...newClass, school: e.target.value})} placeholder="Ex: Escola Secundária" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="section">Turma <span className="text-red-500">*</span></Label>
                          <Input id="section" value={newClass.section || ''} onChange={e => setNewClass({...newClass, section: e.target.value})} placeholder="Ex: A" />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="subject">Disciplina <span className="text-red-500">*</span></Label>
                          <Input id="subject" value={newClass.subject || ''} onChange={e => setNewClass({...newClass, subject: e.target.value})} placeholder="Ex: Matemática" />
                        </div>
                      </div>
                    </div>
                    <DialogFooter className="gap-2 sm:gap-0 mt-2">
                      <Button variant="outline" className="rounded-xl px-4 h-10 text-sm font-medium transition-all" onClick={() => setIsAddClassOpen(false)}>Cancelar</Button>
                      <Button onClick={handleAddClass} className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl px-5 h-10 text-sm font-semibold shadow-sm transition-all" disabled={!newClass.level || !newClass.academicYear}>
                        Guardar Turma
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card/40 p-6 rounded-2xl border border-border/50">
                <div className="flex flex-col">
                  <h2 className="text-3xl font-light tracking-tight">Minhas Classes</h2>
                  <p className="text-muted-foreground mt-1">Organize as suas turmas por classe e lecionação.</p>
                </div>
                
                <div className="flex items-center gap-3 w-full sm:w-auto mt-2 sm:mt-0">
                  {/* Floating FAB to Add New Class */}
                  <Dialog open={isAddClassOpen} onOpenChange={setIsAddClassOpen}>
                    <DialogTrigger render={
                      <Button 
                        className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 z-50 rounded-full w-14 h-14 p-0 bg-primary hover:bg-primary/95 text-primary-foreground shadow-lg shadow-primary/25 border border-primary-foreground/10 hover:shadow-xl hover:shadow-primary/35 ring-4 ring-primary/5 hover:ring-primary/15 transition-all duration-300 hover:scale-110 active:scale-95 cursor-pointer flex items-center justify-center" 
                        title="Adicionar Nova Classe"
                      >
                        <Plus className="h-7 w-7" />
                      </Button>
                    } />
                    <DialogContent className="sm:max-w-[425px]">
                      <DialogHeader>
                        <DialogTitle>Adicionar Nova Classe</DialogTitle>
                        <DialogDescription>
                          Defina o nível e o ano letivo para organizar as turmas.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                          <Label htmlFor="level">Classe / Nível <span className="text-red-500">*</span></Label>
                          <Input id="level" value={newClass.level || ''} onChange={e => setNewClass({...newClass, level: e.target.value})} placeholder="Ex: 7ª Classe" />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="academicYear">Ano Letivo <span className="text-red-500">*</span></Label>
                          <Input id="academicYear" value={newClass.academicYear || ''} onChange={e => setNewClass({...newClass, academicYear: e.target.value})} placeholder="Ex: 2024" />
                        </div>
                      </div>
                      <DialogFooter className="gap-2 sm:gap-0 mt-2">
                        <Button variant="outline" className="rounded-xl px-4 h-10 text-sm font-medium transition-all" onClick={() => setIsAddClassOpen(false)}>Cancelar</Button>
                        <Button onClick={handleAddClass} className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl px-5 h-10 text-sm font-semibold shadow-sm transition-all" disabled={!newClass.level || !newClass.academicYear}>
                          Guardar Classe
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            )}

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
                        <Input id="edit-school" value={editingClass.school || ''} onChange={e => setEditingClass({...editingClass, school: e.target.value})} placeholder="Ex: Escola Secundária Central" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="edit-level">Classe</Label>
                          <Input id="edit-level" value={editingClass.level || ''} onChange={e => setEditingClass({...editingClass, level: e.target.value})} placeholder="Ex: 7ª Classe" />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="edit-year">Ano Letivo</Label>
                          <Input id="edit-year" value={editingClass.academicYear || ''} onChange={e => setEditingClass({...editingClass, academicYear: e.target.value})} placeholder="Ex: 2024" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="edit-section">Turma</Label>
                          <Input id="edit-section" value={editingClass.section || ''} onChange={e => setEditingClass({...editingClass, section: e.target.value})} placeholder="Ex: A" />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="edit-subject">Disciplina</Label>
                          <Input id="edit-subject" value={editingClass.subject || ''} onChange={e => setEditingClass({...editingClass, subject: e.target.value})} placeholder="Ex: Matemática" />
                        </div>
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
                    <Button variant="outline" className="rounded-xl px-4 h-10 text-sm font-medium transition-all" onClick={() => setEditingClass(null)}>Cancelar</Button>
                    <Button onClick={handleUpdateClass} className="bg-primary hover:bg-primary/95 text-primary-foreground rounded-xl px-5 h-10 text-sm font-semibold shadow-sm transition-all" disabled={!editingClass?.level || !editingClass?.academicYear}>Guardar Alterações</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-destructive">
                      <Trash2 className="h-5 w-5" />
                      Eliminar Classe
                    </DialogTitle>
                    <DialogDescription>
                      Esta ação não pode ser desfeita. Isto irá eliminar permanentemente todas as <strong>turmas</strong>, <strong>alunos</strong> e <strong>notas</strong> associadas à {levelToDelete?.level} ({levelToDelete?.year}).
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" className="rounded-xl px-4 h-10 text-sm font-medium transition-all" onClick={() => setIsDeleteDialogOpen(false)}>Cancelar</Button>
                    <Button variant="destructive" className="rounded-xl px-5 h-10 text-sm font-semibold shadow-sm transition-all" onClick={handleDeleteLevel}>
                      Sim, Eliminar Tudo
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

            {classes.length === 0 ? (
              <div className="text-center py-20 bg-card rounded-2xl border border-dashed border-border p-6 flex flex-col items-center justify-center">
                <div className="mx-auto w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4">
                  <BookOpen className="h-8 w-8" />
                </div>
                <h3 className="text-lg font-medium text-foreground">Nenhuma classe adicionada</h3>
                <p className="text-muted-foreground mt-1 max-w-sm mx-auto text-sm">Comece por adicionar a sua primeira classe para gerir as turmas e alunos.</p>
                <Button onClick={() => setIsAddClassOpen(true)} className="mt-6 rounded-xl bg-primary hover:bg-primary/95 text-primary-foreground px-6 h-11 text-sm font-bold shadow-md transition-all flex items-center justify-center gap-2 hover:scale-[1.02] cursor-pointer">
                  <Plus className="h-4 w-4" /> Adicionar Classe
                </Button>
              </div>
            ) : !selectedLevel ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {levels.map((item) => {
                  const levelKey = `${item.level}-${item.year}`;
                  const classesInLevel = classes.filter(c => c.level === item.level && c.academicYear === item.year);
                  const hasDirector = classesInLevel.some(c => c.isDirector);
                  return (
                    <Card 
                      key={levelKey} 
                      className={`relative overflow-hidden border-border bg-card flex flex-col items-center justify-center p-8 text-center min-h-[220px] ${hasDirector ? 'border-primary/40' : ''}`}
                    >
                      {/* Actions */}
                      <div className="absolute top-4 left-4 z-20">
                        <Button 
                          variant="ghost" 
                          className="h-9 px-3 gap-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full transition-colors flex items-center"
                          onClick={(e) => {
                            e.stopPropagation();
                            setLevelToDelete({ level: item.level, year: item.year });
                            setIsDeleteDialogOpen(true);
                          }}
                          title="Eliminar Classe"
                        >
                          <Trash2 className="h-5 w-5" />
                          <span className="text-xs font-bold uppercase tracking-wider">Apagar</span>
                        </Button>
                      </div>

                      <div className="absolute top-4 right-4 z-20">
                        <Button 
                          variant="ghost" 
                          className="h-9 px-3 gap-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full transition-colors flex items-center"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLevel(item.level);
                          }}
                          title="Gerir Turmas"
                        >
                          <Pencil className="h-5 w-5" />
                          <span className="text-xs font-bold uppercase tracking-wider">Editar</span>
                        </Button>
                      </div>

                      {/* Background Logo Effect */}
                      <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] dark:opacity-[0.05] pointer-events-none transition-transform duration-500 blur-[1px]">
                         <GraduationCap className="w-48 h-48 sm:w-64 sm:h-64 rotate-12" />
                      </div>

                      <div className="relative z-10 w-full h-full flex flex-col items-center justify-center">
                        <h3 className="text-3xl font-bold tracking-tight text-foreground">{item.level}</h3>
                        <p className="text-muted-foreground text-sm mt-3 font-medium bg-muted/50 px-4 py-1.5 rounded-full inline-block border border-border/50">
                          {classesInLevel.length} {classesInLevel.length === 1 ? 'Turma' : 'Turmas'}
                        </p>
                      </div>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredByLevel.map((c) => (
                  <Card 
                    key={c.id} 
                    className={`cursor-pointer hover:shadow-md transition-all duration-200 group ${c.isDirector ? 'border-primary/40 bg-[var(--card-director)] shadow-sm' : 'border-border hover:border-primary/50 bg-card'}`}
                    onClick={() => setSelectedClassId(c.id)}
                  >
                    <CardHeader className="pb-3 px-6 pt-6">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-xl font-bold text-foreground group-hover:text-primary transition-colors">
                            Turma {c.section}
                          </CardTitle>
                          <div className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                            <BookOpen className="h-3 w-3" /> {c.subject}
                          </div>
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
                      <CardDescription className="flex items-center gap-1.5 mt-1.5">
                        <School className="h-3.5 w-3.5" /> {c.school}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="px-6 pb-6 pt-0">
                      <div className="flex items-center justify-between mt-4">
                        <div className="flex items-center text-sm text-muted-foreground">
                          <Users className="h-4 w-4 mr-1.5" />
                          <span>{c.students.length} Alunos</span>
                        </div>
                        {c.isDirector && (
                          <div className="bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                            <Star className="h-2.5 w-2.5 fill-current" /> Diretor
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
            <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
              <div className="flex items-center justify-between mb-6">
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
                <Button variant="outline" size="sm" onClick={() => setSelectedClassId(null)} className="text-muted-foreground hover:text-foreground">
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  <span>Voltar</span>
                </Button>
              </div>
              
              <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 w-full md:w-auto">
                <div className="relative flex-1 md:w-64 order-2 md:order-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Procurar aluno..." 
                    className="pl-9 bg-muted/50 border-border"
                    value={searchQuery || ''}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2 sm:gap-3 order-1 md:order-2 w-full md:w-auto justify-end">
                  <Button variant="outline" onClick={exportToExcel} className="shadow-sm shrink-0 flex-1 md:flex-none" title="Exportar para Excel" disabled={selectedClass.students.length === 0}>
                    <Download className="h-4 w-4 sm:mr-2" />
                    <span className="inline">Exportar</span>
                  </Button>
                  <Dialog open={isAddStudentOpen} onOpenChange={setIsAddStudentOpen}>
                    <DialogTrigger render={<Button className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm shrink-0 flex-1 md:flex-none" />}>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Adicionar Aluno
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
                          <Input id="studentNumber" value={newStudent.studentNumber || ''} onChange={e => setNewStudent({...newStudent, studentNumber: e.target.value})} placeholder="Ex: 1" />
                        </div>
                        <div className="grid gap-2 col-span-3">
                          <Label htmlFor="studentName">Nome Completo <span className="text-red-500">*</span></Label>
                          <Input id="studentName" value={newStudent.name || ''} onChange={e => setNewStudent({...newStudent, name: e.target.value})} placeholder="Ex: João Manuel Silva" />
                        </div>
                      </div>
                      
                      {selectedClass.isDirector && (
                        <>
                          <div className="grid gap-2">
                            <Label htmlFor="dob">Data de Nascimento</Label>
                            <Input id="dob" type="date" value={newStudent.dob || ''} onChange={e => setNewStudent({...newStudent, dob: e.target.value})} />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="birthplace">Local de Nascimento</Label>
                            <Input id="birthplace" value={newStudent.birthplace || ''} onChange={e => setNewStudent({...newStudent, birthplace: e.target.value})} placeholder="Ex: Lisboa" />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="address">Morada do Aluno</Label>
                            <Input id="address" value={newStudent.address || ''} onChange={e => setNewStudent({...newStudent, address: e.target.value})} placeholder="Ex: Bairro Central, Rua 2" />
                          </div>
                          
                          <div className="my-2 border-t border-border pt-4">
                            <h4 className="text-sm font-semibold text-foreground mb-3">Dados do Encarregado de Educação</h4>
                            <div className="grid gap-4">
                              <div className="grid gap-2">
                                <Label htmlFor="parentName">Nome do Pai / Encarregado</Label>
                                <Input id="parentName" value={newStudent.parentName || ''} onChange={e => setNewStudent({...newStudent, parentName: e.target.value})} placeholder="Nome completo" />
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                  <Label htmlFor="parentProfession">Profissão</Label>
                                  <Input id="parentProfession" value={newStudent.parentProfession || ''} onChange={e => setNewStudent({...newStudent, parentProfession: e.target.value})} placeholder="Ex: Professor" />
                                </div>
                                <div className="grid gap-2">
                                  <Label htmlFor="parentContact">Contacto</Label>
                                  <Input id="parentContact" value={newStudent.parentContact || ''} onChange={e => setNewStudent({...newStudent, parentContact: e.target.value})} placeholder="Ex: 9XX XXX XXX" />
                                </div>
                              </div>
                              <div className="grid gap-2">
                                <Label htmlFor="parentAddress">Morada do Encarregado</Label>
                                <Input id="parentAddress" value={newStudent.parentAddress || ''} onChange={e => setNewStudent({...newStudent, parentAddress: e.target.value})} placeholder="Se diferente da morada do aluno" />
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
                            <Input id="edit-studentName" value={editingStudent.name || ''} onChange={e => setEditingStudent({...editingStudent, name: e.target.value})} placeholder="Ex: João Silva" />
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
                                    value={student.grades.acs1 || ''} 
                                    onChange={(e) => updateGrade(student.id, 'acs1', e.target.value)}
                                    placeholder="-"
                                  />
                                </TableCell>
                                <TableCell>
                                  <Input 
                                    className={`h-8 w-16 mx-auto text-center px-1 border-transparent hover:border-border focus:border-primary bg-transparent hover:bg-background transition-all font-medium ${getGradeColor(student.grades.acs2)}`}
                                    value={student.grades.acs2 || ''} 
                                    onChange={(e) => updateGrade(student.id, 'acs2', e.target.value)}
                                    placeholder="-"
                                  />
                                </TableCell>
                                <TableCell>
                                  <Input 
                                    className={`h-8 w-16 mx-auto text-center px-1 border-transparent hover:border-border focus:border-primary bg-transparent hover:bg-background transition-all font-medium ${getGradeColor(student.grades.acs3)}`}
                                    value={student.grades.acs3 || ''} 
                                    onChange={(e) => updateGrade(student.id, 'acs3', e.target.value)}
                                    placeholder="-"
                                  />
                                </TableCell>
                                <TableCell>
                                  <Input 
                                    className={`h-8 w-16 mx-auto text-center px-1 border-transparent hover:border-border focus:border-primary bg-transparent hover:bg-background transition-all font-medium ${getGradeColor(student.grades.ap)}`}
                                    value={student.grades.ap || ''} 
                                    onChange={(e) => updateGrade(student.id, 'ap', e.target.value)}
                                    placeholder="-"
                                  />
                                </TableCell>
                                <TableCell>
                                  <Input 
                                    className={`h-8 w-16 mx-auto text-center px-1 border-transparent hover:border-border focus:border-primary bg-transparent hover:bg-background transition-all font-medium ${getGradeColor(student.grades.exame)}`}
                                    value={student.grades.exame || ''} 
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
                                value={student.grades.acs1 || ''} 
                                onChange={(e) => updateGrade(student.id, 'acs1', e.target.value)}
                                placeholder="-"
                              />
                            </TableCell>
                            <TableCell>
                              <Input 
                                className={`h-8 w-16 mx-auto text-center px-1 border-transparent hover:border-border focus:border-primary bg-transparent hover:bg-background transition-all font-medium ${getGradeColor(student.grades.acs2)}`}
                                value={student.grades.acs2 || ''} 
                                onChange={(e) => updateGrade(student.id, 'acs2', e.target.value)}
                                placeholder="-"
                              />
                            </TableCell>
                            <TableCell>
                              <Input 
                                className={`h-8 w-16 mx-auto text-center px-1 border-transparent hover:border-border focus:border-primary bg-transparent hover:bg-background transition-all font-medium ${getGradeColor(student.grades.acs3)}`}
                                value={student.grades.acs3 || ''} 
                                onChange={(e) => updateGrade(student.id, 'acs3', e.target.value)}
                                placeholder="-"
                              />
                            </TableCell>
                            <TableCell>
                              <Input 
                                className={`h-8 w-16 mx-auto text-center px-1 border-transparent hover:border-border focus:border-primary bg-transparent hover:bg-background transition-all font-medium ${getGradeColor(student.grades.ap)}`}
                                value={student.grades.ap || ''} 
                                onChange={(e) => updateGrade(student.id, 'ap', e.target.value)}
                                placeholder="-"
                              />
                            </TableCell>
                            <TableCell>
                              <Input 
                                className={`h-8 w-16 mx-auto text-center px-1 border-transparent hover:border-border focus:border-primary bg-transparent hover:bg-background transition-all font-medium ${getGradeColor(student.grades.exame)}`}
                                value={student.grades.exame || ''} 
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
