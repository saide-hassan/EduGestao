import React, { useState, useEffect } from 'react';
import { Plus, Users, BookOpen, School, GraduationCap, ChevronLeft, Trash2, UserPlus, Save, Search, Download, Pencil, Home, LogOut, Star, Layers, Sun, Moon, Upload, FileSpreadsheet, FileText, UploadCloud, Check, AlertTriangle, X, ChevronDown, Cloud } from 'lucide-react';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import { motion } from 'motion/react';
import { useTheme } from '@/components/theme-provider';
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
import { auth, db, logout, getCachedAccessToken, setCachedAccessToken, signInWithGoogle } from '@/lib/firebase';
import { onAuthStateChanged, User, GoogleAuthProvider } from 'firebase/auth';
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
  trimesterGrades?: {
    1?: Grades;
    2?: Grades;
    3?: Grades;
  };
};

const emptyGrades = (): Grades => ({ acs1: '', acs2: '', acs3: '', ap: '', exame: '' });

const getStudentGrades = (student: Student, trimester: '1' | '2' | '3'): Grades => {
  if (student.trimesterGrades && student.trimesterGrades[trimester]) {
    return student.trimesterGrades[trimester]!;
  }
  if (trimester === '1') {
    return student.grades || emptyGrades();
  }
  return emptyGrades();
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
  isPlaceholder?: boolean;
  students: Student[];
  createdAt?: string;
};

const customRound = (value: number): string => {
  if (isNaN(value)) return '-';
  const integerPart = Math.floor(value);
  const decimalStr = value.toFixed(10);
  const dotIndex = decimalStr.indexOf('.');
  if (dotIndex === -1) {
    return String(integerPart);
  }
  const tenthsDigit = parseInt(decimalStr.charAt(dotIndex + 1), 10);
  if (tenthsDigit >= 5) {
    return String(integerPart + 1);
  } else {
    return String(integerPart);
  }
};

const calculateAcsAverage = (grades: Grades) => {
  const values = [grades.acs1, grades.acs2, grades.acs3]
    .map(v => parseFloat((v || '').replace(',', '.')))
    .filter(v => !isNaN(v));
  if (values.length === 0) return '-';
  const sum = values.reduce((acc, curr) => acc + curr, 0);
  const rawAverage = sum / values.length;
  return customRound(rawAverage);
};

const calculateGeneralAverage = (grades: Grades) => {
  const acsAvgStr = calculateAcsAverage(grades);
  if (acsAvgStr === '-') return '-';
  const acsAvg = parseFloat(acsAvgStr.replace(',', '.'));
  const apVal = parseFloat((grades.ap || '').replace(',', '.'));
  if (isNaN(acsAvg) || isNaN(apVal)) return '-';
  const rawAverage = (acsAvg + apVal) / 2;
  return customRound(rawAverage);
};

const calculateAverage = (grades: Grades) => {
  return calculateGeneralAverage(grades);
};

type ApoioAlertStatus = 'red' | 'orange' | 'none';

const getApoioAlertStatus = (student: Student, trimester: '1' | '2' | '3'): ApoioAlertStatus => {
  const grades = getStudentGrades(student, trimester);
  
  const parseGrade = (val: string | undefined): number | null => {
    if (!val || val.trim() === '-' || val.trim() === '') return null;
    const num = parseFloat(val.replace(',', '.'));
    return isNaN(num) ? null : num;
  };

  const acs1Val = parseGrade(grades.acs1);
  const acs2Val = parseGrade(grades.acs2);

  const mediaGeralStr = calculateGeneralAverage(grades);
  const mediaGeralVal = mediaGeralStr !== '-' ? parseFloat(mediaGeralStr.replace(',', '.')) : null;

  // Rule 3: "se a média geral for abaixo de 10 o alerta deve ser vermelho"
  if (mediaGeralVal !== null && mediaGeralVal < 10) {
    return 'red';
  }

  // Rule 4: "e se o aluno tiver média geral 10, 11, ou 12, enquanto tem notas de ACS 1 e 2 negativas, o alerta passa a ser laranja."
  if (mediaGeralVal !== null && mediaGeralVal >= 10 && mediaGeralVal <= 12) {
    const acs1Neg = acs1Val !== null && acs1Val < 10;
    const acs2Neg = acs2Val !== null && acs2Val < 10;
    if (acs1Neg && acs2Neg) {
      return 'orange';
    }
  }

  // Rule 2: "na ACS 2 se o aluno tirar uma nota positiva, o alerta deve passar para laranja"
  // Here, ACS 1 is negative and ACS 2 is positive (>= 10)
  if (acs1Val !== null && acs1Val < 10 && acs2Val !== null && acs2Val >= 10) {
    return 'orange';
  }

  // Rule 1: "Os alertas de apoio devem aparecer logo na ACS 1 que o aluno tirar negativa"
  // Default color for active alert on negative ACS 1 is red
  if (acs1Val !== null && acs1Val < 10) {
    return 'red';
  }

  return 'none';
};

const getGradeColor = (val: string, isAverage = false) => {
  const num = parseFloat(val.replace(',', '.'));
  if (isNaN(num)) return '';
  
  if (num < 10) return 'text-red-500 dark:text-red-400 font-semibold';
  if (num >= 10 && num <= 13) return 'text-yellow-500 dark:text-yellow-400 font-semibold';
  if (num >= 14) return 'text-green-500 dark:text-green-400 font-bold';
  
  return '';
};

