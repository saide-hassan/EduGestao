import React, { useState, useRef, useMemo } from 'react';
import {
  ChevronLeft,
  Save,
  BookOpen,
  AlertCircle,
  CheckCircle2,
  Users,
  Search,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  type ClassData,
  type Student,
  type SubjectKey,
  MEDIA_GERAL_SUBJECTS,
  getStudentSubjectGrades,
  calculateMediaGeralForStudent,
  filterStudentByQuery,
} from '@/lib/grade-utils';

interface AddGradesBySubjectViewProps {
  selectedClass: ClassData;
  students: Student[];
  studentOrderMap: Map<string, string>;
  trimester: '1' | '2' | '3';
  onTrimesterChange: (trimester: '1' | '2' | '3') => void;
  onSaveGrades: (
    updatesByTrimester: Record<string, Record<string, Record<string, string>>>
  ) => Promise<void>;
  onBack: () => void;
}

const makeDraftKey = (
  trimester: '1' | '2' | '3',
  subjectKey: string,
  studentId: string
) => `${trimester}::${subjectKey}::${studentId}`;

const validateGradeValue = (
  raw: string
): { valid: boolean; numeric: number | null; error?: string } => {
  const trimmed = raw.trim();
  if (trimmed === '') {
    return { valid: true, numeric: null };
  }
  const normalized = trimmed.replace(',', '.');
  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) {
    return {
      valid: false,
      numeric: null,
      error: 'Introduza apenas um valor numérico entre 0 e 20.',
    };
  }
  const num = parseFloat(normalized);
  if (isNaN(num) || num < 0 || num > 20) {
    return {
      valid: false,
      numeric: num,
      error: 'A nota deve estar entre 0 e 20.',
    };
  }
  return { valid: true, numeric: num };
};

