import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Pencil, FileText, Trash2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TableCell, TableRow } from '@/components/ui/table';
import {
  type Grades,
  type Student,
  MEDIA_GERAL_SUBJECTS,
  getStudentGrades,
  getStudentSubjectGrades,
  calculateAcsAverage,
  calculateAutoGeneralAverage,
  calculateGeneralAverage,
  calculateTrimesterAverage,
  calculateMediaGeralForStudent,
  getApoioAlertStatus,
  getGradeColor,
} from '@/lib/grade-utils';

export interface GradeInputProps {
  value: string;
  onCommit: (value: string) => void;
  resetKey?: string;
  sanitize?: (raw: string) => string;
  getDynamicClassName?: (val: string) => string;
  className?: string;
  placeholder?: string;
  onFocus?: () => void;
  onClick?: () => void;
  selectOnDashFocus?: boolean;
  restoreDashOnBlur?: boolean;
  title?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
}

/**
 * Célula de entrada de nota ultra-rápida:
 * - Mantém estado local imediato (digitou -> aparece instantaneamente na tela sem esperar re-render da tabela inteira nem gravação no Firestore)
 * - Sincroniza com o estado pai após micro-debounce (60ms) e imediatamente ao sair da célula (onBlur)
 * - Protege a digitação ativa contra sobrescritas de snapshots remotos enquanto o campo está focado
 */