const renderGradeIndicator = (grade: string | undefined | null) => {
  if (!grade) return null;
  const val = parseFloat(grade.replace(',', '.'));
  if (isNaN(val)) return null;
  const pct = Math.min(100, Math.max(0, (val / 20) * 100));
  
  let barColorClass = 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]';
  if (val >= 14) {
    barColorClass = 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]';
  } else if (val >= 10) {
    barColorClass = 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.5)]';
  }
  
  return (
    <div className="flex flex-col items-center gap-1 mt-1 w-full max-w-[56px] mx-auto select-none">
      <div className="w-full h-1 bg-border/40 rounded-full overflow-hidden">
        <div className={`h-full ${barColorClass} transition-all duration-300`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[9px] font-mono text-muted-foreground/60 leading-none">
        {val}/20
      </span>
    </div>
  );
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

const ACCENT_COLORS = [
  { border: 'border-l-purple-500', text: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-500/10' },
  { border: 'border-l-indigo-500', text: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-500/10' },
  { border: 'border-l-pink-500', text: 'text-pink-600 dark:text-pink-400', bg: 'bg-pink-500/10' },
  { border: 'border-l-violet-500', text: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-500/10' },
  { border: 'border-l-fuchsia-500', text: 'text-fuchsia-600 dark:text-fuchsia-400', bg: 'bg-fuchsia-500/10' },
  { border: 'border-l-rose-500', text: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-500/10' },
  { border: 'border-l-amber-500', text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10' },
  { border: 'border-l-teal-500', text: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-500/10' },
  { border: 'border-l-blue-500', text: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10' },
];

const getAccentColor = (key: string) => {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = key.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % ACCENT_COLORS.length;
  return ACCENT_COLORS[index];
};

const getInitials = (currentUser: User) => {
  if (currentUser.displayName) {
    const names = currentUser.displayName.trim().split(/\s+/);
    if (names.length >= 2) {
      return (names[0][0] + names[names.length - 1][0]).toUpperCase();
    }
    return names[0].substring(0, 2).toUpperCase();
  }
  if (currentUser.email) {
    const parts = currentUser.email.split('@')[0];
    return parts.substring(0, 2).toUpperCase();
  }
  return 'U';
};

export default function App() {
  const { theme, setTheme } = useTheme();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
  
  const isDark = theme === "dark" || (theme === "system" && typeof window !== 'undefined' && window.matchMedia("(prefers-color-scheme: dark)").matches);

  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);
  const [selectedLevelYear, setSelectedLevelYear] = useState<string | null>(null);
  const [selectedTrimester, setSelectedTrimester] = useState<'1' | '2' | '3'>('1');
  const [activeTab, setActiveTab] = useState<'avaliacoes' | 'dados'>('avaliacoes');
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
  const [highlightedStudentId, setHighlightedStudentId] = useState<string | null>(null);
  const [alertActiveForClass, setAlertActiveForClass] = useState<string | null>(null);
  const [showApoioBanner, setShowApoioBanner] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  useEffect(() => {
    if (selectedClassId) {
      if (alertActiveForClass !== selectedClassId) {
        setAlertActiveForClass(selectedClassId);
        setShowApoioBanner(true);
      }
    } else {
      setAlertActiveForClass(null);
      setShowApoioBanner(false);
    }
  }, [selectedClassId, alertActiveForClass]);

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

  // Import Students States
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importError, setImportError] = useState('');
  const [previewStudents, setPreviewStudents] = useState<Student[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importMode, setImportMode] = useState<'file' | 'paste'>('file');
  const [pastedNames, setPastedNames] = useState('');

  const selectedClass = classes.find(c => c.id === selectedClassId);

  const handleAddClass = async () => {
    if (!newClass.level || !newClass.academicYear || !user) return;
    
    // If selectedLevel is not set, we are creating a new level placeholder (blank class level)
    const isPlaceholder = !selectedLevel;
    
    const newClassData: ClassData = {
      id: crypto.randomUUID(),
      userId: user.uid,
      school: newClass.school || 'EduGestão',
      section: isPlaceholder ? '' : (newClass.section ? newClass.section.trim() : 'A'),
      subject: isPlaceholder ? '' : (newClass.subject ? newClass.subject.trim() : 'Geral'),
      academicYear: newClass.academicYear || new Date().getFullYear().toString(),
      level: newClass.level.trim(),
      isDirector: newClass.isDirector,
      isPlaceholder,
      students: [],
      createdAt: new Date().toISOString()
    };
    
    try {
      await setDoc(doc(db, 'classes', newClassData.id), newClassData);
      if (isPlaceholder) {
        toast.success('Classe criada com sucesso!');
      } else {
        toast.success('Turma guardada com sucesso!');
      }
      setNewClass({ 
        school: newClass.school || '', 
        level: selectedLevel || '', 
        section: '', 
        subject: '', 
        academicYear: newClass.academicYear || new Date().getFullYear().toString(),
        isDirector: false 
      });
      setIsAddClassOpen(false);
    } catch (error) {
      console.error("Error adding class:", error);
      toast.error('Erro ao guardar.');
    }
  };

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [levelToDelete, setLevelToDelete] = useState<{level: string, year: string} | null>(null);
  const [classToDelete, setClassToDelete] = useState<string | null>(null);

  const handleDeleteLevel = async () => {
    if (!levelToDelete || !user) return;

    try {
      const targetLevel = (levelToDelete.level || '').toString().trim().toLowerCase();
      const targetYear = (levelToDelete.year || '').toString().trim().toLowerCase();

      // Normalize comparison to prevent mismatches from spacing or casing
      const classesToDelete = classes.filter(c => 
        (c.level || '').toString().trim().toLowerCase() === targetLevel && 
        (c.academicYear || '').toString().trim().toLowerCase() === targetYear
      );

      if (classesToDelete.length === 0) {
        toast.error('Nenhuma turma encontrada nesta classe para eliminar.');
        setIsDeleteDialogOpen(false);
        setLevelToDelete(null);
        return;
      }

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

  const confirmDeleteClass = async () => {
    if (!classToDelete || !user) return;

    try {
      await deleteDoc(doc(db, 'classes', classToDelete));
      if (selectedClassId === classToDelete) setSelectedClassId(null);
      toast.success('Turma eliminada com sucesso!');
      setClassToDelete(null);
    } catch (error) {
      console.error("Error deleting class:", error);
      toast.error('Erro ao eliminar turma.');
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

  const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsImporting(true);
    setImportError('');
    setPreviewStudents([]);
    
    try {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const data = new Uint8Array(event.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
            
            if (!jsonData || jsonData.length === 0) {
              setImportError('O ficheiro está vazio.');
              setIsImporting(false);
              return;
            }
            
            // Normalize columns to lower-case and no accents
            const headers = (jsonData[0] || []).map(h => 
              String(h || '').trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            );
            
            const findColIndex = (names: string[]) => {
              return headers.findIndex(h => names.some(n => h.includes(n)));
            };
            
            const numberIdx = findColIndex(['nº', 'no', 'num', 'ordem', 'id', 'numero']);
            const nameIdx = findColIndex(['nome', 'aluno', 'estudante', 'completo']);
            const dobIdx = findColIndex(['nascimento', 'data', 'dob']);
            const birthplaceIdx = findColIndex(['naturalidade', 'local']);
            const addressIdx = findColIndex(['morada', 'endereco', 'residencia']);
            
            const imported: Student[] = [];
            let startRow = 1;
            
            let finalNameIdx = nameIdx;
            if (finalNameIdx === -1) {
              finalNameIdx = 0; // fallback to column 0 if row 0 has name, or check if row 0 itself is first student
            }
            
            const firstRowContainsNames = jsonData[0] && jsonData[0].some(cell => 
              String(cell || '').toLowerCase().includes('joao') || 
              String(cell || '').toLowerCase().includes('maria') || 
              String(cell || '').toLowerCase().includes('silva')
            );
            
            if (firstRowContainsNames) {
              startRow = 0;
            }
            
            for (let i = startRow; i < jsonData.length; i++) {
              const row = jsonData[i];
              if (!row || row.length === 0) continue;
              
              const nameValue = row[finalNameIdx] ? String(row[finalNameIdx]).trim() : '';
              if (!nameValue || nameValue.toLowerCase() === 'nome' || nameValue.toLowerCase() === 'nome completo') continue;
              
              const numberValue = numberIdx !== -1 && row[numberIdx] ? String(row[numberIdx]).trim() : String(imported.length + 1);
              const dobValue = dobIdx !== -1 && row[dobIdx] ? String(row[dobIdx]).trim() : '';
              const birthplaceValue = birthplaceIdx !== -1 && row[birthplaceIdx] ? String(row[birthplaceIdx]).trim() : '';
              const addressValue = addressIdx !== -1 && row[addressIdx] ? String(row[addressIdx]).trim() : '';
              
              imported.push({
                id: crypto.randomUUID(),
                studentNumber: numberValue,
                name: nameValue,
                grades: { acs1: '', acs2: '', acs3: '', ap: '', exame: '' },
                dob: dobValue,
                birthplace: birthplaceValue,
                address: addressValue
              });
            }
            
            if (imported.length === 0) {
              setImportError('Nenhum aluno encontrado no ficheiro Excel.');
            } else {
              setPreviewStudents(imported);
            }
            setIsImporting(false);
          } catch (err: any) {
            console.error(err);
            setImportError('Erro ao ler dados do ficheiro: ' + err.message);
            setIsImporting(false);
          }
        };
        reader.readAsArrayBuffer(file);
      } else if (ext === 'docx') {
        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const arrayBuffer = event.target?.result as ArrayBuffer;
            const result = await mammoth.extractRawText({ arrayBuffer });
            const text = result.value;
            
            if (!text || text.trim().length === 0) {
              setImportError('O ficheiro Word está vazio.');
              setIsImporting(false);
              return;
            }
            
            const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
            const imported: Student[] = [];
            
            lines.forEach((line) => {
              const lowerLine = line.toLowerCase();
              if (lowerLine === 'nome' || lowerLine === 'nome completo' || lowerLine === 'lista de alunos' || lowerLine === 'alunos') {
                return;
              }
              
              const match = line.match(/^(\d+)\s*[-.\t]\s*(.+)$/);
              let number = String(imported.length + 1);
              let name = line;
              
              if (match) {
                number = match[1];
                name = match[2].trim();
              } else {
                const matchSpace = line.match(/^(\d+)\s+(.+)$/);
                if (matchSpace) {
                  number = matchSpace[1];
                  name = matchSpace[2].trim();
                }
              }
              
              name = name.replace(/^[•\-*+]\s*/, '').trim();
              
              if (name.length > 2) {
                imported.push({
                  id: crypto.randomUUID(),
                  studentNumber: number,
                  name: name,
                  grades: { acs1: '', acs2: '', acs3: '', ap: '', exame: '' }
                });
              }
            });
            
            if (imported.length === 0) {
              setImportError('Não foi possível identificar nomes de alunos no ficheiro Word.');
            } else {
              setPreviewStudents(imported);
            }
            setIsImporting(false);
          } catch (err: any) {
            console.error(err);
            setImportError('Erro ao extrair texto do Word: ' + err.message);
            setIsImporting(false);
          }
        };
        reader.readAsArrayBuffer(file);
      } else {
        setImportError('Formato de arquivo não suportado. Carregue .xlsx, .xls, .csv ou .docx.');
        setIsImporting(false);
      }
    } catch (err: any) {
      console.error(err);
      setImportError('Erro ao processar ficheiro: ' + err.message);
      setIsImporting(false);
    }
  };

  const handleProcessPastedNames = () => {
    if (!pastedNames.trim()) {
      setImportError('Por favor, cole alguns nomes primeiro.');
      return;
    }
    setImportError('');
    setIsImporting(true);
    
    try {
      const lines = pastedNames.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      const imported: Student[] = [];
      
      lines.forEach((line) => {
        const lowerLine = line.toLowerCase();
        if (lowerLine === 'nome' || lowerLine === 'nome completo' || lowerLine === 'lista de alunos' || lowerLine === 'alunos') {
          return;
        }
        
        let name = line;
        const match = line.match(/^(\d+)\s*[-.\t]\s*(.+)$/);
        if (match) {
          name = match[2].trim();
        } else {
          const matchSpace = line.match(/^(\d+)\s+(.+)$/);
          if (matchSpace) {
            name = matchSpace[2].trim();
          }
        }
        
        name = name.replace(/^[•\-*+]\s*/, '').trim();
        
        if (name.length >= 2) {
          imported.push({
            id: crypto.randomUUID(),
            studentNumber: String(imported.length + 1),
            name: name,
            grades: { acs1: '', acs2: '', acs3: '', ap: '', exame: '' }
          });
        }
      });
      
      if (imported.length === 0) {
        setImportError('Não foi possível identificar nomes de alunos válidos.');
      } else {
        setPreviewStudents(imported);
      }
    } catch (err: any) {
      console.error(err);
      setImportError('Erro ao ler os nomes colados: ' + err.message);
    } finally {
      setIsImporting(false);
    }
  };

  const confirmImportStudents = async () => {
    if (!selectedClass || previewStudents.length === 0 || !user) return;
    
    setIsImporting(true);
    const updatedClass = {
      ...selectedClass,
      students: [...selectedClass.students, ...previewStudents]
    };
    
    try {
      await setDoc(doc(db, 'classes', selectedClass.id), updatedClass);
      toast.success(`${previewStudents.length} alunos importados com sucesso!`);
      setIsImportOpen(false);
      setPreviewStudents([]);
      setImportError('');
    } catch (error) {
      console.error("Error committing imported students:", error);
      toast.error('Erro ao guardar os alunos no banco de dados.');
    } finally {
      setIsImporting(false);
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
          const currentTrimesterGrades = s.trimesterGrades || {};
          const currentTGrades = { ...getStudentGrades(s, selectedTrimester), [field]: value };
          
          const newTrimesterGrades = {
            ...currentTrimesterGrades,
            [selectedTrimester]: currentTGrades
          };
          
          // Sync with old grades object for trimester 1 compatibility
          const updatedRootGrades = selectedTrimester === '1' ? currentTGrades : s.grades;
          
          return { 
            ...s, 
            grades: updatedRootGrades,
            trimesterGrades: newTrimesterGrades
          };
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

  const deleteClass = (classId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setClassToDelete(classId);
  };

  const filteredStudents = selectedClass?.students.filter(s => 
    (s.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  ).sort((a, b) => {
    const numA = parseInt(a.studentNumber || '9999', 10);
    const numB = parseInt(b.studentNumber || '9999', 10);
    if (!isNaN(numA) && !isNaN(numB) && numA !== numB) return numA - numB;
    return (a.name || '').localeCompare(b.name || '');
  }) || [];

  const studentsNeedingApoio = (selectedClass?.students.filter(student => {
    return getApoioAlertStatus(student, selectedTrimester) !== 'none';
  }) || []).sort((a, b) => {
    const numA = parseInt(a.studentNumber || '9999', 10);
    const numB = parseInt(b.studentNumber || '9999', 10);
    if (!isNaN(numA) && !isNaN(numB) && numA !== numB) return numA - numB;
    return (a.name || '').localeCompare(b.name || '');
  });

  const buildExcelWorkbook = () => {
    if (!selectedClass) return null;

    const studentGradesList = selectedClass.students.map(s => getStudentGrades(s, selectedTrimester));

    const hasAcs1 = studentGradesList.some(g => (g.acs1 || '').trim() !== '');
    const hasAcs2 = studentGradesList.some(g => (g.acs2 || '').trim() !== '');
    const hasAcs3 = studentGradesList.some(g => (g.acs3 || '').trim() !== '');
    const hasAp = studentGradesList.some(g => (g.ap || '').trim() !== '');
    const hasExame = studentGradesList.some(g => (g.exame || '').trim() !== '');

    const hasMedia = hasAcs1 || hasAcs2 || hasAcs3;
    const hasMediaGeral = hasMedia && hasAp;

    const trimesterText = `${selectedTrimester}º Trimestre`;
    let levelName = selectedClass.level || '';
    if (!levelName.toLowerCase().includes('classe')) {
      if (levelName.includes('ª') || levelName.includes('º') || /^\d+$/.test(levelName)) {
        levelName = `${levelName} Classe`;
      }
    }
    const sectionName = selectedClass.section ? ` ${selectedClass.section}` : '';
    const titleText = `Pauta de ${selectedClass.subject} - ${trimesterText} - ${levelName}${sectionName}`;

    // 1. Build Grades data as AOA for beautiful formatting
    const aoaGrades: any[][] = [
      [titleText.toUpperCase()], // Row 0: Large Header
      [`Escola: ${selectedClass.school || 'EduGestão'} | Ano Lectivo: ${selectedClass.academicYear || '-'}`], // Row 1: Informative Subheader
      [], // Row 2: Empty Spacer for breathing room
    ];

    // Headers Row (Row 3)
    const gradesHeaders = ['Nº', 'Nome do Aluno'];
    if (hasAcs1) gradesHeaders.push('ACS 1');
    if (hasAcs2) gradesHeaders.push('ACS 2');
    if (hasAcs3) gradesHeaders.push('ACS 3');
    if (hasMedia) gradesHeaders.push('Média');
    if (hasAp) gradesHeaders.push('AP');
    if (hasExame) gradesHeaders.push('Exame');
    if (hasMediaGeral) gradesHeaders.push('Média Geral');

    aoaGrades.push(gradesHeaders);

    // Sort students by studentNumber or name for elegant ordering
    const sortedStudentsForExport = [...selectedClass.students].sort((a, b) => {
      const numA = parseInt(a.studentNumber || '999999', 10);
      const numB = parseInt(b.studentNumber || '999999', 10);
      if (!isNaN(numA) && !isNaN(numB) && numA !== numB) return numA - numB;
      return (a.name || '').localeCompare(b.name || '');
    });

    sortedStudentsForExport.forEach(student => {
      const studentGrades = getStudentGrades(student, selectedTrimester);
      const row: any[] = [
        student.studentNumber || '-',
        student.name,
      ];
      if (hasAcs1) row.push(studentGrades.acs1 || '');
      if (hasAcs2) row.push(studentGrades.acs2 || '');
      if (hasAcs3) row.push(studentGrades.acs3 || '');
      if (hasMedia) row.push(calculateAcsAverage(studentGrades));
      if (hasAp) row.push(studentGrades.ap || '');
      if (hasExame) row.push(studentGrades.exame || '');
      if (hasMediaGeral) row.push(calculateGeneralAverage(studentGrades));
      
      aoaGrades.push(row);
    });

    const wb = XLSX.utils.book_new();
    const wsGrades = XLSX.utils.aoa_to_sheet(aoaGrades);

    // Merge title and subtitle rows beautifully over the computed content width
    wsGrades['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(gradesHeaders.length - 1, 1) } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: Math.max(gradesHeaders.length - 1, 1) } }
    ];

    // Helper function to auto-fit columns based on real content length
    const calculateColWidths = (aoa: any[][], startRow: number) => {
      if (!aoa || aoa.length <= startRow) return [];
      const numCols = aoa[startRow].length;
      return Array.from({ length: numCols }, (_, colIndex) => {
        let maxLen = 8;
        for (let rowIndex = startRow; rowIndex < aoa.length; rowIndex++) {
          const val = aoa[rowIndex][colIndex];
          if (val !== undefined && val !== null) {
            const strVal = String(val);
            if (strVal.length > maxLen) {
              maxLen = strVal.length;
            }
          }
        }
        // Perfect padding per column type
        return { wch: Math.min(Math.max(maxLen + 4, colIndex === 1 ? 32 : 10), 50) };
      });
    };

    wsGrades['!cols'] = calculateColWidths(aoaGrades, 3);
    XLSX.utils.book_append_sheet(wb, wsGrades, 'Avaliações');

    // 2. Build Personal Data sheet if user is Director
    if (selectedClass.isDirector) {
      const personalTitleText = `DADOS PESSOAIS - ${levelName}${sectionName} - ${selectedClass.subject}`;
      const aoaPersonal: any[][] = [
        [personalTitleText.toUpperCase()], // Row 0: Large Header
        [`Escola: ${selectedClass.school || 'EduGestão'} | Ano Lectivo: ${selectedClass.academicYear || '-'}`], // Row 1: Subheader
        [], // Row 2: Spacer
      ];

      const personalHeaders = [
        'Nº',
        'Nome do Aluno',
        'Data de Nascimento',
        'Local de Nascimento',
        'Morada',
        'Encarregado de Educação',
        'Profissão do EE',
        'Contacto do EE',
        'Morada do EE'
      ];
      aoaPersonal.push(personalHeaders);

      sortedStudentsForExport.forEach(student => {
        aoaPersonal.push([
          student.studentNumber || '-',
          student.name,
          student.dob ? new Date(student.dob).toLocaleDateString('pt-PT') : '',
          student.birthplace || '-',
          student.address || '-',
          student.parentName || '-',
          student.parentProfession || '-',
          student.parentContact || '-',
          student.parentAddress || '-'
        ]);
      });

      const wsPersonal = XLSX.utils.aoa_to_sheet(aoaPersonal);
      wsPersonal['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: personalHeaders.length - 1 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: personalHeaders.length - 1 } }
      ];
      wsPersonal['!cols'] = calculateColWidths(aoaPersonal, 3);
      XLSX.utils.book_append_sheet(wb, wsPersonal, 'Dados Pessoais');
    }

    const fileNameRaw = `${titleText}.xlsx`;
    const fileName = fileNameRaw.replace(/\s+/g, ' ');

    return { wb, fileName };
  };

  const exportToExcel = () => {
    const result = buildExcelWorkbook();
    if (!result) return;
    XLSX.writeFile(result.wb, result.fileName);
  };

  const syncToGoogleDrive = async () => {
    if (!selectedClass) return;
    
    setIsSyncing(true);
    const toastId = toast.loading("A preparar ficheiro excel para o Google Drive...");
    
    try {
      let token = getCachedAccessToken();
      
      // Se não houver token em memória, solicitar autorização com popup
      if (!token) {
        toast.loading("Por favor, autorize nas definições do Google na janela emergente...", { id: toastId });
        
        const loginVal = await signInWithGoogle();
        const credential = GoogleAuthProvider.credentialFromResult(loginVal);
        token = credential?.accessToken || null;
        
        if (!token) {
          throw new Error("Não foi possível obter a autorização do Google Drive.");
        }
      }
      
      const result = buildExcelWorkbook();
      if (!result) {
        throw new Error("Nenhum dado disponível para sincronizar.");
      }
      
      toast.loading("A ligar ao Google Drive...", { id: toastId });
      
      // Escrever como array do XLSX e criar Blob
      const wbout = XLSX.write(result.wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      
      // Procurar se arquivo com o mesmo nome já existe (para atualizar em vez de duplicar)
      const queryStr = encodeURIComponent(`name = '${result.fileName.replace(/'/g, "\\'")}' and trashed = false`);
      const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${queryStr}&fields=files(id)`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!searchRes.ok) {
        // Se a chamada falhar, limpa token expirado
        setCachedAccessToken(null);
        throw new Error("Sessão do Google Drive expirada. Se faz favor, tente novamente para autorizar.");
      }
      
      const searchData = await searchRes.json();
      let fileId = null;
      if (searchData.files && searchData.files.length > 0) {
        fileId = searchData.files[0].id;
      }
      
      if (fileId) {
        // Atualizar ficheiro existente
        toast.loading("A atualizar pauta existente no seu Google Drive...", { id: toastId });
        
        const updateRes = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          },
          body: blob
        });
        
        if (!updateRes.ok) {
          throw new Error("Não foi possível atualizar o ficheiro no Google Drive.");
        }
        
        toast.success("Sincronizado!", {
          id: toastId,
          description: "A pauta foi atualizada com sucesso no seu Google Drive!"
        });
      } else {
        // Criar novo ficheiro
        toast.loading("A criar nova pauta no seu Google Drive...", { id: toastId });
        
        const createMetadataRes = await fetch('https://www.googleapis.com/drive/v3/files', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: result.fileName,
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          })
        });
        
        if (!createMetadataRes.ok) {
          throw new Error("Erro ao criar os metadados do ficheiro no Google Drive.");
        }
        
        const metadata = await createMetadataRes.json();
        const newFileId = metadata.id;
        
        const uploadRes = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${newFileId}?uploadType=media`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          },
          body: blob
        });
        
        if (!uploadRes.ok) {
          throw new Error("Erro ao carregar o conteúdo do ficheiro para o Google Drive.");
        }
        
        toast.success("Sincronizado!", {
          id: toastId,
          description: "A pauta foi gravada com sucesso no seu Google Drive!"
        });
      }
    } catch (error: any) {
      console.error("Google Drive sync error: ", error);
      toast.error("Falha na sincronização", {
        id: toastId,
        description: error.message || "Ocorreu um erro ao sincronizar com o Google Drive."
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const sortedClasses = [...classes].sort((a, b) => {
    if (a.isDirector && !b.isDirector) return -1;
    if (!a.isDirector && b.isDirector) return 1;

    const getLevelNum = (levelStr: string) => parseInt((levelStr || '').replace(/\D/g, '')) || 0;
    const levelA = getLevelNum(a.level);
    const levelB = getLevelNum(b.level);
    
    if (levelA !== levelB) {
      return levelA - levelB;
    }

    return (a.section || '').localeCompare(b.section || '');
  });

  const levels = Array.from(
    new Map<string, { level: string; year: string }>(
      classes.map(c => {
        const lvl = (c.level || '').toString().trim();
        const yr = (c.academicYear || '').toString().trim();
        return [`${lvl}-${yr}`, { level: lvl, year: yr }];
      })
    ).values()
  ).sort((a, b) => {
    const getLevelNum = (str: string) => parseInt((str || '').replace(/\D/g, '')) || 0;
    if (a.level !== b.level) {
      return getLevelNum(a.level) - getLevelNum(b.level);
    }
    return (b.year || '').localeCompare(a.year || '');
  });

  const filteredByLevel = selectedLevel 
    ? sortedClasses.filter(c => 
        !c.isPlaceholder && 
        (c.level || '').toString().trim().toLowerCase() === selectedLevel.toString().trim().toLowerCase() &&
        (!selectedLevelYear || (c.academicYear || '').toString().trim().toLowerCase() === selectedLevelYear.toString().trim().toLowerCase())
      )
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
    <div className="min-h-screen flex flex-col text-foreground font-sans">
      {/* Header */}
      <header className="bg-card/85 backdrop-blur-md border-b border-border sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-primary">
            <GraduationCap className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-semibold tracking-tight">EduGestão</h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Circular user avatar with popup custom dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="relative flex items-center justify-center h-9 w-9 rounded-full overflow-hidden border border-border/70 hover:border-primary/50 transition-all cursor-pointer shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                title="Menu do Utilizador"
              >
                {user.photoURL ? (
                  <img 
                    src={user.photoURL} 
                    alt={user.displayName || 'Utilizador'} 
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="h-full w-full bg-purple-600 text-white text-xs font-bold font-mono flex items-center justify-center">
                    {getInitials(user)}
                  </div>
                )}
              </button>

              {isDropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setIsDropdownOpen(false)} 
                  />
                  <div className="absolute right-0 mt-2 w-56 rounded-xl border border-border bg-card p-2 shadow-lg z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                    <div className="px-3 py-2 border-b border-border/50 mb-1">
                      <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Conectado como</p>
                      <p className="text-xs font-bold text-foreground truncate">{user.displayName || user.email}</p>
                    </div>

                    <button
                      onClick={() => {
                        if (isDark) {
                          setTheme("light");
                          toast.success("Luzes Ligadas", { id: "theme-toggle" });
                        } else {
                          setTheme("dark");
                          toast.success("Luzes Apagadas", { id: "theme-toggle" });
                        }
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-foreground hover:bg-muted rounded-lg transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        {isDark ? (
                          <Sun className="h-4 w-4 text-amber-500" />
                        ) : (
                          <Moon className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                        )}
                        <span>{isDark ? "Ligar Luzes" : "Apagar Luzes"}</span>
                      </div>
                      <div className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${isDark ? 'bg-purple-600' : 'bg-muted-foreground/30'}`}>
                        <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${isDark ? 'translate-x-4' : 'translate-x-0'}`} />
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        setIsDropdownOpen(false);
                        setIsLogoutDialogOpen(true);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-red-500 hover:bg-red-500/10 dark:hover:bg-red-500/15 rounded-lg transition-colors cursor-pointer text-left"
                    >
                      <LogOut className="h-4 w-4 text-red-500" />
                      <span>Terminar Sessão</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Logout Centered Confirmation Modal */}
      {isLogoutDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Semi-transparent dark overlay */}
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity" 
            onClick={() => setIsLogoutDialogOpen(false)} 
          />
          
          {/* Centered Modal Card */}
          <div className="relative bg-card border border-border rounded-2xl max-w-sm w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200 z-10">
            <h3 className="text-lg font-bold text-foreground mb-2">
              Terminar Sessão
            </h3>
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
              Tem a certeza que deseja sair da sua conta?
            </p>
            
            <div className="flex items-center gap-3">
              <Button 
                variant="outline" 
                onClick={() => setIsLogoutDialogOpen(false)}
                className="flex-1 rounded-xl h-10 text-xs font-bold cursor-pointer border border-border/85 animate-none"
              >
                Cancelar
              </Button>
              <Button 
                onClick={() => {
                  setIsLogoutDialogOpen(false);
                  logout();
                }}
                className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl h-10 text-xs cursor-pointer border-0"
              >
                Sair
              </Button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-3 pb-8 sm:pt-4 w-full">
        {!selectedClassId ? (
          // Dashboard - List of Classes
          <div className="space-y-6">
            {selectedLevel ? (
              <div className="space-y-4 pt-16">
                {/* Compact Class Card with header and back button */}
                <div className="fixed top-16 left-0 right-0 z-20 bg-background/95 backdrop-blur-md border-b border-border shadow-md py-3.5">
                  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 w-full">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => {
                        setSelectedLevel(null);
                        setSelectedLevelYear(null);
                      }} 
                      className="h-8 px-4 border border-border/85 bg-card/10 hover:bg-card/30 text-foreground hover:border-primary/30 transition-all rounded-full shadow-sm flex items-center gap-1.5 font-bold text-xs cursor-pointer shrink-0"
                      title="Voltar para Minhas Classes"
                    >
                      <span>← Voltar</span>
                    </Button>

                    <div className="flex items-center gap-2 min-w-0">
                      <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground truncate">
                        {selectedLevel}
                      </h2>
                      <GraduationCap className="h-4 w-4 sm:h-5 sm:w-5 text-primary shrink-0" />
                    </div>
                  </div>
                </div>

                {/* Floating FAB to Add New Turma */}
                <Dialog open={isAddClassOpen} onOpenChange={(open) => {
                  setIsAddClassOpen(open);
                  if (open) {
                    setNewClass({
                      school: '',
                      level: selectedLevel || '',
                      section: '',
                      subject: '',
                      academicYear: selectedLevelYear || new Date().getFullYear().toString(),
                      isDirector: false
                    });
                  }
                }}>
                  <DialogTrigger render={
                    <Button 
                      className="fixed bottom-20 right-6 sm:bottom-24 sm:right-8 z-55 rounded-full w-12 h-12 p-0 bg-primary hover:bg-primary/95 text-primary-foreground shadow-md shadow-primary/25 border border-primary-foreground/10 hover:shadow-lg hover:shadow-primary/35 ring-2 ring-primary/5 hover:ring-primary/15 transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center animate-in zoom-in-50 duration-250" 
                      title="Adicionar Nova Turma"
                    >
                      <Plus className="h-6 w-6 animate-pulse" />
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
              <div className="space-y-4">
                <div className="bg-card/30 py-3.5 px-4 sm:px-5 rounded-xl border border-border/50 flex items-center justify-between gap-4 transition-all duration-200">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <BookOpen className="h-4 w-4 sm:h-5 sm:w-5 text-primary shrink-0" />
                    <div className="flex flex-row items-baseline gap-2 min-w-0">
                      <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground animate-in slide-in-from-left duration-200">
                        Minhas Classes
                      </h2>
                      <span className="hidden sm:inline text-xs text-muted-foreground border-l border-border pl-2 truncate">
                        Organize as suas turmas por classe e lecionação.
                      </span>
                    </div>
                  </div>

                  <span className="text-[10px] sm:text-xs font-semibold bg-primary/10 text-primary px-2.5 py-0.5 rounded-full whitespace-nowrap shrink-0">
                    {levels.length} {levels.length === 1 ? 'Classe' : 'Classes'}
                  </span>
                </div>

                {/* Floating FAB to Add New Class */}
                <Dialog open={isAddClassOpen} onOpenChange={(open) => {
                  setIsAddClassOpen(open);
                  if (open) {
                    setNewClass({
                      school: '',
                      level: '',
                      section: '',
                      subject: '',
                      academicYear: new Date().getFullYear().toString(),
                      isDirector: false
                    });
                  }
                }}>
                  <DialogTrigger render={
                    <Button 
                      className="fixed bottom-20 right-6 sm:bottom-24 sm:right-8 z-55 rounded-full w-12 h-12 p-0 bg-primary hover:bg-primary/95 text-primary-foreground shadow-md shadow-primary/25 border border-primary-foreground/10 hover:shadow-lg hover:shadow-primary/35 ring-2 ring-primary/5 hover:ring-primary/15 transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center animate-in zoom-in-50 duration-250" 
                      title="Adicionar Nova Classe"
                    >
                      <Plus className="h-6 w-6 animate-pulse" />
                    </Button>
                  } />
                  <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle>Adicionar Nova Classe</DialogTitle>
                      <DialogDescription>
                        Defina o nível e o ano lectivo para organizar as turmas.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="level" className="flex items-center gap-1 text-sm font-medium">Classe / Nível <span className="text-red-500">*</span></Label>
                        <Input id="level" value={newClass.level || ''} onChange={e => setNewClass({...newClass, level: e.target.value})} placeholder="Ex: 7ª Classe" />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="academicYear" className="flex items-center gap-1 text-sm font-medium">Ano Lectivo <span className="text-red-500">*</span></Label>
                        <Input id="academicYear" value={newClass.academicYear || ''} onChange={e => setNewClass({...newClass, academicYear: e.target.value})} placeholder="Ex: 2024" />
                      </div>
                    </div>
                    <DialogFooter className="gap-2 sm:gap-0 mt-2">
                      <Button variant="outline" className="rounded-xl px-4 h-10 text-sm font-medium transition-all" onClick={() => setIsAddClassOpen(false)}>Cancelar</Button>
                      <Button onClick={handleAddClass} className="bg-primary hover:bg-primary/91 text-primary-foreground rounded-xl px-5 h-10 text-sm font-semibold shadow-sm transition-all" disabled={!newClass.level || !newClass.academicYear}>
                        Guardar Classe
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
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
                          <Label htmlFor="edit-year">Ano Lectivo</Label>
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
                            Sou o Director desta Turma
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

              {/* Confirm Delete Class Dialog */}
              <Dialog open={!!classToDelete} onOpenChange={(open) => !open && setClassToDelete(null)}>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-destructive">
                      <Trash2 className="h-5 w-5" />
                      Remover Turma
                    </DialogTitle>
                    <DialogDescription>
                      Esta ação não pode ser desfeita. Isto irá remover permanentemente a turma <strong>{(() => {
                        const c = classes.find(item => item.id === classToDelete);
                        return c ? `${c.level}ª ${c.section}` : '';
                      })()}</strong> ({classes.find(item => item.id === classToDelete)?.subject || 'Geral'}) e todos os seus alunos.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter className="gap-2 sm:gap-0 mt-2">
                    <Button variant="outline" className="rounded-xl px-4 h-10 text-sm font-medium transition-all" onClick={() => setClassToDelete(null)}>Cancelar</Button>
                    <Button variant="destructive" className="rounded-xl px-5 h-10 text-sm font-semibold shadow-sm transition-all animate-pulse" onClick={confirmDeleteClass}>
                      Sim, Remover Turma
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
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 animate-in fade-in duration-300">
                {levels.map((item) => {
                  const levelKey = `${item.level}-${item.year}`;
                  const classesInLevel = classes.filter(c => 
                    !c.isPlaceholder &&
                    (c.level || '').toString().trim().toLowerCase() === (item.level || '').toString().trim().toLowerCase() && 
                    (c.academicYear || '').toString().trim().toLowerCase() === (item.year || '').toString().trim().toLowerCase()
                  );
                  const hasDirector = classesInLevel.some(c => c.isDirector);
                  const accent = getAccentColor(levelKey);

                  return (
                    <Card 
                      key={levelKey} 
                      onClick={() => {
                        setSelectedLevel(item.level);
                        setSelectedLevelYear(item.year);
                      }}
                      className={`relative overflow-hidden cursor-pointer transition-all duration-300 group hover:shadow-md ${hasDirector ? 'border-l-4 border-l-primary bg-[var(--card-director)]' : `border-l-4 ${accent.border}`} bg-card/65 hover:bg-card p-5 flex flex-col justify-between min-h-[160px] rounded-xl border border-border/50 hover:border-primary/20 hover:scale-[1.01]`}
                    >
                      <div className="flex flex-col text-left">
                        <div className="flex justify-between items-start gap-2">
                          <h3 className="text-xl font-bold tracking-tight text-foreground group-hover:text-primary transition-colors">
                            {item.level}
                          </h3>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${accent.bg} ${accent.text} shrink-0`}>
                            {item.year}
                          </span>
                        </div>
                        
                        <p className="text-xs text-muted-foreground mt-2.5 font-medium flex items-center gap-1.5">
                          <BookOpen className="h-3.5 w-3.5 text-muted-foreground/60" />
                          <span>{classesInLevel.length} {classesInLevel.length === 1 ? 'Turma' : 'Turmas'}</span>
                        </p>
                      </div>

                      {/* Actions in a bottom row, icon-only buttons with subtle borders */}
                      <div className="mt-4 pt-3 border-t border-border/30 flex items-center justify-end gap-2">
                        <Button 
                          variant="outline" 
                          size="icon"
                          className="h-8 w-8 rounded-lg border border-border/80 bg-background/20 text-muted-foreground hover:text-primary hover:border-primary/40 hover:bg-primary/10 transition-all flex items-center justify-center cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLevel(item.level);
                            setSelectedLevelYear(item.year);
                          }}
                          title="Gerir Turmas"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>

                        <Button 
                          variant="outline" 
                          size="icon"
                          className="h-8 w-8 rounded-lg border border-border/80 bg-background/20 text-muted-foreground hover:text-destructive hover:border-destructive/40 hover:bg-destructive/10 transition-all flex items-center justify-center cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            setLevelToDelete({ level: item.level, year: item.year });
                            setIsDeleteDialogOpen(true);
                          }}
                          title="Eliminar Classe"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            ) : filteredByLevel.length === 0 ? (
              <div className="text-center py-16 bg-card/40 backdrop-blur-xs rounded-2xl border border-dashed border-border p-6 flex flex-col items-center justify-center w-full animate-in fade-in duration-350 col-span-full">
                <div className="mx-auto w-14 h-14 bg-purple-100 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 rounded-full flex items-center justify-center mb-4">
                  <Layers className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold text-foreground">Nenhuma turma adicionada</h3>
                <p className="text-muted-foreground mt-1 max-w-sm mx-auto text-xs sm:text-sm">Adicione turmas (ex: Turma A, Turma B) com as respetivas disciplinas para começar.</p>
                <Button onClick={() => setIsAddClassOpen(true)} className="mt-5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white px-5 h-9 text-xs font-bold shadow-md transition-all flex items-center justify-center gap-1.5 hover:scale-[1.02] cursor-pointer border-0">
                  <Plus className="h-4 w-4" /> Adicionar Turma
                </Button>
              </div>
            ) : (
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredByLevel.map((c) => {
                  const accent = getAccentColor(c.id);
                  const borderClass = c.isDirector 
                    ? 'border-l-4 border-l-amber-500 bg-amber-500/5' 
                    : `border-l-4 ${accent.border} bg-card/65 hover:bg-card`;

                  return (
                    <Card 
                      key={c.id} 
                      className={`cursor-pointer hover:shadow-md transition-all duration-300 group hover:scale-[1.01] ${borderClass} border border-border/50 rounded-xl`}
                      onClick={() => setSelectedClassId(c.id)}
                    >
                      <CardHeader className="pb-3 px-5 pt-5">
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <CardTitle className="text-xl font-bold text-foreground group-hover:text-primary transition-colors">
                              Turma {c.section}
                            </CardTitle>
                            <div className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5 font-medium">
                              <BookOpen className="h-3.5 w-3.5 text-muted-foreground/60" /> {c.subject}
                            </div>
                          </div>
                          
                          {/* Rich-spaced Actions with vertical divider */}
                          <div className="flex items-center gap-3">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-all cursor-pointer flex items-center justify-center shrink-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingClass(c);
                              }}
                              title="Editar Turma"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <div className="h-4 w-[1px] bg-border/60" />
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all cursor-pointer flex items-center justify-center shrink-0"
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
                        <CardDescription className="flex items-center gap-1.5 mt-2">
                          <School className="h-3.5 w-3.5 text-muted-foreground/60" /> {c.school}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="px-5 pb-5 pt-0">
                        <div className="flex items-center justify-between mt-4">
                          {/* Pill/chip for Students count */}
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-muted hover:bg-muted/80 text-muted-foreground border border-border/40 shrink-0">
                            <Users className="h-3 w-3 text-muted-foreground/70" />
                            <span>{c.students.length} {c.students.length === 1 ? 'aluno' : 'alunos'}</span>
                          </div>

                          {/* Prominent gold/amber badge for Diretor */}
                          {c.isDirector && (
                            <div className="bg-amber-400 text-amber-950 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide flex items-center gap-1 shadow-sm shrink-0">
                              <Star className="h-2.5 w-2.5 fill-amber-950 text-amber-950" /> 
                              <span>Director</span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          // Class Details - Students and Grades
          <div className="space-y-4 pt-[156px] xs:pt-[164px] md:pt-[110px] animate-in fade-in duration-300">
            <div className="fixed top-16 left-0 right-0 z-20 bg-background/95 backdrop-blur-md border-b border-border shadow-xs py-3 sm:py-3.5">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Row 1: Context & Navigation Header */}
                <div className="flex items-center justify-between w-full gap-2 border-b border-border/50 pb-2 mb-2 sm:mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Button 
                      variant="outline" 
                      onClick={() => setSelectedClassId(null)} 
                      className="h-8 w-8 p-0 border border-purple-200 dark:border-purple-900/40 bg-purple-50/20 dark:bg-purple-950/20 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded-lg shadow-2xs flex items-center justify-center cursor-pointer transition-all shrink-0"
                      title="Voltar para Turmas"
                    >
                      <ChevronLeft className="h-4.5 w-4.5" />
                    </Button>
                    
                    <div className="flex items-baseline gap-1.5 min-w-0">
                      <h2 className="text-base sm:text-xl font-extrabold text-foreground tracking-tight leading-none truncate">
                        {`${selectedClass.level.replace(/\s*[Cc]lasse\s*/i, '').trim()} ${selectedClass.section}`}
                      </h2>
                      <span className="bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded-full border border-purple-200/50 dark:border-purple-900/30 shrink-0 truncate max-w-[80px] xs:max-w-[120px] sm:max-w-none">
                        {selectedClass.subject}
                      </span>
                      {selectedClass.isDirector && (
                        <span className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-md shadow-2xs shrink-0 leading-none">
                          DT
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setPreviewStudents([]);
                      setImportError('');
                      setImportMode('file');
                      setPastedNames('');
                      setIsImportOpen(true);
                    }}
                    className="h-8 rounded-lg border border-purple-200/80 dark:border-purple-900/45 bg-purple-50/50 dark:bg-purple-950/25 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/35 text-xs font-bold cursor-pointer flex items-center justify-center gap-1.5 px-2.5 py-1 shadow-2xs transition-all w-fit border-0"
                    title="Importar Lista de Alunos"
                  >
                    <Upload className="h-3.5 w-3.5 shrink-0" />
                    <span className="hidden xs:inline text-[11px] sm:text-xs">Importar Alunos</span>
                    <span className="xs:hidden text-[11px]">Importar</span>
                  </Button>
                </div>
                
                {/* Row 2: Search and Actions */}
                <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 sm:gap-3 w-full">
                  {/* Search box */}
                  <div className="relative flex-1 w-full">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground/60 focus:text-primary transition-colors" />
                    <Input 
                      placeholder="Procurar aluno..." 
                      className="pl-8.5 bg-muted/45 border-border/80 focus:border-purple-500 hover:bg-muted/60 h-8.5 rounded-lg text-xs"
                      value={searchQuery || ''}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex flex-wrap xs:flex-nowrap items-center gap-2 w-full md:w-auto shrink-0">
                    <Button 
                      variant="outline" 
                      onClick={exportToExcel} 
                      className="flex-1 xs:flex-none whitespace-nowrap h-8.5 px-3 border border-purple-200 dark:border-purple-900/50 bg-purple-50/10 dark:bg-purple-950/10 text-purple-700 dark:text-purple-300 hover:bg-purple-50 hover:text-purple-800 dark:hover:bg-purple-900/30 font-semibold rounded-lg text-xs shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer transition-all" 
                      title="Exportar para Excel" 
                      disabled={selectedClass.students.length === 0}
                    >
                      <Download className="h-3.5 w-3.5 shrink-0 text-purple-600 dark:text-purple-400" />
                      <span>Exportar</span>
                    </Button>

                    <Button 
                      variant="outline" 
                      onClick={syncToGoogleDrive} 
                      className="flex-1 xs:flex-none whitespace-nowrap h-8.5 px-3 border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/10 dark:bg-emerald-950/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 dark:hover:bg-emerald-900/30 font-semibold rounded-lg text-xs shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer transition-all" 
                      title="Sincronizar com o Google Drive" 
                      disabled={isSyncing || selectedClass.students.length === 0}
                    >
                      <Cloud className={`h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400 ${isSyncing ? 'animate-pulse' : ''}`} />
                      <span className="hidden xs:inline">{isSyncing ? 'A Sincronizar...' : 'Sincronizar'}</span>
                      <span className="xs:hidden">{isSyncing ? 'Sinc...' : 'Sinc.'}</span>
                    </Button>
                    
                    <Dialog open={isAddStudentOpen} onOpenChange={setIsAddStudentOpen}>
                      <DialogTrigger render={
                        <Button className="flex-1 xs:flex-none whitespace-nowrap h-8.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg text-xs shadow-sm flex items-center justify-center gap-1.5 cursor-pointer border-0 transition-all px-3 sm:px-4" />
                      }>
                        <UserPlus className="h-3.5 w-3.5 shrink-0" />
                        <span className="hidden xs:inline">Adicionar Aluno</span>
                        <span className="xs:hidden">Add Aluno</span>
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

                <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
                  <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Upload className="h-5 w-5 text-purple-600" />
                        <span>Importar Alunos</span>
                      </DialogTitle>
                      <DialogDescription>
                        Seleccione um ficheiro ou cole directamente a lista de nomes dos alunos desta turma.
                      </DialogDescription>
                    </DialogHeader>

                    {previewStudents.length === 0 ? (
                      <div className="space-y-4 py-4">
                        <div className="flex bg-muted p-1 rounded-xl gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setImportMode('file');
                              setImportError('');
                            }}
                            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                              importMode === 'file'
                                ? 'bg-background text-foreground shadow-xs'
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            Carregar Ficheiro
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setImportMode('paste');
                              setImportError('');
                            }}
                            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                              importMode === 'paste'
                                ? 'bg-background text-foreground shadow-xs'
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            Colar Nomes
                          </button>
                        </div>

                        {importMode === 'file' ? (
                          <>
                            <div className="flex flex-col items-center justify-center border-2 border-dashed border-border hover:border-purple-500/50 rounded-2xl p-8 bg-muted/15 hover:bg-muted/30 transition-all text-center relative cursor-pointer min-h-[180px] group">
                              <input
                                type="file"
                                accept=".xlsx,.xls,.csv,.docx,.txt"
                                onChange={handleImportFileChange}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                disabled={isImporting}
                              />
                              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 mb-3 group-hover:scale-110 transition-transform">
                                <UploadCloud className="h-6 w-6" />
                              </div>
                              <div>
                                <p className="text-sm font-bold text-foreground">
                                  {isImporting ? 'A ler ficheiro...' : 'Arraste o ficheiro ou clique para seleccionar'}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1.5 font-medium">
                                  Formatos aceites: Excel (.xlsx, .xls, .csv) ou Word (.docx, .txt)
                                </p>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                              <div className="p-3 bg-muted/20 border border-border/60 rounded-xl">
                                <div className="flex items-center gap-1.5 text-xs font-bold text-foreground mb-1">
                                  <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
                                  <span>Importação por Excel / CSV</span>
                                </div>
                                <p className="text-[11px] text-muted-foreground leading-relaxed">
                                  O ficheiro Excel deve conter colunas de dados, com cabeçalhos como <strong className="text-foreground">Nº</strong> e <strong className="text-foreground">Nome Completo</strong>. Os dados adicionais como morada e nascimento também são importados caso existam.
                                </p>
                              </div>
                              <div className="p-3 bg-muted/20 border border-border/60 rounded-xl">
                                <div className="flex items-center gap-1.5 text-xs font-bold text-foreground mb-1">
                                  <FileText className="h-4 w-4 text-blue-500" />
                                  <span>Importação por Word / Texto</span>
                                </div>
                                <p className="text-[11px] text-muted-foreground leading-relaxed">
                                  O documento Word deve conter a lista dos alunos, com cada nome em uma nova linha formatado com ou sem número de ordem (Ex: <strong className="text-foreground">"1 - João Manuel"</strong> ou simplesmente <strong className="text-foreground">"João Manuel"</strong>).
                                </p>
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="space-y-3">
                            <Label className="text-xs font-bold text-foreground block">
                              Cole a lista de nomes dos alunos abaixo (um nome por linha):
                            </Label>
                            <textarea
                              value={pastedNames}
                              onChange={(e) => setPastedNames(e.target.value)}
                              placeholder={`Filipe Macuácua&#10;Amélia Nhaca&#10;Geraldo Chivambo`}
                              className="w-full h-44 px-3 py-2 text-xs border border-border rounded-xl bg-muted/10 text-foreground placeholder:text-muted-foreground/60 focus-visible:outline-none focus:border-purple-500 transition-colors font-sans leading-relaxed resize-none"
                            />
                            <p className="text-[10px] text-muted-foreground italic leading-relaxed">
                              O sistema irá numerar automaticamente cada aluno de 1 até o fim da lista.
                            </p>
                            <Button
                              onClick={handleProcessPastedNames}
                              className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl h-10 text-xs cursor-pointer border-0 mt-1"
                              disabled={isImporting}
                            >
                              Processar e Numerar Alunos
                            </Button>
                          </div>
                        )}

                        {importError && (
                          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs font-semibold text-red-500 flex items-start gap-2 animate-in fade-in duration-150">
                            <span className="text-sm">⚠️</span>
                            <span className="flex-1 leading-relaxed">{importError}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-4 py-4">
                        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-between text-xs font-extrabold text-emerald-600 dark:text-emerald-400">
                          <div className="flex items-center gap-2">
                            <Check className="h-4 w-4 stroke-[3]" />
                            <span>Leitura de ficheiro concluída!</span>
                          </div>
                          <span>{previewStudents.length} alunos identificados</span>
                        </div>

                        <div className="border border-border rounded-xl spill-overlay overflow-hidden max-h-[260px] overflow-y-auto">
                          <Table>
                            <TableHeader className="bg-muted/50 sticky top-0 z-10 font-bold">
                              <TableRow className="hover:bg-transparent border-b border-border">
                                <TableHead className="w-16 h-9 text-[11px] font-extrabold text-foreground uppercase tracking-wider">Nº</TableHead>
                                <TableHead className="h-9 text-[11px] font-extrabold text-foreground uppercase tracking-wider">Nome Completo</TableHead>
                                {selectedClass?.isDirector && (
                                  <>
                                    <TableHead className="h-9 text-[11px] font-extrabold text-foreground uppercase tracking-wider">Nascimento</TableHead>
                                    <TableHead className="h-9 text-[11px] font-extrabold text-foreground uppercase tracking-wider">Naturalidade</TableHead>
                                  </>
                                )}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {previewStudents.map((st, sidx) => (
                                <TableRow key={st.id || sidx} className="h-9 hover:bg-muted/10 border-b border-border/50">
                                  <TableCell className="py-1 text-xs font-mono font-bold text-muted-foreground/80">{st.studentNumber || (sidx + 1)}</TableCell>
                                  <TableCell className="py-1 text-xs font-bold text-foreground truncate max-w-[200px]">{st.name}</TableCell>
                                  {selectedClass?.isDirector && (
                                    <>
                                      <TableCell className="py-1 text-xs text-muted-foreground truncate max-w-[100px]">{st.dob || '-'}</TableCell>
                                      <TableCell className="py-1 text-xs text-muted-foreground truncate max-w-[100px]">{st.birthplace || '-'}</TableCell>
                                    </>
                                  )}
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>

                        <p className="text-[11px] text-muted-foreground italic font-medium leading-relaxed">
                          Reveja a tabela acima. Ao prosseguir, todos os {previewStudents.length} alunos serão importados directamente para a turma {selectedClass?.section}.
                        </p>
                      </div>
                    )}

                    <DialogFooter className="flex flex-row items-center gap-3 mt-2">
                      {previewStudents.length === 0 ? (
                        <Button
                          variant="outline"
                          onClick={() => setIsImportOpen(false)}
                          className="flex-1 rounded-xl h-10 text-xs font-bold cursor-pointer"
                          disabled={isImporting}
                        >
                          Cancelar
                        </Button>
                      ) : (
                        <>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setPreviewStudents([]);
                              setImportError('');
                            }}
                            className="flex-1 rounded-xl h-10 text-xs font-bold cursor-pointer"
                            disabled={isImporting}
                          >
                            Carregar Outro
                          </Button>
                          <Button
                            onClick={confirmImportStudents}
                            className="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl h-10 text-xs cursor-pointer border-0"
                            disabled={isImporting}
                          >
                            {isImporting ? 'A guardar...' : 'Confirmar Importação'}
                          </Button>
                        </>
                      )}
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
                <div className="w-full flex flex-col">
                  {/* Trimester Tabs - Option A Placement */}
                  <div className="px-5 pt-5 pb-4 border-b border-border/40 bg-muted/15 dark:bg-muted/5">
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#7B2FBE] dark:text-purple-400 font-mono">
                        Período Lectivo
                      </span>
                      <div className="relative flex p-1 bg-muted/60 dark:bg-muted/40 rounded-xl w-full max-w-md border border-border/40 select-none">
                        <button 
                          onClick={() => {
                            setSelectedTrimester('1');
                            toast.success("1º Trimestre seleccionado", { id: "trimester-selection" });
                          }}
                          className={`relative flex-1 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-colors z-10 cursor-pointer flex items-center justify-center gap-1.5 h-8.5 select-none ${
                            selectedTrimester === '1' ? 'text-white font-bold' : 'text-muted-foreground hover:text-foreground font-medium'
                          }`}
                        >
                          {selectedTrimester === '1' && (
                            <motion.div 
                              layoutId="activeTrimesterIndicator" 
                              className="absolute inset-0 bg-[#7B2FBE] rounded-lg -z-10 shadow-sm shadow-[#7B2FBE]/20"
                              transition={{ type: "spring", stiffness: 380, damping: 30 }}
                            />
                          )}
                          <span>1º Trimestre</span>
                        </button>
                        <button 
                          onClick={() => {
                            setSelectedTrimester('2');
                            toast.success("2º Trimestre seleccionado", { id: "trimester-selection" });
                          }}
                          className={`relative flex-1 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-colors z-10 cursor-pointer flex items-center justify-center gap-1.5 h-8.5 select-none ${
                            selectedTrimester === '2' ? 'text-white font-bold' : 'text-muted-foreground hover:text-foreground font-medium'
                          }`}
                        >
                          {selectedTrimester === '2' && (
                            <motion.div 
                              layoutId="activeTrimesterIndicator" 
                              className="absolute inset-0 bg-[#7B2FBE] rounded-lg -z-10 shadow-sm shadow-[#7B2FBE]/20"
                              transition={{ type: "spring", stiffness: 380, damping: 30 }}
                            />
                          )}
                          <span>2º Trimestre</span>
                        </button>
                        <button 
                          onClick={() => {
                            setSelectedTrimester('3');
                            toast.success("3º Trimestre seleccionado", { id: "trimester-selection" });
                          }}
                          className={`relative flex-1 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-colors z-10 cursor-pointer flex items-center justify-center gap-1.5 h-8.5 select-none ${
                            selectedTrimester === '3' ? 'text-white font-bold' : 'text-muted-foreground hover:text-foreground font-medium'
                          }`}
                        >
                          {selectedTrimester === '3' && (
                            <motion.div 
                              layoutId="activeTrimesterIndicator" 
                              className="absolute inset-0 bg-[#7B2FBE] rounded-lg -z-10 shadow-sm shadow-[#7B2FBE]/20"
                              transition={{ type: "spring", stiffness: 380, damping: 30 }}
                            />
                          )}
                          <span>3º Trimestre</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {showApoioBanner && studentsNeedingApoio.length > 0 && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0, marginTop: 0 }}
                      animate={{ opacity: 1, height: 'auto', marginTop: 16 }}
                      transition={{ duration: 0.3 }}
                      className="relative mx-5 p-4 rounded-xl border border-red-200/60 dark:border-red-900/40 bg-red-500/10 dark:bg-red-500/5 text-red-700 dark:text-red-400 font-medium"
                    >
                      {/* Close button at the top-right of the card */}
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => setShowApoioBanner(false)}
                        className="absolute top-3 right-3 h-8 w-8 hover:bg-red-500/20 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 rounded-lg cursor-pointer transition-colors z-20"
                        title="Fechar Alerta"
                      >
                        <X className="h-4 w-4" />
                      </Button>

                      {/* Content Container */}
                      <div className="pr-10">
                        {/* Title with icon directly to the left */}
                        <div className="flex items-center gap-2 mb-2">
                          <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 animate-pulse" />
                          <h4 className="font-extrabold text-sm text-red-850 dark:text-red-300">
                            Alerta!
                          </h4>
                        </div>

                        <p className="text-xs text-red-750 dark:text-red-450 leading-relaxed text-justify">
                          Há <strong className="font-extrabold">{studentsNeedingApoio.length}</strong> {studentsNeedingApoio.length === 1 ? 'aluno com alertas activos' : 'alunos com alertas activos'} neste período. Recomenda-se prestar o apoio pedagógico necessário a estes casos:
                        </p>

                        <div className="flex flex-wrap gap-2 mt-3">
                          {studentsNeedingApoio.map(s => {
                            const status = getApoioAlertStatus(s, selectedTrimester);
                            const sGrades = getStudentGrades(s, selectedTrimester);
                            const mediaGVal = calculateGeneralAverage(sGrades);
                            
                            // Determine display value
                            let displayVal = mediaGVal;
                            if (mediaGVal === '-') {
                              // If no general average yet, show the negative ACS 1 grade that is triggering it
                              displayVal = sGrades.acs1 || '-';
                            }

                            const isRed = status === 'red';

                            return (
                              <button 
                                key={s.id} 
                                onClick={() => {
                                  setHighlightedStudentId(s.id);
                                  const el = document.getElementById(`student-row-${s.id}`);
                                  if (el) {
                                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                  }
                                }}
                                className={`inline-flex items-center gap-1.5 border px-2.5 py-1 rounded-lg text-xs font-bold transition-all shadow-3xs cursor-pointer select-none ${
                                  isRed 
                                    ? 'bg-red-100 hover:bg-red-200 dark:bg-red-950/40 dark:hover:bg-red-950/60 border-red-300 dark:border-red-900/35 text-red-800 dark:text-red-300'
                                    : 'bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/30 dark:hover:bg-amber-950/50 border-amber-300 dark:border-amber-900/30 text-amber-800 dark:text-amber-300'
                                }`}
                                title="Clique para localizar na tabela"
                              >
                                <span className="opacity-70">Nº {s.studentNumber || '-'}</span>
                                <span className="font-extrabold tracking-tight">{s.name.split(' ')[0]}</span>
                                <span className={`text-[10px] font-extrabold px-1 py-0.2 rounded-md ${
                                  isRed
                                    ? 'bg-red-200/80 dark:bg-red-900/60 text-red-700 dark:text-red-400'
                                    : 'bg-amber-200/80 dark:bg-amber-900/60 text-amber-700 dark:text-amber-400'
                                }`}>
                                  {displayVal}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {selectedClass.isDirector ? (
                  <div className="w-full">
                    {/* Segmented Control Switcher with Sliding Active Indicator */}
                    <div className="px-5 pt-5 pb-3">
                      <div className="relative flex p-1 bg-muted/60 rounded-xl max-w-md w-full border border-border/40 select-none">
                        <button 
                          className={`relative flex-1 py-2 text-xs sm:text-sm font-bold rounded-lg transition-colors z-10 cursor-pointer flex items-center justify-center gap-1.5 h-9 ${
                            activeTab === 'avaliacoes' ? 'text-purple-600 dark:text-purple-400 font-extrabold' : 'text-muted-foreground hover:text-foreground'
                          }`}
                          onClick={() => setActiveTab('avaliacoes')}
                        >
                          {activeTab === 'avaliacoes' && (
                            <motion.div 
                              layoutId="activeTabIndicator" 
                              className="absolute inset-0 bg-background dark:bg-muted-foreground/15 rounded-lg shadow-sm -z-10"
                              transition={{ type: "spring", stiffness: 380, damping: 30 }}
                            />
                          )}
                          <span>Avaliações</span>
                        </button>
                        <button 
                          className={`relative flex-1 py-2 text-xs sm:text-sm font-bold rounded-lg transition-colors z-10 cursor-pointer flex items-center justify-center gap-1.5 h-9 ${
                            activeTab === 'dados' ? 'text-purple-600 dark:text-purple-400 font-extrabold' : 'text-muted-foreground hover:text-foreground'
                          }`}
                          onClick={() => setActiveTab('dados')}
                        >
                          {activeTab === 'dados' && (
                            <motion.div 
                              layoutId="activeTabIndicator" 
                              className="absolute inset-0 bg-background dark:bg-muted-foreground/15 rounded-lg shadow-sm -z-10"
                              transition={{ type: "spring", stiffness: 380, damping: 30 }}
                            />
                          )}
                          <span>Dados dos Alunos</span>
                        </button>
                      </div>
                    </div>

                    {activeTab === 'avaliacoes' ? (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader className="bg-muted/50">
                            <TableRow className="h-12 border-b border-border/50">
                              <TableHead className="w-[60px] font-bold text-foreground">Nº</TableHead>
                              <TableHead className="w-[250px] font-bold text-foreground">Nome do Aluno</TableHead>
                              <TableHead className="w-[90px] text-center font-bold text-foreground">ACS 1</TableHead>
                              <TableHead className="w-[90px] text-center font-bold text-foreground">ACS 2</TableHead>
                              <TableHead className="w-[90px] text-center font-bold text-foreground">ACS 3</TableHead>
                              <TableHead className="w-[90px] text-center font-bold text-purple-600 dark:text-purple-400">Média</TableHead>
                              <TableHead className="w-[90px] text-center font-bold text-foreground">AP</TableHead>
                              <TableHead className="w-[90px] text-center font-bold text-foreground">Exame</TableHead>
                              <TableHead className="w-[100px] text-center font-bold text-foreground">Média Geral</TableHead>
                              <TableHead className="w-[80px] text-right font-bold text-foreground">Ações</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredStudents.map((student, idx) => {
                              const studentGrades = getStudentGrades(student, selectedTrimester);
                              return (
                                <TableRow 
                                  key={student.id} 
                                  id={`student-row-${student.id}`}
                                  className={`scroll-mt-36 h-16 transition-all duration-200 border-l-2 sm:border-l-4 ${
                                    student.id === highlightedStudentId 
                                      ? 'bg-purple-500/10 dark:bg-purple-500/20 border-l-purple-500 shadow-sm font-medium' 
                                      : 'hover:bg-muted/40 odd:bg-muted/15 even:bg-transparent border-l-transparent'
                                  }`}
                                >
                                  <TableCell className="font-medium text-muted-foreground align-middle">{student.studentNumber || '-'}</TableCell>
                                  <TableCell 
                                    className={`font-semibold align-middle cursor-pointer transition-colors select-none ${
                                      student.id === highlightedStudentId 
                                        ? 'text-purple-600 dark:text-purple-400 font-extrabold' 
                                        : 'text-foreground hover:text-purple-600 dark:hover:text-purple-400'
                                    }`}
                                    onClick={() => setHighlightedStudentId(prev => prev === student.id ? null : student.id)}
                                    title="Clique para destacar este aluno"
                                  >
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span>{student.name}</span>
                                      {(() => {
                                        const status = getApoioAlertStatus(student, selectedTrimester);
                                        if (status === 'none') return null;
                                        const isRed = status === 'red';
                                        return (
                                          <span 
                                            className={`inline-flex items-center gap-0.5 text-[9px] font-extrabold px-1.5 py-0.5 rounded-sm border uppercase tracking-widest leading-none shrink-0 ${
                                              isRed
                                                ? 'bg-red-100 dark:bg-red-950/45 text-red-600 dark:text-red-400 border-red-200/50 dark:border-red-900/20'
                                                : 'bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200/50 dark:border-amber-900/20'
                                            }`} 
                                            title={isRed ? "Necessita de Alerta Académico Crítico" : "Necessita de Orientação/Alerta Pedagógico"}
                                          >
                                            Alerta
                                          </span>
                                        );
                                      })()}
                                      {student.id === highlightedStudentId && (
                                        <span className="inline-flex h-2 w-2 rounded-full bg-purple-500 animate-pulse shrink-0" />
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="align-middle">
                                    <div className="flex flex-col items-center justify-center">
                                      <Input 
                                        className={`h-8 w-16 text-center px-1 border-transparent hover:border-border focus:border-primary bg-transparent hover:bg-background/50 transition-all font-semibold ${getGradeColor(studentGrades.acs1)}`}
                                        value={studentGrades.acs1 || ''} 
                                        onChange={(e) => updateGrade(student.id, 'acs1', e.target.value)}
                                        placeholder="-"
                                      />
                                      {renderGradeIndicator(studentGrades.acs1)}
                                    </div>
                                  </TableCell>
                                  <TableCell className="align-middle">
                                    <div className="flex flex-col items-center justify-center">
                                      <Input 
                                        className={`h-8 w-16 text-center px-1 border-transparent hover:border-border focus:border-primary bg-transparent hover:bg-background/50 transition-all font-semibold ${getGradeColor(studentGrades.acs2)}`}
                                        value={studentGrades.acs2 || ''} 
                                        onChange={(e) => updateGrade(student.id, 'acs2', e.target.value)}
                                        placeholder="-"
                                      />
                                      {renderGradeIndicator(studentGrades.acs2)}
                                    </div>
                                  </TableCell>
                                  <TableCell className="align-middle">
                                    <div className="flex flex-col items-center justify-center">
                                      <Input 
                                        className={`h-8 w-16 text-center px-1 border-transparent hover:border-border focus:border-primary bg-transparent hover:bg-background/50 transition-all font-semibold ${getGradeColor(studentGrades.acs3)}`}
                                        value={studentGrades.acs3 || ''} 
                                        onChange={(e) => updateGrade(student.id, 'acs3', e.target.value)}
                                        placeholder="-"
                                      />
                                      {renderGradeIndicator(studentGrades.acs3)}
                                    </div>
                                  </TableCell>
                                  <TableCell className="align-middle text-center bg-purple-500/5 dark:bg-purple-500/5">
                                    <div className="flex flex-col items-center justify-center">
                                      <span className={`font-bold text-sm ${getGradeColor(calculateAcsAverage(studentGrades), true) || 'text-foreground'}`}>
                                        {calculateAcsAverage(studentGrades)}
                                      </span>
                                      {renderGradeIndicator(calculateAcsAverage(studentGrades))}
                                    </div>
                                  </TableCell>
                                  <TableCell className="align-middle">
                                    <div className="flex flex-col items-center justify-center">
                                      <Input 
                                        className={`h-8 w-16 text-center px-1 border-transparent hover:border-border focus:border-primary bg-transparent hover:bg-background/50 transition-all font-semibold ${getGradeColor(studentGrades.ap)}`}
                                        value={studentGrades.ap || ''} 
                                        onChange={(e) => updateGrade(student.id, 'ap', e.target.value)}
                                        placeholder="-"
                                      />
                                      {renderGradeIndicator(studentGrades.ap)}
                                    </div>
                                  </TableCell>
                                  <TableCell className="align-middle">
                                    <div className="flex flex-col items-center justify-center">
                                      <Input 
                                        className={`h-8 w-16 text-center px-1 border-transparent hover:border-border focus:border-primary bg-transparent hover:bg-background/50 transition-all font-semibold ${getGradeColor(studentGrades.exame)}`}
                                        value={studentGrades.exame || ''} 
                                        onChange={(e) => updateGrade(student.id, 'exame', e.target.value)}
                                        placeholder="-"
                                      />
                                      {renderGradeIndicator(studentGrades.exame)}
                                    </div>
                                  </TableCell>
                                  <TableCell className="align-middle text-center bg-amber-500/5 dark:bg-amber-500/5">
                                    <div className="flex flex-col items-center justify-center">
                                      <span className={`font-bold text-sm ${getGradeColor(calculateGeneralAverage(studentGrades), true) || 'text-foreground'}`}>
                                        {calculateGeneralAverage(studentGrades)}
                                      </span>
                                      {renderGradeIndicator(calculateGeneralAverage(studentGrades))}
                                      {(() => {
                                        const status = getApoioAlertStatus(student, selectedTrimester);
                                        if (status === 'none') return null;
                                        const isRed = status === 'red';
                                        return (
                                          <div className={`flex items-center gap-1 mt-1 border px-1.5 py-0.5 rounded-full select-none text-[9px] font-bold max-w-fit mx-auto shadow-3xs ${
                                            isRed
                                              ? 'bg-red-100 dark:bg-red-950/30 border-red-200/60 dark:border-red-900/30 text-red-600 dark:text-red-400'
                                              : 'bg-amber-100 dark:bg-amber-950/20 border-amber-200/60 dark:border-amber-900/30 text-amber-600 dark:text-amber-400'
                                          }`}>
                                            <AlertTriangle className={`h-2.5 w-2.5 shrink-0 animate-pulse ${isRed ? 'text-red-600 dark:text-red-400' : 'text-amber-500 dark:text-amber-400'}`} />
                                            <span>Alerta</span>
                                          </div>
                                        );
                                      })()}
                                    </div>
                                  </TableCell>
                                  <TableCell className="align-middle text-right">
                                    <div className="flex justify-end gap-1">
                                      <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg cursor-pointer"
                                        onClick={() => setEditingStudent(student)}
                                        title="Editar Aluno"
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                      <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg cursor-pointer"
                                        onClick={() => confirmDeleteStudent(student.id)}
                                        title="Remover Aluno"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader className="bg-muted/50">
                            <TableRow className="h-12 border-b border-border/50">
                              <TableHead className="w-[60px] font-bold text-foreground">Nº</TableHead>
                              <TableHead className="w-[200px] font-bold text-foreground">Nome do Aluno</TableHead>
                              <TableHead className="w-[120px] font-bold text-foreground">Data Nasc.</TableHead>
                              <TableHead className="w-[150px] font-bold text-foreground">Local Nasc.</TableHead>
                              <TableHead className="w-[150px] font-bold text-foreground">Morada</TableHead>
                              <TableHead className="w-[200px] font-bold text-foreground">Encarregado (EE)</TableHead>
                              <TableHead className="w-[120px] font-bold text-foreground">Contacto EE</TableHead>
                              <TableHead className="w-[80px] text-right font-bold text-foreground">Ações</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredStudents.map((student, idx) => (
                              <TableRow 
                                key={student.id} 
                                className={`h-16 transition-all duration-200 border-l-2 sm:border-l-4 ${
                                  student.id === highlightedStudentId 
                                    ? 'bg-purple-500/10 dark:bg-purple-500/20 border-l-purple-500 shadow-sm font-medium' 
                                    : 'hover:bg-muted/40 odd:bg-muted/15 even:bg-transparent border-l-transparent'
                                }`}
                              >
                                <TableCell className="font-medium text-muted-foreground align-middle">{student.studentNumber || '-'}</TableCell>
                                <TableCell 
                                  className={`font-semibold align-middle cursor-pointer transition-colors select-none ${
                                    student.id === highlightedStudentId 
                                      ? 'text-purple-600 dark:text-purple-400 font-extrabold' 
                                      : 'text-foreground hover:text-purple-600 dark:hover:text-purple-400'
                                  }`}
                                  onClick={() => setHighlightedStudentId(prev => prev === student.id ? null : student.id)}
                                  title="Clique para destacar este aluno"
                                >
                                  <div className="flex items-center gap-1.5">
                                    <span>{student.name}</span>
                                    {student.id === highlightedStudentId && (
                                      <span className="inline-flex h-2 w-2 rounded-full bg-purple-500 animate-pulse" />
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground align-middle">{student.dob ? new Date(student.dob).toLocaleDateString('pt-PT') : '-'}</TableCell>
                                <TableCell className="text-sm text-muted-foreground align-middle">{student.birthplace || '-'}</TableCell>
                                <TableCell className="text-sm text-muted-foreground align-middle">{student.address || '-'}</TableCell>
                                <TableCell className="text-sm text-muted-foreground align-middle">
                                  <div className="flex flex-col">
                                    <span className="font-semibold text-foreground">{student.parentName || '-'}</span>
                                    {student.parentProfession && <span className="text-[10px] text-muted-foreground/75 font-mono">{student.parentProfession}</span>}
                                  </div>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground align-middle">{student.parentContact || '-'}</TableCell>
                                <TableCell className="align-middle text-right">
                                  <div className="flex justify-end gap-1">
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg cursor-pointer"
                                      onClick={() => setEditingStudent(student)}
                                      title="Editar Aluno"
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg cursor-pointer"
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
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow className="h-12 border-b border-border/50">
                          <TableHead className="w-[60px] font-bold text-foreground">Nº</TableHead>
                          <TableHead className="w-[250px] font-bold text-foreground">Nome do Aluno</TableHead>
                          <TableHead className="w-[90px] text-center font-bold text-foreground">ACS 1</TableHead>
                          <TableHead className="w-[90px] text-center font-bold text-foreground">ACS 2</TableHead>
                          <TableHead className="w-[90px] text-center font-bold text-foreground">ACS 3</TableHead>
                          <TableHead className="w-[90px] text-center font-bold text-purple-600 dark:text-purple-400">Média</TableHead>
                          <TableHead className="w-[90px] text-center font-bold text-foreground">AP</TableHead>
                          <TableHead className="w-[90px] text-center font-bold text-foreground">Exame</TableHead>
                          <TableHead className="w-[100px] text-center font-bold text-foreground">Média Geral</TableHead>
                          <TableHead className="w-[80px] text-right font-bold text-foreground">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredStudents.map((student, idx) => {
                          const studentGrades = getStudentGrades(student, selectedTrimester);
                          return (
                            <TableRow 
                              key={student.id} 
                              id={`student-row-${student.id}`}
                              className={`scroll-mt-36 h-16 transition-all duration-200 border-l-2 sm:border-l-4 ${
                                student.id === highlightedStudentId 
                                  ? 'bg-purple-500/10 dark:bg-purple-500/20 border-l-purple-500 shadow-sm font-medium' 
                                  : 'hover:bg-muted/40 odd:bg-muted/15 even:bg-transparent border-l-transparent'
                              }`}
                            >
                              <TableCell className="font-medium text-muted-foreground align-middle">{student.studentNumber || '-'}</TableCell>
                              <TableCell 
                                className={`font-semibold align-middle cursor-pointer transition-colors select-none ${
                                  student.id === highlightedStudentId 
                                    ? 'text-purple-600 dark:text-purple-400 font-extrabold' 
                                    : 'text-foreground hover:text-purple-600 dark:hover:text-purple-400'
                                }`}
                                onClick={() => setHighlightedStudentId(prev => prev === student.id ? null : student.id)}
                                title="Clique para destacar este aluno"
                              >
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span>{student.name}</span>
                                  {(() => {
                                    const status = getApoioAlertStatus(student, selectedTrimester);
                                    if (status === 'none') return null;
                                    const isRed = status === 'red';
                                    return (
                                      <span 
                                        className={`inline-flex items-center gap-0.5 text-[9px] font-extrabold px-1.5 py-0.5 rounded-sm border uppercase tracking-widest leading-none shrink-0 ${
                                          isRed
                                            ? 'bg-red-100 dark:bg-red-950/45 text-red-600 dark:text-red-400 border-red-200/50 dark:border-red-900/20'
                                            : 'bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200/50 dark:border-amber-900/20'
                                        }`} 
                                        title={isRed ? "Necessita de Alerta Académico Crítico" : "Necessita de Orientação/Alerta Pedagógico"}
                                      >
                                        Alerta
                                      </span>
                                    );
                                  })()}
                                  {student.id === highlightedStudentId && (
                                    <span className="inline-flex h-2 w-2 rounded-full bg-purple-500 animate-pulse shrink-0" />
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="align-middle">
                                <div className="flex flex-col items-center justify-center">
                                  <Input 
                                    className={`h-8 w-16 text-center px-1 border-transparent hover:border-border focus:border-primary bg-transparent hover:bg-background/50 transition-all font-semibold ${getGradeColor(studentGrades.acs1)}`}
                                    value={studentGrades.acs1 || ''} 
                                    onChange={(e) => updateGrade(student.id, 'acs1', e.target.value)}
                                    placeholder="-"
                                  />
                                  {renderGradeIndicator(studentGrades.acs1)}
                                </div>
                              </TableCell>
                              <TableCell className="align-middle">
                                <div className="flex flex-col items-center justify-center">
                                  <Input 
                                    className={`h-8 w-16 text-center px-1 border-transparent hover:border-border focus:border-primary bg-transparent hover:bg-background/50 transition-all font-semibold ${getGradeColor(studentGrades.acs2)}`}
                                    value={studentGrades.acs2 || ''} 
                                    onChange={(e) => updateGrade(student.id, 'acs2', e.target.value)}
                                    placeholder="-"
                                  />
                                  {renderGradeIndicator(studentGrades.acs2)}
                                </div>
                              </TableCell>
                              <TableCell className="align-middle">
                                <div className="flex flex-col items-center justify-center">
                                  <Input 
                                    className={`h-8 w-16 text-center px-1 border-transparent hover:border-border focus:border-primary bg-transparent hover:bg-background/50 transition-all font-semibold ${getGradeColor(studentGrades.acs3)}`}
                                    value={studentGrades.acs3 || ''} 
                                    onChange={(e) => updateGrade(student.id, 'acs3', e.target.value)}
                                    placeholder="-"
                                  />
                                  {renderGradeIndicator(studentGrades.acs3)}
                                </div>
                              </TableCell>
                              <TableCell className="align-middle text-center bg-purple-500/5 dark:bg-purple-500/5">
                                <div className="flex flex-col items-center justify-center">
                                  <span className={`font-bold text-sm ${getGradeColor(calculateAcsAverage(studentGrades), true) || 'text-foreground'}`}>
                                    {calculateAcsAverage(studentGrades)}
                                  </span>
                                  {renderGradeIndicator(calculateAcsAverage(studentGrades))}
                                </div>
                              </TableCell>
                              <TableCell className="align-middle">
                                <div className="flex flex-col items-center justify-center">
                                  <Input 
                                    className={`h-8 w-16 text-center px-1 border-transparent hover:border-border focus:border-primary bg-transparent hover:bg-background/50 transition-all font-semibold ${getGradeColor(studentGrades.ap)}`}
                                    value={studentGrades.ap || ''} 
                                    onChange={(e) => updateGrade(student.id, 'ap', e.target.value)}
                                    placeholder="-"
                                  />
                                  {renderGradeIndicator(studentGrades.ap)}
                                </div>
                              </TableCell>
                              <TableCell className="align-middle">
                                <div className="flex flex-col items-center justify-center">
                                  <Input 
                                    className={`h-8 w-16 text-center px-1 border-transparent hover:border-border focus:border-primary bg-transparent hover:bg-background/50 transition-all font-semibold ${getGradeColor(studentGrades.exame)}`}
                                    value={studentGrades.exame || ''} 
                                    onChange={(e) => updateGrade(student.id, 'exame', e.target.value)}
                                    placeholder="-"
                                  />
                                  {renderGradeIndicator(studentGrades.exame)}
                                </div>
                              </TableCell>
                              <TableCell className="align-middle text-center bg-amber-500/5 dark:bg-amber-500/5">
                                <div className="flex flex-col items-center justify-center">
                                  <span className={`font-bold text-sm ${getGradeColor(calculateGeneralAverage(studentGrades), true) || 'text-foreground'}`}>
                                    {calculateGeneralAverage(studentGrades)}
                                  </span>
                                  {renderGradeIndicator(calculateGeneralAverage(studentGrades))}
                                  {(() => {
                                    const status = getApoioAlertStatus(student, selectedTrimester);
                                    if (status === 'none') return null;
                                    const isRed = status === 'red';
                                    return (
                                      <div className={`flex items-center gap-1 mt-1 border px-1.5 py-0.5 rounded-full select-none text-[9px] font-bold max-w-fit mx-auto shadow-3xs ${
                                        isRed
                                          ? 'bg-red-100 dark:bg-red-950/30 border-red-200/60 dark:border-red-900/30 text-red-600 dark:text-red-400'
                                          : 'bg-amber-100 dark:bg-amber-950/20 border-amber-200/60 dark:border-amber-900/30 text-amber-600 dark:text-amber-400'
                                      }`}>
                                        <AlertTriangle className={`h-2.5 w-2.5 shrink-0 animate-pulse ${isRed ? 'text-red-600 dark:text-red-400' : 'text-amber-500 dark:text-amber-400'}`} />
                                        <span>Alerta</span>
                                      </div>
                                    );
                                  })()}
                                </div>
                              </TableCell>
                              <TableCell className="align-middle text-right">
                                <div className="flex justify-end gap-1">
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg cursor-pointer"
                                    onClick={() => setEditingStudent(student)}
                                    title="Editar Aluno"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg cursor-pointer"
                                    onClick={() => confirmDeleteStudent(student.id)}
                                    title="Remover Aluno"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-border/40 py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left text-xs text-muted-foreground/80 font-medium">
          <p>
            &copy; {new Date().getFullYear()} EduGestão. Todos os direitos reservados.
          </p>
          <p className="flex items-center gap-1.5">
            <span>Desenvolvido por</span>
            <a 
              href="https://www.linkedin.com/in/saidehassan" 
              target="_blank" 
              rel="noreferrer" 
              className="font-bold text-primary hover:text-primary/85 hover:underline transition-all cursor-pointer inline-flex items-center"
            >
              Saide Hassan
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