export const AddGradesBySubjectView: React.FC<AddGradesBySubjectViewProps> = ({
  selectedClass,
  students,
  studentOrderMap,
  trimester,
  onTrimesterChange,
  onSaveGrades,
  onBack,
}) => {
  const [selectedSubjectKey, setSelectedSubjectKey] = useState<SubjectKey | ''>('');
  const [searchQuery, setSearchQuery] = useState('');
  // Rascunhos guardados por `${trimester}::${subjectKey}::${studentId}` para nunca perder alterações ao mudar de trimestre ou disciplina
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [showLeavePrompt, setShowLeavePrompt] = useState(false);

  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const selectedSubjectMeta = useMemo(
    () => MEDIA_GERAL_SUBJECTS.find((s) => s.key === selectedSubjectKey) || null,
    [selectedSubjectKey]
  );

  // Obter valor efectivo (rascunho não guardado ou valor actual na Pauta da Turma)
  const getEffectiveValue = (
    student: Student,
    targetTrimester: '1' | '2' | '3',
    subjectKey: string
  ): string => {
    const key = makeDraftKey(targetTrimester, subjectKey, student.id);
    if (Object.prototype.hasOwnProperty.call(drafts, key)) {
      return drafts[key];
    }
    const subGrades = getStudentSubjectGrades(student, targetTrimester);
    return subGrades[subjectKey] || '';
  };

  // Quantidade total de alterações não guardadas (em todos os trimestres/disciplinas)
  const pendingDraftEntries = useMemo(() => {
    return Object.entries<string>(drafts).filter(([key, draftVal]) => {
      const [t, subKey, studentId] = key.split('::') as [
        '1' | '2' | '3',
        string,
        string,
      ];
      const student = students.find((s) => s.id === studentId);
      if (!student) return false;
      const savedVal = getStudentSubjectGrades(student, t)[subKey] || '';
      return draftVal.trim() !== savedVal.trim();
    });
  }, [drafts, students]);

  const hasUnsavedDrafts = pendingDraftEntries.length > 0;

  // Verificar erros de validação em todos os rascunhos pendentes
  const allInvalidEntries = useMemo(() => {
    const invalids: Array<{
      key: string;
      trimester: '1' | '2' | '3';
      subjectKey: string;
      studentId: string;
      error: string;
    }> = [];
    for (const [key, val] of pendingDraftEntries) {
      const check = validateGradeValue(val);
      if (!check.valid) {
        const [t, subKey, studentId] = key.split('::') as [
          '1' | '2' | '3',
          string,
          string,
        ];
        invalids.push({
          key,
          trimester: t,
          subjectKey: subKey,
          studentId,
          error: check.error || 'A nota deve estar entre 0 e 20.',
        });
      }
    }
    return invalids;
  }, [pendingDraftEntries]);

  // Alunos filtrados por pesquisa
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students;
    return students.filter((s, idx) =>
      filterStudentByQuery(s, searchQuery, idx + 1)
    );
  }, [students, searchQuery]);

  // Estatísticas para a disciplina e trimestre seleccionados
  const subjectStats = useMemo(() => {
    if (!selectedSubjectKey) {
      return { total: students.length, filled: 0, missing: students.length };
    }
    let filled = 0;
    let missing = 0;
    for (const student of students) {
      const val = getEffectiveValue(student, trimester, selectedSubjectKey);
      if (val.trim() === '' || val.trim() === '-') {
        missing++;
      } else {
        filled++;
      }
    }
    return { total: students.length, filled, missing };
  }, [students, trimester, selectedSubjectKey, drafts]);

  const handleGradeChange = (student: Student, rawVal: string) => {
    if (!selectedSubjectKey) return;
    const key = makeDraftKey(trimester, selectedSubjectKey, student.id);
    const savedVal = getStudentSubjectGrades(student, trimester)[selectedSubjectKey] || '';
    // Permitir digitar dígitos, vírgula, ponto e sinal negativo (para poder mostrar validação clara se for < 0)
    const cleanInput = rawVal.replace(/[^0-9.,-]/g, '');

    setDrafts((prev) => {
      if (cleanInput === savedVal) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: cleanInput };
    });
  };

  const focusStudentInput = (index: number) => {
    const targetStudent = filteredStudents[index];
    if (!targetStudent) return;
    const el = inputRefs.current[targetStudent.id];
    if (el) {
      el.focus();
      el.select();
      el.scrollIntoView({ block: 'nearest' });
    }
  };

  const handleInputKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    idx: number
  ) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        if (idx > 0) focusStudentInput(idx - 1);
      } else if (idx + 1 < filteredStudents.length) {
        focusStudentInput(idx + 1);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (idx + 1 < filteredStudents.length) {
        focusStudentInput(idx + 1);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (idx > 0) {
        focusStudentInput(idx - 1);
      }
    }
  };

  const executeSave = async (): Promise<boolean> => {
    if (allInvalidEntries.length > 0) {
      const firstInvalid = allInvalidEntries[0];
      if (firstInvalid.trimester !== trimester) {
        onTrimesterChange(firstInvalid.trimester);
      }
      if (firstInvalid.subjectKey !== selectedSubjectKey) {
        setSelectedSubjectKey(firstInvalid.subjectKey as SubjectKey);
      }
      toast.error('Existem notas fora do intervalo permitido (0 a 20). Corrija os campos assinalados antes de guardar.');
      setTimeout(() => {
        const el = inputRefs.current[firstInvalid.studentId];
        if (el) {
          el.focus();
          el.select();
          el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
      }, 60);
      return false;
    }

    if (!hasUnsavedDrafts) {
      toast.success('Notas guardadas');
      return true;
    }

    const updatesByTrimester: Record<
      string,
      Record<string, Record<string, string>>
    > = {};

    for (const [key, val] of pendingDraftEntries) {
      const [t, subKey, studentId] = key.split('::');
      if (!updatesByTrimester[t]) updatesByTrimester[t] = {};
      if (!updatesByTrimester[t][studentId]) updatesByTrimester[t][studentId] = {};
      const trimmed = val.trim();
      updatesByTrimester[t][studentId][subKey] = trimmed;
    }

    setIsSaving(true);
    try {
      await onSaveGrades(updatesByTrimester);
      setDrafts({});
      toast.success('Notas guardadas');
      return true;
    } catch (err) {
      console.error('Erro ao guardar notas por disciplina:', err);
      toast.error('Não foi possível guardar as notas. Tente novamente.');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleBackClick = () => {
    if (hasUnsavedDrafts) {
      setShowLeavePrompt(true);
      return;
    }
    onBack();
  };

  const rawLevelDigits = (selectedClass.level || '')
    .replace(/\s*[Cc]lasse\s*/i, '')
    .replace(/[ªº]+$/g, '')
    .trim();
  const formattedLevel = rawLevelDigits
    ? `${rawLevelDigits}ª`
    : (selectedClass.level || '').trim();
  const rawSection = (selectedClass.section || '')
    .replace(/^\s*[Tt]urma\s*/i, '')
    .trim();
  const classShortLabel = [formattedLevel, rawSection].filter(Boolean).join(' ');

  return (
    <div className="space-y-4 pt-4 sm:pt-6 pb-8 animate-in fade-in duration-300">
      {/* Cabeçalho e Controlos Principais */}
      <div className="bg-card rounded-2xl border border-border shadow-xs p-4 sm:p-5 space-y-4">
        {/* Linha 1: Título da página antes dos restantes elementos */}
        <div className="flex items-center justify-center sm:justify-start">
          <h2 className="text-lg sm:text-xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-purple-600 dark:text-purple-400 shrink-0" />
            <span>Adicionar por Disciplina</span>
          </h2>
        </div>

        {/* Linha 2: Botão Voltar e identificação curta da turma (ex: 7ª C) na mesma linha */}
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-border/50">
          <Button
            variant="outline"
            onClick={handleBackClick}
            className="h-9 sm:h-10 px-3 sm:px-4 border border-purple-200 dark:border-purple-900/40 bg-purple-50/20 dark:bg-purple-950/20 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded-xl shadow-2xs flex items-center gap-1.5 cursor-pointer transition-all shrink-0 text-xs sm:text-sm font-semibold"
          >
            <ChevronLeft className="h-4.5 w-4.5 shrink-0" />
            <span>Voltar</span>
          </Button>

          {classShortLabel && (
            <span className="text-sm sm:text-base font-extrabold text-purple-700 dark:text-purple-300 bg-purple-50/70 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/50 px-3 py-1 rounded-xl shrink-0">
              {classShortLabel}
            </span>
          )}
        </div>

        {/* Linha 3: Separadores de Trimestre (sincronizados, mantendo rascunhos) */}
        <div className="flex justify-center pt-1">
          <div className="flex p-0.5 bg-muted/70 rounded-xl border border-border/40 select-none w-full sm:w-auto">
            {(['1', '2', '3'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => onTrimesterChange(t)}
                className={`flex-1 sm:flex-initial px-3 sm:px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  trimester === t
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t}º Trimestre
              </button>
            ))}
          </div>
        </div>

        {/* Orientação centralizada + Separadores rápidos de disciplina */}
        <div className="pt-3 border-t border-border/50 space-y-2.5">
          <p className="text-xs sm:text-sm font-bold text-purple-700 dark:text-purple-300 text-center">
            Seleccione a Disciplina
          </p>
          <div className="flex flex-wrap justify-center gap-1.5">
            {MEDIA_GERAL_SUBJECTS.map((sub) => {
              const isSelected = selectedSubjectKey === sub.key;
              const hasDraftInSub = pendingDraftEntries.some(([k]) =>
                k.startsWith(`${trimester}::${sub.key}::`)
              );
              return (
                <button
                  key={sub.key}
                  type="button"
                  onClick={() => setSelectedSubjectKey(sub.key)}
                  title={sub.name}
                  className={`relative px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                      : 'bg-muted/40 text-muted-foreground border-border/60 hover:border-purple-400 hover:text-foreground'
                  }`}
                >
                  <span>{sub.label}</span>
                  {hasDraftInSub && (
                    <span
                      className={`ml-1 inline-block h-1.5 w-1.5 rounded-full align-middle ${
                        isSelected ? 'bg-amber-300' : 'bg-purple-500'
                      }`}
                      title="Tem notas por guardar"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Estado inicial antes de escolher uma disciplina */}
      {!selectedSubjectMeta ? (
        <div className="bg-card rounded-2xl border border-dashed border-purple-300 dark:border-purple-900/50 p-8 sm:p-12 text-center shadow-xs">
          <div className="max-w-md mx-auto flex flex-col items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <BookOpen className="h-6 w-6" />
            </div>
            <h3 className="text-base sm:text-lg font-extrabold text-foreground">
              Escolha uma disciplina
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Selecione acima a disciplina pretendida para lançar as notas do{' '}
              <strong className="text-foreground">{trimester}º Trimestre</strong>.
            </p>
          </div>
        </div>
      ) : (
        /* Interface única de lançamento rápido por disciplina */
        <div className="bg-card rounded-2xl border border-border shadow-xs overflow-hidden">
          {/* Barra de Informação, Pesquisa e Contagem de Alunos sem Nota */}
          <div className="p-4 sm:p-5 border-b border-border/60 bg-muted/20 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-lg bg-purple-600 text-white text-xs font-extrabold">
                  {selectedSubjectMeta.label}
                </span>
                <h3 className="text-base sm:text-lg font-extrabold text-foreground">
                  {selectedSubjectMeta.name}
                </h3>
                <span className="text-xs font-semibold text-muted-foreground">
                  • {trimester}º Trimestre
                </span>
              </div>

              {/* Indicador de quantos alunos ainda não têm nota nessa disciplina */}
              <div className="flex flex-wrap items-center gap-2">
                {subjectStats.missing > 0 ? (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-300/70 dark:border-amber-800/60 bg-amber-50/70 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 text-xs font-bold">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      {subjectStats.missing}{' '}
                      {subjectStats.missing === 1
                        ? 'aluno sem nota nesta disciplina'
                        : 'alunos sem nota nesta disciplina'}
                    </span>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-300/70 dark:border-emerald-800/60 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 text-xs font-bold">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    <span>Todos os alunos têm nota lançada</span>
                  </div>
                )}
              </div>
            </div>

            {/* Pesquisa + Aviso de alterações não guardadas / erros */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="relative flex-1 sm:max-w-sm">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-muted-foreground/60 pointer-events-none" />
                <Input
                  type="text"
                  role="searchbox"
                  autoComplete="off"
                  placeholder="Procurar aluno por nome ou nº..."
                  className="pl-10.5 pr-10.5 h-11 bg-background border-border/70 hover:border-purple-400 focus:border-purple-500 text-sm rounded-xl w-full shadow-2xs"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setSearchQuery('');
                  }}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 h-7.5 w-7.5 text-muted-foreground/60 hover:text-foreground cursor-pointer rounded-lg hover:bg-muted/80 flex items-center justify-center"
                    title="Limpar pesquisa"
                    aria-label="Limpar pesquisa"
                  >
                    <X className="h-4 w-4 shrink-0" strokeWidth={2.2} />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3 text-xs text-muted-foreground font-semibold">
                <span className="inline-flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  <span>
                    {subjectStats.filled}/{subjectStats.total} preenchidas
                  </span>
                </span>
                {hasUnsavedDrafts && (
                  <span className="px-2.5 py-1 rounded-lg bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-bold border border-purple-200 dark:border-purple-800/50">
                    {pendingDraftEntries.length}{' '}
                    {pendingDraftEntries.length === 1
                      ? 'alteração por guardar'
                      : 'alterações por guardar'}
                  </span>
                )}
              </div>
            </div>

            {allInvalidEntries.length > 0 && (
              <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-red-500/10 border border-red-300 dark:border-red-900/50 text-red-700 dark:text-red-400 text-xs font-semibold">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>
                  Existem {allInvalidEntries.length}{' '}
                  {allInvalidEntries.length === 1
                    ? 'nota inválida'
                    : 'notas inválidas'}
                  . As notas devem estar estritamente entre 0 e 20 valores.
                </span>
              </div>
            )}
          </div>

          {/* Lista de Alunos com Campo de Nota */}
          {filteredStudents.length === 0 ? (
            <div className="py-16 px-4 text-center text-muted-foreground text-sm">
              <p className="font-semibold text-foreground">
                {searchQuery.trim()
                  ? `Nenhum aluno encontrado para "${searchQuery}".`
                  : 'Nenhum aluno registado nesta turma.'}
              </p>
              {searchQuery.trim() && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSearchQuery('')}
                  className="mt-3 h-8 text-xs px-3 rounded-lg border-purple-300 dark:border-purple-800 text-purple-600 dark:text-purple-400"
                >
                  Limpar pesquisa
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-border/50 max-h-[60vh] overflow-y-auto scrollbar-thin">
              {/* Cabeçalho fixo da lista */}
              <div className="sticky top-0 z-10 grid grid-cols-[52px_1fr_110px] sm:grid-cols-[64px_1fr_84px_132px] items-center gap-2 sm:gap-4 px-4 sm:px-5 py-2.5 bg-muted/95 backdrop-blur-xs border-b border-border/70 text-xs font-bold text-foreground">
                <div className="text-center">Nº</div>
                <div>Nome do Aluno</div>
                <div className="hidden sm:block text-center text-purple-700 dark:text-purple-300">
                  MG Atual
                </div>
                <div className="text-center">Nota ({selectedSubjectMeta.label})</div>
              </div>

              {filteredStudents.map((student, idx) => {
                const orderNum = studentOrderMap.get(student.id) || String(idx + 1);
                const val = getEffectiveValue(student, trimester, selectedSubjectKey);
                const validation = validateGradeValue(val);
                const isBelow10 =
                  validation.valid && validation.numeric !== null && validation.numeric < 10;
                const isPassing =
                  validation.valid && validation.numeric !== null && validation.numeric >= 10;

                const draftKey = makeDraftKey(trimester, selectedSubjectKey, student.id);
                const savedVal =
                  getStudentSubjectGrades(student, trimester)[selectedSubjectKey] || '';
                const isModified =
                  Object.prototype.hasOwnProperty.call(drafts, draftKey) &&
                  drafts[draftKey].trim() !== savedVal.trim();

                const mg = calculateMediaGeralForStudent(student, trimester);

                return (
                  <div
                    key={student.id}
                    className={`grid grid-cols-[52px_1fr_110px] sm:grid-cols-[64px_1fr_84px_132px] items-center gap-2 sm:gap-4 px-4 sm:px-5 py-2.5 transition-colors ${
                      !validation.valid
                        ? 'bg-red-50/60 dark:bg-red-950/20'
                        : isModified
                        ? 'bg-purple-50/50 dark:bg-purple-950/20'
                        : 'odd:bg-muted/10 even:bg-transparent hover:bg-muted/30'
                    }`}
                  >
                    <div className="text-center font-semibold text-xs sm:text-sm text-muted-foreground">
                      {orderNum}
                    </div>

                    <div className="min-w-0">
                      <div className="font-semibold text-xs sm:text-sm text-foreground truncate flex items-center gap-1.5">
                        <span className="truncate">{student.name}</span>
                        {isModified && (
                          <span
                            className="inline-block h-1.5 w-1.5 rounded-full bg-purple-600 shrink-0"
                            title="Alteração por guardar"
                          />
                        )}
                      </div>
                      {!validation.valid && (
                        <p className="text-[11px] font-semibold text-red-600 dark:text-red-400 mt-0.5">
                          {validation.error}
                        </p>
                      )}
                      {validation.valid && isBelow10 && (
                        <p className="text-[10px] font-semibold text-red-600 dark:text-red-400 mt-0.5 sm:hidden">
                          Nota negativa (&lt; 10)
                        </p>
                      )}
                    </div>

                    <div className="hidden sm:flex justify-center">
                      <span
                        className={`px-2 py-0.5 rounded-lg text-xs font-extrabold ${
                          mg.rounded === '-'
                            ? 'text-muted-foreground bg-muted/60'
                            : parseFloat(mg.rounded) >= 10
                            ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/10'
                            : 'text-red-600 dark:text-red-400 bg-red-500/10'
                        }`}
                        title="Média Geral atual na Pauta da Turma"
                      >
                        {mg.rounded}
                      </span>
                    </div>

                    <div className="flex flex-col items-center">
                      <input
                        ref={(el) => {
                          inputRefs.current[student.id] = el;
                        }}
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        value={val}
                        onChange={(e) => handleGradeChange(student, e.target.value)}
                        onKeyDown={(e) => handleInputKeyDown(e, idx)}
                        onFocus={(e) => e.target.select()}
                        placeholder="-"
                        aria-label={`Nota de ${student.name} em ${selectedSubjectMeta.name}`}
                        className={`h-10 w-24 sm:w-28 text-center px-2 text-sm font-bold rounded-xl border outline-none transition-colors focus-visible:ring-2 ${
                          !validation.valid
                            ? 'border-red-500 bg-red-50/70 dark:bg-red-950/30 text-red-600 dark:text-red-400 focus-visible:ring-red-500/30'
                            : isBelow10
                            ? 'border-red-300 dark:border-red-800/70 bg-red-50/30 dark:bg-red-950/15 text-red-600 dark:text-red-400 focus:border-purple-500 focus-visible:ring-purple-500/25'
                            : isPassing
                            ? 'border-border/60 bg-background text-blue-600 dark:text-blue-400 focus:border-purple-500 focus-visible:ring-purple-500/25'
                            : 'border-border/60 bg-background/70 text-foreground focus:border-purple-500 focus-visible:ring-purple-500/25'
                        }`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Rodapé com botão Guardar acessível no final da lista */}
          {filteredStudents.length > 0 && (
            <div className="p-4 border-t border-border/60 bg-muted/20 flex justify-end">
              <Button
                type="button"
                onClick={executeSave}
                disabled={isSaving}
                className="w-full sm:w-auto h-11 px-6 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold shadow-sm flex items-center justify-center gap-2 cursor-pointer border-0 shrink-0"
              >
                <Save className="h-4 w-4 shrink-0" />
                <span>{isSaving ? 'A guardar...' : 'Guardar'}</span>
                {hasUnsavedDrafts && (
                  <span className="ml-0.5 px-1.5 py-0.5 rounded-md bg-white/20 text-[11px] font-extrabold leading-none">
                    {pendingDraftEntries.length}
                  </span>
                )}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Diálogo ao tentar voltar com alterações não guardadas */}
      <Dialog open={showLeavePrompt} onOpenChange={setShowLeavePrompt}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Alterações por guardar</DialogTitle>
            <DialogDescription>
              Tem {pendingDraftEntries.length}{' '}
              {pendingDraftEntries.length === 1
                ? 'nota alterada que ainda não foi guardada'
                : 'notas alteradas que ainda não foram guardadas'}
              . O que pretende fazer antes de voltar à Pauta da Turma?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowLeavePrompt(false);
                setDrafts({});
                onBack();
              }}
              className="rounded-xl cursor-pointer"
            >
              Sair sem guardar
            </Button>
            <Button
              type="button"
              onClick={async () => {
                const ok = await executeSave();
                if (ok) {
                  setShowLeavePrompt(false);
                  onBack();
                } else {
                  setShowLeavePrompt(false);
                }
              }}
              className="rounded-xl bg-purple-600 hover:bg-purple-700 text-white border-0 cursor-pointer"
            >
              Guardar e voltar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