export const GradeInput = React.memo(function GradeInput({
  value,
  onCommit,
  resetKey,
  sanitize,
  getDynamicClassName,
  className = '',
  placeholder = '-',
  onFocus,
  onClick,
  selectOnDashFocus = false,
  restoreDashOnBlur = false,
  title,
  inputMode = 'decimal',
}: GradeInputProps) {
  const [localValue, setLocalValue] = useState(value);
  const isFocusedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingValueRef = useRef<string | null>(null);
  const onCommitRef = useRef(onCommit);
  const pendingCommitRef = useRef(onCommit);
  const prevResetKeyRef = useRef(resetKey);
  const valueRef = useRef(value);

  onCommitRef.current = onCommit;
  valueRef.current = value;

  useEffect(() => {
    const keyChanged = prevResetKeyRef.current !== resetKey;
    if (keyChanged) {
      prevResetKeyRef.current = resetKey;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (pendingValueRef.current !== null) {
        const valToFlush = pendingValueRef.current;
        const commitFn = pendingCommitRef.current;
        pendingValueRef.current = null;
        commitFn(valToFlush);
      }
      setLocalValue(value);
      return;
    }

    if (!isFocusedRef.current) {
      setLocalValue(value);
    }
  }, [value, resetKey]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (pendingValueRef.current !== null) {
        const valToFlush = pendingValueRef.current;
        const commitFn = pendingCommitRef.current;
        pendingValueRef.current = null;
        commitFn(valToFlush);
      }
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const nextVal = sanitize ? sanitize(raw) : raw;

    // Atualização síncrona e instantânea no input DOM
    setLocalValue(nextVal);
    pendingValueRef.current = nextVal;
    pendingCommitRef.current = onCommitRef.current;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      const valToFlush = pendingValueRef.current;
      const commitFn = pendingCommitRef.current;
      pendingValueRef.current = null;
      if (valToFlush !== null) {
        commitFn(valToFlush);
      }
    }, 60);
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    isFocusedRef.current = true;
    if (selectOnDashFocus && localValue === '-') {
      e.target.select();
    }
    onFocus?.();
  };

  const handleBlur = () => {
    isFocusedRef.current = false;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    let finalVal = pendingValueRef.current !== null ? pendingValueRef.current : localValue;
    const commitFn = pendingValueRef.current !== null ? pendingCommitRef.current : onCommitRef.current;
    pendingValueRef.current = null;

    if (restoreDashOnBlur && finalVal.trim() === '') {
      finalVal = '-';
      setLocalValue('-');
    }

    if (finalVal !== value) {
      commitFn(finalVal);
    }

    if (!restoreDashOnBlur && finalVal.trim() === '') {
      setTimeout(() => {
        if (!isFocusedRef.current) {
          setLocalValue(valueRef.current);
        }
      }, 0);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (pendingValueRef.current !== null) {
        const valToFlush = pendingValueRef.current;
        const commitFn = pendingCommitRef.current;
        pendingValueRef.current = null;
        commitFn(valToFlush);
      }
      return;
    }

    if (
      e.altKey ||
      e.ctrlKey ||
      e.metaKey ||
      e.shiftKey ||
      (e.key !== 'ArrowUp' &&
        e.key !== 'ArrowDown' &&
        e.key !== 'ArrowLeft' &&
        e.key !== 'ArrowRight')
    ) {
      return;
    }

    const inputEl = e.currentTarget;
    const selStart = inputEl.selectionStart ?? 0;
    const selEnd = inputEl.selectionEnd ?? 0;
    const len = inputEl.value.length;
    const isAllSelected = len > 0 && selStart === 0 && selEnd === len;

    let shouldNavigate = false;
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      shouldNavigate = true;
    } else if (e.key === 'ArrowLeft') {
      shouldNavigate = len === 0 || isAllSelected || (selStart === 0 && selEnd === 0);
    } else if (e.key === 'ArrowRight') {
      shouldNavigate = len === 0 || isAllSelected || (selStart === len && selEnd === len);
    }

    if (!shouldNavigate) return;

    const currentRow = inputEl.closest('tr');
    const tableBody = currentRow?.closest('tbody');
    if (!currentRow || !tableBody) return;

    const rows: HTMLTableRowElement[] = Array.from(
      tableBody.querySelectorAll('tr')
    );
    const rowIndex = rows.indexOf(currentRow);
    if (rowIndex === -1) return;

    const rowInputs: HTMLInputElement[] = Array.from(
      currentRow.querySelectorAll('input[data-grade-input="true"]:not(:disabled)')
    );
    const colIndex = rowInputs.indexOf(inputEl);
    if (colIndex === -1) return;

    let targetInput: HTMLInputElement | undefined;

    if (e.key === 'ArrowRight') {
      if (colIndex + 1 < rowInputs.length) {
        targetInput = rowInputs[colIndex + 1];
      } else {
        for (let r = rowIndex + 1; r < rows.length; r++) {
          const nextRowInputs = rows[r].querySelectorAll<HTMLInputElement>(
            'input[data-grade-input="true"]:not(:disabled)'
          );
          if (nextRowInputs.length > 0) {
            targetInput = nextRowInputs[0];
            break;
          }
        }
      }
    } else if (e.key === 'ArrowLeft') {
      if (colIndex - 1 >= 0) {
        targetInput = rowInputs[colIndex - 1];
      } else {
        for (let r = rowIndex - 1; r >= 0; r--) {
          const prevRowInputs = rows[r].querySelectorAll<HTMLInputElement>(
            'input[data-grade-input="true"]:not(:disabled)'
          );
          if (prevRowInputs.length > 0) {
            targetInput = prevRowInputs[prevRowInputs.length - 1];
            break;
          }
        }
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      for (let r = rowIndex + 1; r < rows.length; r++) {
        const nextRowInputs = rows[r].querySelectorAll<HTMLInputElement>(
          'input[data-grade-input="true"]:not(:disabled)'
        );
        if (nextRowInputs.length > 0) {
          targetInput = nextRowInputs[Math.min(colIndex, nextRowInputs.length - 1)];
          break;
        }
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      for (let r = rowIndex - 1; r >= 0; r--) {
        const prevRowInputs = rows[r].querySelectorAll<HTMLInputElement>(
          'input[data-grade-input="true"]:not(:disabled)'
        );
        if (prevRowInputs.length > 0) {
          targetInput = prevRowInputs[Math.min(colIndex, prevRowInputs.length - 1)];
          break;
        }
      }
    }

    if (targetInput) {
      e.preventDefault();
      targetInput.focus();
      targetInput.select();
      targetInput.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  };

  const dynamicCls = getDynamicClassName ? getDynamicClassName(localValue) : '';

  return (
    <input
      type="text"
      data-grade-input="true"
      inputMode={inputMode}
      autoComplete="off"
      value={localValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      title={title}
      className={`${className} ${dynamicCls}`}
    />
  );
});

export const renderGradeIndicator = (grade: string | undefined | null) => {
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
        <div className={`h-full ${barColorClass}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[9px] font-mono text-muted-foreground/60 leading-none">
        {val}/20
      </span>
    </div>
  );
};

interface EvaluationStudentRowProps {
  student: Student;
  orderNumber: string;
  trimester: '1' | '2' | '3';
  isHighlighted: boolean;
  highlightedColumn: string | null;
  isDirectorStyle: boolean;
  onToggleHighlight: (studentId: string) => void;
  onUpdateGrade: (studentId: string, field: keyof Grades, value: string, trimester: '1' | '2' | '3') => void;
  onFocusColumn: (col: string) => void;
  onEditStudent: (student: Student) => void;
  onNotesStudent: (student: Student) => void;
  onConfirmDeleteStudent: (studentId: string) => void;
}

const EVAL_INPUT_BASE =
  'h-8 w-16 min-w-0 rounded-lg border border-transparent hover:border-border focus:border-primary bg-transparent hover:bg-background/50 focus:bg-background/80 px-1 py-1 text-center text-base md:text-sm font-semibold outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/40';

export const EvaluationStudentRow = React.memo(function EvaluationStudentRow({
  student,
  orderNumber,
  trimester,
  isHighlighted,
  highlightedColumn,
  isDirectorStyle,
  onToggleHighlight,
  onUpdateGrade,
  onFocusColumn,
  onEditStudent,
  onNotesStudent,
  onConfirmDeleteStudent,
}: EvaluationStudentRowProps) {
  const studentGrades = getStudentGrades(student, trimester);
  const status = getApoioAlertStatus(student, trimester);
  const acsAvg = calculateAcsAverage(studentGrades);
  const autoGeneralAvg = calculateAutoGeneralAverage(studentGrades);
  const manualMediaGeral = (studentGrades.mediaGeral || '').trim();
  const displayGeneralAvg =
    manualMediaGeral !== ''
      ? (studentGrades.mediaGeral || '')
      : autoGeneralAvg === '-'
      ? ''
      : autoGeneralAvg;
  const effectiveGeneralAvgStr = calculateGeneralAverage(studentGrades);
  const trimesterAvg = calculateTrimesterAverage(student);

  const commitAcs1 = useCallback((v: string) => onUpdateGrade(student.id, 'acs1', v, trimester), [student.id, trimester, onUpdateGrade]);
  const commitAcs2 = useCallback((v: string) => onUpdateGrade(student.id, 'acs2', v, trimester), [student.id, trimester, onUpdateGrade]);
  const commitAcs3 = useCallback((v: string) => onUpdateGrade(student.id, 'acs3', v, trimester), [student.id, trimester, onUpdateGrade]);
  const commitAp = useCallback((v: string) => onUpdateGrade(student.id, 'ap', v, trimester), [student.id, trimester, onUpdateGrade]);
  const commitExame = useCallback((v: string) => onUpdateGrade(student.id, 'exame', v, trimester), [student.id, trimester, onUpdateGrade]);
  const commitMediaGeral = useCallback((v: string) => onUpdateGrade(student.id, 'mediaGeral', v, trimester), [student.id, trimester, onUpdateGrade]);

  const focusAcs1 = useCallback(() => onFocusColumn('acs1'), [onFocusColumn]);
  const focusAcs2 = useCallback(() => onFocusColumn('acs2'), [onFocusColumn]);
  const focusAcs3 = useCallback(() => onFocusColumn('acs3'), [onFocusColumn]);
  const focusAp = useCallback(() => onFocusColumn('ap'), [onFocusColumn]);
  const focusExame = useCallback(() => onFocusColumn('exame'), [onFocusColumn]);
  const focusMediaGeral = useCallback(() => onFocusColumn('mediaGeral'), [onFocusColumn]);

  const getColor = useCallback((val: string) => getGradeColor(val), []);
  const getAvgColor = useCallback((val: string) => getGradeColor(val, true), []);
  const sanitizeNumericGrade = useCallback((raw: string) => raw.replace(/[^0-9.,]/g, ''), []);

  let nameBadge = null;
  if (status !== 'none') {
    let badgeColorClass = '';
    let badgeLabel = 'Alerta';
    let titleTooltip = '';
    if (status === 'red') {
      badgeColorClass = 'bg-red-100 dark:bg-red-950/45 text-red-600 dark:text-red-400 border-red-200/50 dark:border-red-900/20';
      badgeLabel = 'Crítico';
      titleTooltip = 'Nota abaixo de 7 valores';
    } else if (status === 'orange') {
      badgeColorClass = 'bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200/50 dark:border-amber-900/20';
      badgeLabel = 'Atenção';
      titleTooltip = 'Nota entre 7 e 11 valores';
    } else if (status === 'green') {
      badgeColorClass = 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-900/20';
      badgeLabel = 'Estável';
      titleTooltip = 'Nota entre 12 e 20 valores';
    }
    nameBadge = (
      <span
        className={`inline-flex items-center gap-0.5 text-[9px] font-extrabold px-1.5 py-0.5 rounded-sm border uppercase tracking-widest leading-none shrink-0 ${badgeColorClass}`}
        title={titleTooltip}
      >
        {badgeLabel}
      </span>
    );
  }

  let avgBadge = null;
  if (status !== 'none') {
    let badgeColorClass = '';
    let badgeLabel = 'Alerta';
    let iconEl = null;
    if (status === 'red') {
      badgeColorClass = 'bg-red-100 dark:bg-red-950/30 border-red-200/60 dark:border-red-900/30 text-red-600 dark:text-red-400';
      badgeLabel = 'Crítico';
      iconEl = <AlertTriangle className="h-2.5 w-2.5 shrink-0 animate-pulse text-red-600 dark:text-red-400" />;
    } else if (status === 'orange') {
      badgeColorClass = 'bg-amber-100 dark:bg-amber-950/20 border-amber-200/60 dark:border-amber-900/30 text-amber-600 dark:text-amber-400';
      badgeLabel = 'Atenção';
      iconEl = <AlertTriangle className="h-2.5 w-2.5 shrink-0 text-amber-500 dark:text-amber-400" />;
    } else if (status === 'green') {
      badgeColorClass = 'bg-emerald-100 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-900/30 text-emerald-600 dark:text-emerald-400';
      badgeLabel = 'Estável';
      iconEl = <CheckCircle2 className="h-2.5 w-2.5 shrink-0 text-emerald-500 dark:text-emerald-400" />;
    }
    avgBadge = (
      <div className={`flex items-center gap-1 mt-1 border px-1.5 py-0.5 rounded-full select-none text-[9px] font-bold max-w-fit mx-auto shadow-3xs ${badgeColorClass}`}>
        {iconEl}
        <span>{badgeLabel}</span>
      </div>
    );
  }

  return (
    <TableRow
      id={isDirectorStyle ? `student-row-${student.id}` : undefined}
      className={`scroll-mt-36 h-16 border-l-2 sm:border-l-4 ${
        isHighlighted
          ? 'bg-purple-500/10 dark:bg-purple-500/20 border-l-purple-500 shadow-sm font-medium'
          : 'hover:bg-muted/40 odd:bg-muted/15 even:bg-transparent border-l-transparent'
      }`}
    >
      <TableCell className="font-medium text-muted-foreground align-middle">{orderNumber}</TableCell>
      <TableCell
        className={`font-semibold align-middle cursor-pointer select-none ${
          isHighlighted
            ? 'text-purple-600 dark:text-purple-400 font-extrabold'
            : 'text-foreground hover:text-purple-600 dark:hover:text-purple-400'
        }`}
        onClick={() => onToggleHighlight(student.id)}
        title="Clique para destacar este aluno"
      >
        <div className="flex items-center gap-1.5 flex-wrap">
          <span>{student.name}</span>
          {nameBadge}
          {isHighlighted && (
            <span className="inline-flex h-2 w-2 rounded-full bg-purple-500 animate-pulse shrink-0" />
          )}
        </div>
      </TableCell>

      <TableCell className={`align-middle ${highlightedColumn === 'acs1' ? 'bg-purple-500/5 dark:bg-purple-500/10 border-x border-purple-500/10' : ''}`}>
        <div className="flex flex-col items-center justify-center">
          <GradeInput
            className={EVAL_INPUT_BASE}
            getDynamicClassName={getColor}
            value={studentGrades.acs1 || ''}
            resetKey={`${student.id}-${trimester}-acs1`}
            onCommit={commitAcs1}
            onFocus={focusAcs1}
            onClick={focusAcs1}
            placeholder="-"
          />
          {renderGradeIndicator(studentGrades.acs1)}
        </div>
      </TableCell>

      <TableCell className={`align-middle ${highlightedColumn === 'acs2' ? 'bg-purple-500/5 dark:bg-purple-500/10 border-x border-purple-500/10' : ''}`}>
        <div className="flex flex-col items-center justify-center">
          <GradeInput
            className={EVAL_INPUT_BASE}
            getDynamicClassName={getColor}
            value={studentGrades.acs2 || ''}
            resetKey={`${student.id}-${trimester}-acs2`}
            onCommit={commitAcs2}
            onFocus={focusAcs2}
            onClick={focusAcs2}
            placeholder="-"
          />
          {renderGradeIndicator(studentGrades.acs2)}
        </div>
      </TableCell>

      <TableCell className={`align-middle ${highlightedColumn === 'acs3' ? 'bg-purple-500/5 dark:bg-purple-500/10 border-x border-purple-500/10' : ''}`}>
        <div className="flex flex-col items-center justify-center">
          <GradeInput
            className={EVAL_INPUT_BASE}
            getDynamicClassName={getColor}
            value={studentGrades.acs3 || ''}
            resetKey={`${student.id}-${trimester}-acs3`}
            onCommit={commitAcs3}
            onFocus={focusAcs3}
            onClick={focusAcs3}
            placeholder="-"
          />
          {renderGradeIndicator(studentGrades.acs3)}
        </div>
      </TableCell>

      <TableCell className="align-middle text-center bg-purple-500/5 dark:bg-purple-500/5">
        <div className="flex flex-col items-center justify-center">
          <span className={`font-bold text-sm ${getGradeColor(acsAvg, true) || 'text-foreground'}`}>
            {acsAvg}
          </span>
          {renderGradeIndicator(acsAvg)}
        </div>
      </TableCell>

      <TableCell className={`align-middle ${highlightedColumn === 'ap' ? 'bg-purple-500/5 dark:bg-purple-500/10 border-x border-purple-500/10' : ''}`}>
        <div className="flex flex-col items-center justify-center">
          <GradeInput
            className={EVAL_INPUT_BASE}
            getDynamicClassName={getColor}
            value={studentGrades.ap || ''}
            resetKey={`${student.id}-${trimester}-ap`}
            onCommit={commitAp}
            onFocus={focusAp}
            onClick={focusAp}
            placeholder="-"
          />
          {renderGradeIndicator(studentGrades.ap)}
        </div>
      </TableCell>

      <TableCell className={`align-middle ${highlightedColumn === 'exame' ? 'bg-purple-500/5 dark:bg-purple-500/10 border-x border-purple-500/10' : ''}`}>
        <div className="flex flex-col items-center justify-center">
          <GradeInput
            className={EVAL_INPUT_BASE}
            getDynamicClassName={getColor}
            value={studentGrades.exame || ''}
            resetKey={`${student.id}-${trimester}-exame`}
            onCommit={commitExame}
            onFocus={focusExame}
            onClick={focusExame}
            placeholder="-"
          />
          {renderGradeIndicator(studentGrades.exame)}
        </div>
      </TableCell>

      <TableCell
        className={`align-middle text-center ${
          highlightedColumn === 'mediaGeral'
            ? 'bg-purple-500/5 dark:bg-purple-500/10 border-x border-purple-500/10'
            : 'bg-amber-500/5 dark:bg-amber-500/5'
        }`}
      >
        <div className="flex flex-col items-center justify-center">
          <GradeInput
            className={`${EVAL_INPUT_BASE} font-bold`}
            getDynamicClassName={getAvgColor}
            sanitize={sanitizeNumericGrade}
            value={displayGeneralAvg}
            resetKey={`${student.id}-${trimester}-mediaGeral`}
            onCommit={commitMediaGeral}
            onFocus={focusMediaGeral}
            onClick={focusMediaGeral}
            placeholder="-"
            title={
              manualMediaGeral !== ''
                ? 'Média Geral inserida manualmente (limpe para voltar ao cálculo automático)'
                : 'Média Geral (clique para introduzir manualmente)'
            }
          />
          {renderGradeIndicator(effectiveGeneralAvgStr)}
          {avgBadge}
        </div>
      </TableCell>

      <TableCell className="align-middle text-center bg-purple-500/5 dark:bg-purple-500/5">
        <div className="flex flex-col items-center justify-center">
          <span className={`font-bold text-sm ${getGradeColor(trimesterAvg, true) || 'text-foreground'}`}>
            {trimesterAvg}
          </span>
          {renderGradeIndicator(trimesterAvg)}
        </div>
      </TableCell>

      <TableCell className="align-middle text-center w-[140px]">
        <div className="flex items-center justify-center gap-6">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg cursor-pointer transition-colors"
            onClick={() => onEditStudent(student)}
            title="Editar Aluno"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-purple-600 hover:text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-950/20 rounded-lg cursor-pointer transition-colors"
            onClick={() => onNotesStudent(student)}
            title="Notas do Aluno"
          >
            <div className="relative">
              <FileText className="h-4 w-4" />
              {student.notes && student.notes.length > 0 && (
                <span className="absolute -top-1.5 -right-2 bg-red-600 text-white text-[9px] font-extrabold px-1 rounded-full h-3.5 min-w-[14px] flex items-center justify-center border border-white dark:border-zinc-900 leading-none">
                  {student.notes.length}
                </span>
              )}
            </div>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg cursor-pointer transition-colors"
            onClick={() => onConfirmDeleteStudent(student.id)}
            title="Remover Aluno"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
});

interface MediaGeralRowProps {
  student: Student;
  orderNumber: string;
  trimester: '1' | '2' | '3';
  isHighlighted: boolean;
  onToggleHighlight: (studentId: string) => void;
  onUpdateSubjectGrade: (studentId: string, subjectKey: string, value: string, trimester: '1' | '2' | '3') => void;
}

const sanitizeSubjectInput = (raw: string) => raw.replace(/[^0-9.,]/g, '');

const getSubjectInputColor = (val: string) => {
  if (!val) return 'text-muted-foreground';
  const numVal = parseFloat(val.replace(',', '.'));
  if (!isNaN(numVal)) {
    if (numVal >= 10) return 'text-blue-600 dark:text-blue-400 font-extrabold';
    return 'text-red-600 dark:text-red-400 font-extrabold';
  }
  return 'text-foreground';
};

export const MediaGeralRow = React.memo(function MediaGeralRow({
  student,
  orderNumber,
  trimester,
  isHighlighted,
  onToggleHighlight,
  onUpdateSubjectGrade,
}: MediaGeralRowProps) {
  const subGrades = getStudentSubjectGrades(student, trimester);
  const mg = calculateMediaGeralForStudent(student, trimester);
  const mgNum = mg.rounded !== '-' ? parseFloat(mg.rounded) : null;
  const isPositive = mgNum !== null && mgNum >= 10;

  return (
    <TableRow
      className={`h-12 border-b ${
        isHighlighted
          ? 'bg-purple-500/20 dark:bg-purple-500/30 border-l-4 border-l-purple-600 dark:border-l-purple-400 font-medium'
          : 'hover:bg-muted/30 odd:bg-muted/10 even:bg-transparent border-l-4 border-l-transparent border-border/40'
      }`}
    >
      <TableCell
        onClick={() => onToggleHighlight(student.id)}
        className={`text-center font-semibold text-xs cursor-pointer select-none ${
          isHighlighted
            ? 'text-purple-700 dark:text-purple-300 font-extrabold bg-purple-500/10'
            : 'text-muted-foreground hover:text-purple-600'
        }`}
        title="Clique para destacar este aluno"
      >
        <div className="flex items-center justify-center gap-1">
          {isHighlighted && (
            <span className="inline-flex h-2 w-2 rounded-full bg-purple-600 dark:bg-purple-400 animate-pulse shrink-0" />
          )}
          <span>{orderNumber}</span>
        </div>
      </TableCell>

      <TableCell
        onClick={() => onToggleHighlight(student.id)}
        className={`font-semibold text-xs cursor-pointer select-none border-r border-border/40 truncate max-w-[170px] sm:max-w-[200px] md:sticky md:left-0 z-0 md:z-10 ${
          isHighlighted
            ? 'text-purple-900 dark:text-purple-200 font-extrabold bg-purple-100 dark:bg-purple-950'
            : 'text-foreground bg-card hover:text-purple-600 dark:hover:text-purple-400'
        }`}
        title="Clique para destacar este aluno"
      >
        <div className="flex items-center gap-1.5 truncate">
          <span className="truncate">{student.name}</span>
          {isHighlighted && (
            <span className="inline-flex h-2 w-2 rounded-full bg-purple-600 dark:bg-purple-400 animate-pulse shrink-0" />
          )}
        </div>
      </TableCell>

      {MEDIA_GERAL_SUBJECTS.map((sub) => {
        const val = subGrades[sub.key] || '';
        return (
          <TableCell key={sub.key} className="p-1 text-center align-middle">
            <GradeInput
              value={val}
              resetKey={`${student.id}-${trimester}-${sub.key}`}
              sanitize={sanitizeSubjectInput}
              getDynamicClassName={getSubjectInputColor}
              onCommit={(nextVal) => onUpdateSubjectGrade(student.id, sub.key, nextVal, trimester)}
              placeholder="-"
              className={`h-8 w-14 mx-auto text-center px-1 text-xs font-bold rounded-md border outline-none focus-visible:ring-2 focus-visible:ring-purple-500/30 ${
                isHighlighted
                  ? 'border-purple-300 dark:border-purple-700 bg-purple-50/60 dark:bg-purple-950/40'
                  : 'border-border/50 bg-background/50 hover:bg-background'
              } focus:border-purple-500`}
            />
          </TableCell>
        );
      })}

      <TableCell
        className={`text-center font-bold text-xs border-l border-border/40 ${
          isHighlighted
            ? 'text-purple-900 dark:text-purple-200 bg-purple-500/20 font-extrabold'
            : 'text-purple-700 dark:text-purple-300 bg-purple-500/5'
        }`}
      >
        {mg.hasAnyGrade ? mg.sum : '-'}
      </TableCell>

      <TableCell
        className={`text-center font-extrabold text-sm md:sticky md:right-0 z-0 md:z-10 border-l-2 border-r-2 border-purple-400 dark:border-purple-500 shadow-md ${
          isHighlighted
            ? 'bg-purple-200 dark:bg-purple-900'
            : 'bg-purple-100 dark:bg-purple-950'
        }`}
      >
        <div className="flex flex-col items-center justify-center py-1">
          <span
            className={`px-3 sm:px-3.5 py-1 rounded-xl text-xs sm:text-sm font-black tracking-tight shadow-sm border-2 ${
              mg.rounded === '-'
                ? 'text-muted-foreground bg-muted/90 border-border/80'
                : isPositive
                  ? 'bg-emerald-600 text-white border-emerald-500 ring-2 ring-emerald-500/25 shadow-emerald-500/20'
                  : 'bg-red-600 text-white border-red-500 ring-2 ring-red-500/25 shadow-red-500/20'
            }`}
            title={mg.raw !== null ? `Média exacta: ${mg.raw.toFixed(2)} (arredondada: ${mg.rounded})` : 'Sem notas'}
          >
            {mg.rounded}
          </span>
          {mg.raw !== null && (
            <span className="text-[10px] font-mono font-bold text-purple-950 dark:text-purple-100 mt-1 bg-purple-200/60 dark:bg-purple-900/60 px-1.5 py-0.5 rounded">
              {mg.raw.toFixed(2).replace('.', ',')}
            </span>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
});
