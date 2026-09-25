import React, { useState, useEffect, useMemo } from 'react';
import {
  ChevronLeft,
  BarChart3,
  Download,
  Printer,
  RefreshCw,
  Save,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import type { ClassData, Student } from '@/src/App';
import {
  calculateMediaGeralForStudent,
  isStudentFemale,
  getStudentSubjectGrades,
} from '@/src/App';

export const APROVEITAMENTO_DISCIPLINAS = [
  { id: 'portugues', name: 'Português', key: 'P', aliases: ['portugues', 'lp', 'lingua_portuguesa'] },
  { id: 'ingles', name: 'Inglês', key: 'I', aliases: ['ingles', 'ing', 'lingua_inglesa'] },
  { id: 'historia', name: 'História', key: 'H', aliases: ['historia', 'hist'] },
  { id: 'geografia', name: 'Geografia', key: 'G', aliases: ['geografia', 'geo'] },
  { id: 'filosofia', name: 'Filosofia', key: 'FIL', aliases: ['filosofia', 'fil'] },
  { id: 'matematica', name: 'Matemática', key: 'M', aliases: ['matematica', 'mat'] },
  { id: 'fisica', name: 'Física', key: 'F', aliases: ['fisica', 'fis'] },
  { id: 'quimica', name: 'Química', key: 'Q', aliases: ['quimica', 'qui'] },
  { id: 'biologia', name: 'Biologia', key: 'B', aliases: ['biologia', 'bio'] },
  { id: 'ed_visual', name: 'Ed. Visual', key: 'EdV', aliases: ['ed_visual', 'ev', 'desenho'] },
  { id: 'frances', name: 'Francês', key: 'FR', aliases: ['frances', 'fr'] },
  { id: 'ne', name: 'NE', key: 'NE', aliases: ['ne', 'edmc', 'ed_moral', 'empreendedorismo'] },
  { id: 'ap', name: 'AP', key: 'AP', aliases: ['ap', 'agropecuaria', 'agro_pecuaria'] },
  { id: 'dgd', name: 'DGD', key: 'DGD', aliases: ['dgd', 'tics', 'tic', 'desenho_geometria'] },
  { id: 'ed_fisica', name: 'Ed. Física', key: 'EdF', aliases: ['ed_fisica', 'ef', 'educacao_fisica'] },
] as const;

export type Table1RowData = {
  id: string;
  disciplina: string;
  professor: string;
  aa: string;
  ns: string;
  s: string;
  bom: string;
  mb: string;
  e: string;
  positivasNum: string;
  positivasPct: string;
  negativasNum: string;
  negativasPct: string;
  meninasPosNum: string;
  meninasPosPct: string;
  meninasNegNum: string;
  meninasNegPct: string;
};

export type Table2Data = {
  mapa33: { h: string; m: string; hm: string };
  existentesFim1: { h: string; m: string; hm: string };
  entraram2: { h: string; m: string; hm: string };
  total: { h: string; m: string; hm: string };
  transferidos: { h: string; m: string; hm: string };
  existentesFim2: { h: string; m: string; hm: string };
  positivasNum: { h: string; m: string; hm: string };
  positivasPct: { h: string; m: string; hm: string };
  negativasNum: { h: string; m: string; hm: string };
  negativasPct: { h: string; m: string; hm: string };
};

// Helper: parse string to float (default 0)
const parseVal = (val: string | number | undefined | null): number => {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const cleaned = String(val).trim().replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
};

// Helper: format percent with 1 decimal and comma
const formatPct = (num: number, total: number): string => {
  if (total <= 0) return '0,0';
  const pct = (num / total) * 100;
  return pct.toFixed(1).replace('.', ',');
};

// Strict Table 1 Rules Engine
export const applyStrictRulesTable1Row = (row: Table1RowData): Table1RowData => {
  const ns = parseVal(row.ns);
  const s = parseVal(row.s);
  const bom = parseVal(row.bom);
  const mb = parseVal(row.mb);
  const e = parseVal(row.e);

  // Rule 1.1: A.A. = NS + S + Bom + MB + E
  const hasQuant = ns > 0 || s > 0 || bom > 0 || mb > 0 || e > 0;
  const aa = hasQuant ? ns + s + bom + mb + e : parseVal(row.aa);

  // Rule 1.2: Positivas = S + Bom + MB + E
  const posNum = s + bom + mb + e;
  // Rule 1.3: Negativas = NS
  const negNum = ns;

  // Rule 1.4: Percentagens sobre A.A.
  const posPct = aa > 0 ? formatPct(posNum, aa) : (row.positivasPct || '0,0');
  const negPct = aa > 0 ? formatPct(negNum, aa) : (row.negativasPct || '0,0');

  // Rule 1.5: Meninas
  const mPos = parseVal(row.meninasPosNum);
  const mNeg = parseVal(row.meninasNegNum);
  const mAA = mPos + mNeg;
  const mPosPct = mAA > 0 ? formatPct(mPos, mAA) : (aa > 0 && mPos > 0 ? formatPct(mPos, aa) : '0,0');
  const mNegPct = mAA > 0 ? formatPct(mNeg, mAA) : (aa > 0 && mNeg > 0 ? formatPct(mNeg, aa) : '0,0');

  return {
    ...row,
    aa: aa > 0 ? String(aa) : (hasQuant ? '0' : row.aa),
    positivasNum: posNum > 0 ? String(posNum) : (hasQuant ? '0' : row.positivasNum),
    positivasPct: aa > 0 ? posPct : '',
    negativasNum: negNum > 0 ? String(negNum) : (hasQuant ? '0' : row.negativasNum),
    negativasPct: aa > 0 ? negPct : '',
    meninasPosNum: mPos > 0 ? String(mPos) : (row.meninasPosNum ? '0' : ''),
    meninasPosPct: mAA > 0 ? mPosPct : (row.meninasPosPct || ''),
    meninasNegNum: mNeg > 0 ? String(mNeg) : (row.meninasNegNum ? '0' : ''),
    meninasNegPct: mAA > 0 ? mNegPct : (row.meninasNegPct || ''),
  };
};

// Strict Table 2 Rules Engine
export const applyStrictRulesTable2 = (t2: Table2Data): Table2Data => {
  const result: Table2Data = JSON.parse(JSON.stringify(t2));

  // Rule 2.1: HM = H + M for all groups
  const hMapa = parseVal(result.mapa33.h);
  const mMapa = parseVal(result.mapa33.m);
  result.mapa33.hm = String(hMapa + mMapa);

  const hExist1 = parseVal(result.existentesFim1.h);
  const mExist1 = parseVal(result.existentesFim1.m);
  result.existentesFim1.hm = String(hExist1 + mExist1);

  const hEntr = parseVal(result.entraram2.h);
  const mEntr = parseVal(result.entraram2.m);
  result.entraram2.hm = String(hEntr + mEntr);

  // Rule 2.2: Total = Existentes no Início + Que entraram
  const hTotal = hExist1 + hEntr;
  const mTotal = mExist1 + mEntr;
  result.total.h = String(hTotal);
  result.total.m = String(mTotal);
  result.total.hm = String(hTotal + mTotal);

  // Rule 2.3: Transferidos
  const hTransf = parseVal(result.transferidos.h);
  const mTransf = parseVal(result.transferidos.m);
  result.transferidos.hm = String(hTransf + mTransf);

  // Rule 2.4: Existentes no Fim = Total - Transferidos
  const hExist2 = Math.max(0, hTotal - hTransf);
  const mExist2 = Math.max(0, mTotal - mTransf);
  result.existentesFim2.h = String(hExist2);
  result.existentesFim2.m = String(mExist2);
  result.existentesFim2.hm = String(hExist2 + mExist2);

  // Rule 2.5: Positivas e Negativas (Número)
  const hPos = parseVal(result.positivasNum.h);
  const mPos = parseVal(result.positivasNum.m);
  result.positivasNum.hm = String(hPos + mPos);

  // Rule 2.6: Negativas = Existentes no Fim - Positivas
  const hNeg = Math.max(0, hExist2 - hPos);
  const mNeg = Math.max(0, mExist2 - mPos);
  result.negativasNum.h = String(hNeg);
  result.negativasNum.m = String(mNeg);
  result.negativasNum.hm = String(hNeg + mNeg);

  // Rule 2.7: Percentagens sobre Existentes no Fim (devem fechar em 100%)
  result.positivasPct.h = hExist2 > 0 ? formatPct(hPos, hExist2) : '0,0';
  result.positivasPct.m = mExist2 > 0 ? formatPct(mPos, mExist2) : '0,0';
  result.positivasPct.hm = (hExist2 + mExist2) > 0 ? formatPct(hPos + mPos, hExist2 + mExist2) : '0,0';

  result.negativasPct.h = hExist2 > 0 ? formatPct(hNeg, hExist2) : '0,0';
  result.negativasPct.m = mExist2 > 0 ? formatPct(mNeg, mExist2) : '0,0';
  result.negativasPct.hm = (hExist2 + mExist2) > 0 ? formatPct(hNeg + mNeg, hExist2 + mExist2) : '0,0';

  return result;
};

interface AproveitamentoPedagogicoViewProps {
  selectedClass: ClassData;
  onBack: () => void;
  onUpdateClass?: (updatedClass: ClassData) => Promise<void>;
  user: any;
  initialTrimester?: '1' | '2' | '3';
}

export const AproveitamentoPedagogicoView: React.FC<AproveitamentoPedagogicoViewProps> = ({
  selectedClass,
  onBack,
  onUpdateClass,
  user,
  initialTrimester = '1',
}) => {
  const [trimester, setTrimester] = useState<'1' | '2' | '3'>(initialTrimester);
  const [table1Data, setTable1Data] = useState<Table1RowData[]>([]);
  const [table2Data, setTable2Data] = useState<Table2Data>({
    mapa33: { h: '', m: '', hm: '' },
    existentesFim1: { h: '', m: '', hm: '' },
    entraram2: { h: '', m: '', hm: '' },
    total: { h: '', m: '', hm: '' },
    transferidos: { h: '', m: '', hm: '' },
    existentesFim2: { h: '', m: '', hm: '' },
    positivasNum: { h: '', m: '', hm: '' },
    positivasPct: { h: '', m: '', hm: '' },
    negativasNum: { h: '', m: '', hm: '' },
    negativasPct: { h: '', m: '', hm: '' },
  });
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const strictMode = true;

  // Auto compute data from students in the class
  const computeFromClass = useMemo(() => {
    return (t: '1' | '2' | '3') => {
      // 1. Compute Table 1
      const computedT1: Table1RowData[] = APROVEITAMENTO_DISCIPLINAS.map((disc) => {
        let aa = 0;
        let ns = 0;
        let s = 0;
        let bom = 0;
        let mb = 0;
        let e = 0;
        let meninasPos = 0;
        let meninasNeg = 0;
        let meninasAA = 0;

        selectedClass.students.forEach((student) => {
          // Look for grade using getStudentSubjectGrades
          const subGrades = getStudentSubjectGrades(student, t);
          let valStr = subGrades[disc.key] || subGrades[disc.id] || '';

          if (!valStr && disc.aliases) {
            for (const alias of disc.aliases) {
              if (subGrades[alias]) {
                valStr = subGrades[alias];
                break;
              }
            }
          }

          // Fallback: check if class teaches this subject
          if (!valStr && selectedClass.subject.trim().toLowerCase() === disc.name.trim().toLowerCase()) {
            const gradesObj = student.trimesterGrades?.[t] || (t === '1' ? student.grades : undefined);
            if (gradesObj) {
              valStr = gradesObj.ap || gradesObj.acs3 || gradesObj.acs2 || gradesObj.acs1 || '';
            }
          }

          if (valStr && valStr.trim() !== '' && valStr.trim() !== '-') {
            const numVal = parseFloat(valStr.replace(',', '.'));
            if (!isNaN(numVal)) {
              aa++;
              const isFemale = isStudentFemale(student);
              if (isFemale) meninasAA++;

              if (numVal < 10) {
                ns++;
                if (isFemale) meninasNeg++;
              } else {
                if (isFemale) meninasPos++;
                if (numVal <= 13) s++;
                else if (numVal <= 16) bom++;
                else if (numVal <= 18) mb++;
                else e++;
              }
            }
          }
        });

        const posNum = s + bom + mb + e;
        const negNum = ns;
        const posPct = aa > 0 ? formatPct(posNum, aa) : '';
        const negPct = aa > 0 ? formatPct(negNum, aa) : '';
        const mPosPct = meninasAA > 0 ? formatPct(meninasPos, meninasAA) : '';
        const mNegPct = meninasAA > 0 ? formatPct(meninasNeg, meninasAA) : '';

        // Default teacher name if class subject matches
        const isCurrentSubject = selectedClass.subject.trim().toLowerCase() === disc.name.trim().toLowerCase();
        const defaultTeacher = isCurrentSubject ? (user?.displayName || selectedClass.teacherName || '') : '';

        return {
          id: disc.id,
          disciplina: disc.name,
          professor: defaultTeacher,
          aa: aa > 0 ? String(aa) : '',
          ns: ns > 0 ? String(ns) : '',
          s: s > 0 ? String(s) : '',
          bom: bom > 0 ? String(bom) : '',
          mb: mb > 0 ? String(mb) : '',
          e: e > 0 ? String(e) : '',
          positivasNum: posNum > 0 ? String(posNum) : '',
          positivasPct: posPct,
          negativasNum: negNum > 0 ? String(negNum) : '',
          negativasPct: negPct,
          meninasPosNum: meninasPos > 0 ? String(meninasPos) : '',
          meninasPosPct: mPosPct,
          meninasNegNum: meninasNeg > 0 ? String(meninasNeg) : '',
          meninasNegPct: mNegPct,
        };
      });

      // 2. Compute Table 2 (Situação Geral da Turma - Modelo Rigoroso)
      let totalH = 0;
      let totalM = 0;
      selectedClass.students.forEach((student) => {
        if (isStudentFemale(student)) totalM++;
        else totalH++;
      });
      const totalHM = totalH + totalM;

      let posH = 0;
      let posM = 0;

      selectedClass.students.forEach((student) => {
        const mg = calculateMediaGeralForStudent(student, t);
        if (mg.hasAnyGrade && mg.rounded !== '-') {
          const val = parseFloat(mg.rounded);
          if (!isNaN(val) && val >= 10) {
            if (isStudentFemale(student)) posM++;
            else posH++;
          }
        }
      });

      // Rule: Negativas = Existentes - Positivas
      const negH = Math.max(0, totalH - posH);
      const negM = Math.max(0, totalM - posM);
      const posHM = posH + posM;
      const negHM = negH + negM;

      const posPctH = totalH > 0 ? formatPct(posH, totalH) : '0,0';
      const posPctM = totalM > 0 ? formatPct(posM, totalM) : '0,0';
      const posPctHM = totalHM > 0 ? formatPct(posHM, totalHM) : '0,0';

      const negPctH = totalH > 0 ? formatPct(negH, totalH) : '0,0';
      const negPctM = totalM > 0 ? formatPct(negM, totalM) : '0,0';
      const negPctHM = totalHM > 0 ? formatPct(negHM, totalHM) : '0,0';

      const computedT2: Table2Data = {
        mapa33: { h: String(totalH), m: String(totalM), hm: String(totalHM) },
        existentesFim1: { h: String(totalH), m: String(totalM), hm: String(totalHM) },
        entraram2: { h: '0', m: '0', hm: '0' },
        total: { h: String(totalH), m: String(totalM), hm: String(totalHM) },
        transferidos: { h: '0', m: '0', hm: '0' },
        existentesFim2: { h: String(totalH), m: String(totalM), hm: String(totalHM) },
        positivasNum: {
          h: String(posH),
          m: String(posM),
          hm: String(posHM),
        },
        positivasPct: { h: posPctH, m: posPctM, hm: posPctHM },
        negativasNum: {
          h: String(negH),
          m: String(negM),
          hm: String(negHM),
        },
        negativasPct: { h: negPctH, m: negPctM, hm: negPctHM },
      };

      return { t1: computedT1, t2: computedT2 };
    };
  }, [selectedClass, user]);

  // Load data for active trimester (merging saved overrides if any)
  useEffect(() => {
    const saved = selectedClass.aproveitamentoData?.[trimester];
    const computed = computeFromClass(trimester);

    if (saved && saved.table1 && Array.isArray(saved.table1) && saved.table1.length > 0) {
      const mergedT1 = computed.t1.map((cRow) => {
        const sRow = saved.table1.find((r: Table1RowData) => r.id === cRow.id);
        const base = sRow ? { ...cRow, ...sRow } : cRow;
        return strictMode ? applyStrictRulesTable1Row(base) : base;
      });
      setTable1Data(mergedT1);
    } else {
      setTable1Data(computed.t1);
    }

    if (saved && saved.table2) {
      const mergedT2 = { ...computed.t2, ...saved.table2 };
      setTable2Data(strictMode ? applyStrictRulesTable2(mergedT2) : mergedT2);
    } else {
      setTable2Data(computed.t2);
    }

    setHasChanges(false);
  }, [trimester, selectedClass, computeFromClass, strictMode]);

  // Apply strict rules across both tables
  const handleApplyStrictRules = () => {
    setTable1Data((prev) => prev.map((row) => applyStrictRulesTable1Row(row)));
    setTable2Data((prev) => applyStrictRulesTable2(prev));
    setHasChanges(true);
    toast.success('Regras oficiais do modelo aplicadas e cálculos harmonizados com rigor!');
  };

  // Handle cell edit in Table 1
  const handleTable1Change = (index: number, field: keyof Table1RowData, value: string) => {
    setTable1Data((prev) => {
      const updated = [...prev];
      let row = { ...updated[index], [field]: value };

      if (strictMode) {
        row = applyStrictRulesTable1Row(row);
      } else {
        // Semi-auto calculation in flexible mode
        const nsNum = parseVal(row.ns);
        const sNum = parseVal(row.s);
        const bomNum = parseVal(row.bom);
        const mbNum = parseVal(row.mb);
        const eNum = parseVal(row.e);

        if (['ns', 's', 'bom', 'mb', 'e'].includes(field as string)) {
          const calcPos = sNum + bomNum + mbNum + eNum;
          const calcNeg = nsNum;
          const calcAA = calcPos + calcNeg;
          if (calcAA > 0) {
            row.aa = String(calcAA);
            row.positivasNum = String(calcPos);
            row.positivasPct = formatPct(calcPos, calcAA);
            row.negativasNum = String(calcNeg);
            row.negativasPct = formatPct(calcNeg, calcAA);
          }
        }
      }

      updated[index] = row;
      return updated;
    });
    setHasChanges(true);
  };

  // Handle cell edit in Table 2
  const handleTable2Change = (group: keyof Table2Data, sub: 'h' | 'm' | 'hm', value: string) => {
    setTable2Data((prev) => {
      const updated = { ...prev };
      const currentGroup = { ...updated[group], [sub]: value };
      updated[group] = currentGroup;

      if (strictMode) {
        return applyStrictRulesTable2(updated);
      } else {
        if (sub === 'h' || sub === 'm') {
          const hVal = parseVal(sub === 'h' ? value : currentGroup.h);
          const mVal = parseVal(sub === 'm' ? value : currentGroup.m);
          currentGroup.hm = String(hVal + mVal);
        }
        return updated;
      }
    });
    setHasChanges(true);
  };

  // Save current data
  const handleSave = async () => {
    if (!onUpdateClass) return;
    setIsSaving(true);
    try {
      const existingData = selectedClass.aproveitamentoData || {};
      const updatedClass: ClassData = {
        ...selectedClass,
        aproveitamentoData: {
          ...existingData,
          [trimester]: {
            table1: table1Data,
            table2: table2Data,
          },
        },
      };
      await onUpdateClass(updatedClass);
      setHasChanges(false);
      toast.success('Dados de Aproveitamento Pedagógico guardados com sucesso!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao guardar os dados.');
    } finally {
      setIsSaving(false);
    }
  };

  // Reset to auto-computed values from class
  const handleResetToAuto = () => {
    const computed = computeFromClass(trimester);
    setTable1Data(computed.t1);
    setTable2Data(computed.t2);
    setHasChanges(true);
    toast.info('Dados sincronizados e recalculados a partir das notas da turma.');
  };

  // Table 1 Totals (Strict Column by Column Sum)
  const table1Totals = useMemo(() => {
    let aaSum = 0;
    let nsSum = 0;
    let sSum = 0;
    let bomSum = 0;
    let mbSum = 0;
    let eSum = 0;
    let posNumSum = 0;
    let negNumSum = 0;
    let mPosNumSum = 0;
    let mNegNumSum = 0;

    table1Data.forEach((row) => {
      aaSum += parseVal(row.aa);
      nsSum += parseVal(row.ns);
      sSum += parseVal(row.s);
      bomSum += parseVal(row.bom);
      mbSum += parseVal(row.mb);
      eSum += parseVal(row.e);
      posNumSum += parseVal(row.positivasNum);
      negNumSum += parseVal(row.negativasNum);
      mPosNumSum += parseVal(row.meninasPosNum);
      mNegNumSum += parseVal(row.meninasNegNum);
    });

    const posPctAvg = aaSum > 0 ? formatPct(posNumSum, aaSum) : '0,0';
    const negPctAvg = aaSum > 0 ? formatPct(negNumSum, aaSum) : '0,0';
    const mTotalAA = mPosNumSum + mNegNumSum;
    const mPosPctAvg = mTotalAA > 0 ? formatPct(mPosNumSum, mTotalAA) : '0,0';
    const mNegPctAvg = mTotalAA > 0 ? formatPct(mNegNumSum, mTotalAA) : '0,0';

    return {
      aa: aaSum,
      ns: nsSum,
      s: sSum,
      bom: bomSum,
      mb: mbSum,
      e: eSum,
      posNum: posNumSum,
      posPct: posPctAvg,
      negNum: negNumSum,
      negPct: negPctAvg,
      mPosNum: mPosNumSum,
      mPosPct: mPosPctAvg,
      mNegNum: mNegNumSum,
      mNegPct: mNegPctAvg,
    };
  }, [table1Data]);

  // Export to Excel with Strict Structure matching Photo
  const handleExportExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      const aoa: any[][] = [
        ['REPÚBLICA DE MOÇAMBIQUE'],
        ['MINISTÉRIO DA EDUCAÇÃO E DESENVOLVIMENTO HUMANO'],
        [`APROVEITAMENTO PEDAGÓGICO DO ${trimester}º TRIMESTRE`],
        [
          `Escola: ${selectedClass.school || 'EduGestão'} | Turma: ${selectedClass.level} ${selectedClass.section} | Sala: ${selectedClass.room || '-'} | Turno: ${selectedClass.shift || 'Diurno'} | Ano Lectivo: ${selectedClass.academicYear || '-'}`,
        ],
        [],
        // Table 1 Header Row 1
        ['Disciplina', 'Professor', 'A.A.', 'Quantificação', '', '', '', '', 'Resultados', '', '', '', 'Meninas', '', '', ''],
        // Table 1 Header Row 2
        ['', '', '', 'NS', 'S', 'Bom', 'MB', 'E', 'Positivas', '', 'Negativas', '', 'Positivas', '', 'Negativas', ''],
        // Table 1 Header Row 3
        ['', '', '', '0/9', '10/13', '14/16', '17/18', '19/20', 'Nº', '%', 'Nº', '%', 'Nº', '%', 'Nº', '%'],
      ];

      // Table 1 Data rows
      table1Data.forEach((row) => {
        aoa.push([
          row.disciplina,
          row.professor,
          row.aa,
          row.ns,
          row.s,
          row.bom,
          row.mb,
          row.e,
          row.positivasNum,
          row.positivasPct ? `${row.positivasPct}%` : '',
          row.negativasNum,
          row.negativasPct ? `${row.negativasPct}%` : '',
          row.meninasPosNum,
          row.meninasPosPct ? `${row.meninasPosPct}%` : '',
          row.meninasNegNum,
          row.meninasNegPct ? `${row.meninasNegPct}%` : '',
        ]);
      });

      // Total row
      aoa.push([
        'TOTAL',
        '',
        table1Totals.aa,
        table1Totals.ns,
        table1Totals.s,
        table1Totals.bom,
        table1Totals.mb,
        table1Totals.e,
        table1Totals.posNum,
        `${table1Totals.posPct}%`,
        table1Totals.negNum,
        `${table1Totals.negPct}%`,
        table1Totals.mPosNum,
        `${table1Totals.mPosPct}%`,
        table1Totals.mNegNum,
        `${table1Totals.mNegPct}%`,
      ]);

      // Spacers
      aoa.push([]);
      aoa.push([]);

      // Table 2 Header Row 1
      aoa.push(['SITUAÇÃO GERAL DA TURMA (MAPA 3/3)']);
      aoa.push([
        'Mapa 3/3', '', '',
        `Existentes no ${trimester === '1' ? 'Início do 1º' : trimester === '2' ? 'fim do 1º' : 'fim do 2º'} Trimestre`, '', '',
        `Que entraram no ${trimester}º Trimestre`, '', '',
        'Total', '', '',
        'Transferidos', '', '',
        `Existentes no Fim do ${trimester}º Trimestre`, '', '',
        'Situação Positiva (Número)', '', '',
        'Situação Positiva (%)', '', '',
        'Situação Negativa (Número)', '', '',
        'Situação Negativa (%)', '', '',
      ]);

      // Table 2 Header Row 2 (H, M, HM)
      aoa.push([
        'H', 'M', 'HM',
        'H', 'M', 'HM',
        'H', 'M', 'HM',
        'H', 'M', 'HM',
        'H', 'M', 'HM',
        'H', 'M', 'HM',
        'H', 'M', 'HM',
        'H', 'M', 'HM',
        'H', 'M', 'HM',
        'H', 'M', 'HM',
      ]);

      // Table 2 Data row
      aoa.push([
        table2Data.mapa33.h, table2Data.mapa33.m, table2Data.mapa33.hm,
        table2Data.existentesFim1.h, table2Data.existentesFim1.m, table2Data.existentesFim1.hm,
        table2Data.entraram2.h, table2Data.entraram2.m, table2Data.entraram2.hm,
        table2Data.total.h, table2Data.total.m, table2Data.total.hm,
        table2Data.transferidos.h, table2Data.transferidos.m, table2Data.transferidos.hm,
        table2Data.existentesFim2.h, table2Data.existentesFim2.m, table2Data.existentesFim2.hm,
        table2Data.positivasNum.h, table2Data.positivasNum.m, table2Data.positivasNum.hm,
        table2Data.positivasPct.h ? `${table2Data.positivasPct.h}%` : '0,0%',
        table2Data.positivasPct.m ? `${table2Data.positivasPct.m}%` : '0,0%',
        table2Data.positivasPct.hm ? `${table2Data.positivasPct.hm}%` : '0,0%',
        table2Data.negativasNum.h, table2Data.negativasNum.m, table2Data.negativasNum.hm,
        table2Data.negativasPct.h ? `${table2Data.negativasPct.h}%` : '0,0%',
        table2Data.negativasPct.m ? `${table2Data.negativasPct.m}%` : '0,0%',
        table2Data.negativasPct.hm ? `${table2Data.negativasPct.hm}%` : '0,0%',
      ]);

      // Signatures spacer
      aoa.push([]);
      aoa.push([]);
      aoa.push(['Localidade e Data: ________________________, aos _____ de _______________ de 202___']);
      aoa.push([]);
      aoa.push([
        'O Director de Turma: ________________________________',
        '',
        '',
        '',
        'O Director Adjunto Pedagógico: ________________________________',
        '',
        '',
        '',
        'O Director da Escola: ________________________________',
      ]);

      const ws = XLSX.utils.aoa_to_sheet(aoa);

      const colWidths = Array.from({ length: 30 }, (_, i) => ({
        wch: i === 0 ? 18 : i === 1 ? 22 : 8,
      }));
      ws['!cols'] = colWidths;

      XLSX.utils.book_append_sheet(wb, ws, `Aproveitamento ${trimester}º Trim`);
      XLSX.writeFile(
        wb,
        `Aproveitamento_Pedagogico_${selectedClass.level.replace(/\s+/g, '_')}_${selectedClass.section}_${trimester}Trimestre.xlsx`
      );
      toast.success('Pauta oficial exportada com sucesso para Excel!');
    } catch (e) {
      console.error(e);
      toast.error('Erro ao exportar para Excel.');
    }
  };

  return (
    <div className="space-y-6 pt-4 sm:pt-6 animate-in fade-in duration-300">
      {/* Top Header Card (Hidden on Print) */}
      <div className="bg-card rounded-2xl border border-border shadow-xs p-3.5 sm:p-5 no-print space-y-3.5">
        {/* Row 1: Botão Voltar à Esquerda & Título Aproveitamento Pedagógico à Direita */}
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="outline"
            onClick={onBack}
            className="h-9 px-3.5 border border-purple-200 dark:border-purple-900/40 bg-purple-50/20 dark:bg-purple-950/20 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded-xl shadow-2xs flex items-center gap-1.5 cursor-pointer transition-all shrink-0 text-xs sm:text-sm font-semibold"
            title="Voltar para a página de Cálculo da Média Geral"
          >
            <ChevronLeft className="h-4.5 w-4.5 shrink-0" />
            <span>Voltar</span>
          </Button>

          <h2 className="text-base sm:text-xl font-extrabold text-foreground tracking-tight text-right flex items-center gap-2">
            <span>Aproveitamento Pedagógico</span>
            <BarChart3 className="h-5 w-5 text-purple-600 dark:text-purple-400 shrink-0" />
          </h2>
        </div>

        {/* Row 2: Reorganização da Aba de Selecção dos Trimestres & Botões de Acção */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-border/50">
          {/* Trimester Tabs */}
          <div className="flex p-0.5 bg-muted/70 rounded-xl border border-border/40 select-none">
            {(['1', '2', '3'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTrimester(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  trimester === t
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t}º Trimestre
              </button>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              onClick={handleExportExcel}
              className="h-8.5 px-3 border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/20 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-xs font-bold rounded-xl shadow-2xs flex items-center gap-1.5 cursor-pointer transition-all"
              title="Exportar pauta completa para ficheiro Excel"
            >
              <Download className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Exportar</span>
            </Button>

            <Button
              variant="outline"
              onClick={() => window.print()}
              className="h-8.5 px-2.5 sm:px-3 border border-border/80 text-foreground hover:bg-muted text-xs font-semibold rounded-xl shadow-2xs flex items-center gap-1.5 cursor-pointer"
              title="Imprimir modelo oficial (A4 Paisagem)"
            >
              <Printer className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline">Imprimir</span>
            </Button>

            <Button
              variant="outline"
              onClick={handleResetToAuto}
              className="h-8.5 px-2.5 sm:px-3 border border-zinc-300 dark:border-zinc-700 text-foreground hover:bg-muted text-xs font-semibold rounded-xl shadow-2xs flex items-center gap-1.5 cursor-pointer"
              title="Recalcular dados com base nas notas atuais dos alunos na Média Geral"
            >
              <RefreshCw className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline">Recalcular</span>
            </Button>

            {hasChanges && onUpdateClass && (
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="h-8.5 px-3.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-2xs flex items-center gap-1.5 cursor-pointer border-0"
              >
                {isSaving ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                <span>Guardar</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Official Sheet Container (Prints Crisp and Follows the Exact Provided Photo) */}
      <div className="bg-card rounded-2xl border border-border shadow-xs p-3.5 sm:p-6 space-y-6 overflow-hidden print:border-0 print:p-0 print:bg-white print:text-black">
        {/* Document Header - Clean Mozambican Official Structure */}
        <div className="text-center space-y-1 pb-1">
          <p className="text-xs sm:text-sm font-bold tracking-widest uppercase text-muted-foreground print:text-black">
            República de Moçambique
          </p>
          <p className="text-xs sm:text-sm font-semibold tracking-wide text-muted-foreground print:text-black">
            Ministério da Educação e Desenvolvimento Humano
          </p>
          <h3 className="text-base sm:text-xl font-black uppercase tracking-wider text-foreground print:text-black font-sans pt-1">
            APROVEITAMENTO PEDAGÓGICO DO {trimester}º TRIMESTRE
          </h3>
        </div>

        {/* ============================================================ */}
        {/* TABELA 1: APROVEITAMENTO PEDAGÓGICO DO _____ TRIMESTRE       */}
        {/* ============================================================ */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs sm:text-sm font-extrabold tracking-wide uppercase text-foreground print:text-black">
              1. Aproveitamento Pedagógico por Disciplina
            </h4>
          </div>

          <div className="overflow-x-auto custom-desktop-scrollbar border border-zinc-400 dark:border-zinc-700 rounded-lg print:border-black">
            <table className="w-full border-collapse text-center text-xs print:text-[9px]">
              {/* Header Rows */}
              <thead>
                <tr className="bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-bold border-b border-zinc-400 dark:border-zinc-700 print:bg-gray-200 print:text-black print:border-black">
                  <th
                    rowSpan={2}
                    className="border-r border-zinc-400 dark:border-zinc-700 p-2 text-left min-w-[120px] print:border-black"
                  >
                    Disciplina
                  </th>
                  <th
                    rowSpan={2}
                    className="border-r border-zinc-400 dark:border-zinc-700 p-2 min-w-[130px] print:border-black"
                  >
                    Professor
                  </th>
                  <th
                    rowSpan={2}
                    className="border-r border-zinc-400 dark:border-zinc-700 p-2 w-12 print:border-black"
                    title="Alunos Avaliados (NS + S + Bom + MB + E)"
                  >
                    A.A.
                  </th>
                  <th
                    colSpan={5}
                    className="border-r border-zinc-400 dark:border-zinc-700 p-1.5 text-center font-extrabold print:border-black"
                  >
                    Quantificação
                  </th>
                  <th
                    colSpan={4}
                    className="border-r border-zinc-400 dark:border-zinc-700 p-1.5 text-center font-extrabold print:border-black"
                  >
                    Resultados
                  </th>
                  <th
                    colSpan={4}
                    className="p-1.5 text-center font-extrabold print:border-black"
                  >
                    Meninas
                  </th>
                </tr>

                {/* Subheaders matching photo: NS 0/9, S 10/13, Bom 14/16, MB 17/18, E 19/20, etc. */}
                <tr className="bg-zinc-200/90 dark:bg-zinc-800/90 text-zinc-900 dark:text-zinc-100 font-bold border-b border-zinc-400 dark:border-zinc-700 print:bg-gray-150 print:text-black print:border-black text-[11px]">
                  {/* Quantificação subcolumns */}
                  <th className="border-r border-zinc-400 dark:border-zinc-700 p-1 w-11 print:border-black">
                    <div>NS</div>
                    <div className="text-[9px] font-normal text-muted-foreground print:text-gray-600">0/9</div>
                  </th>
                  <th className="border-r border-zinc-400 dark:border-zinc-700 p-1 w-11 print:border-black">
                    <div>S</div>
                    <div className="text-[9px] font-normal text-muted-foreground print:text-gray-600">10/13</div>
                  </th>
                  <th className="border-r border-zinc-400 dark:border-zinc-700 p-1 w-12 print:border-black">
                    <div>Bom</div>
                    <div className="text-[9px] font-normal text-muted-foreground print:text-gray-600">14/16</div>
                  </th>
                  <th className="border-r border-zinc-400 dark:border-zinc-700 p-1 w-11 print:border-black">
                    <div>MB</div>
                    <div className="text-[9px] font-normal text-muted-foreground print:text-gray-600">17/18</div>
                  </th>
                  <th className="border-r border-zinc-400 dark:border-zinc-700 p-1 w-11 print:border-black">
                    <div>E</div>
                    <div className="text-[9px] font-normal text-muted-foreground print:text-gray-600">19/20</div>
                  </th>

                  {/* Resultados: Positivas (Nº, %), Negativas (Nº, %) */}
                  <th className="border-r border-zinc-300 dark:border-zinc-700 p-1 w-10 print:border-black">
                    <div className="text-[10px] text-muted-foreground font-semibold">Positivas</div>
                    <div>Nº</div>
                  </th>
                  <th className="border-r border-zinc-400 dark:border-zinc-700 p-1 w-11 print:border-black">
                    <div className="text-[10px] text-muted-foreground font-semibold">Positivas</div>
                    <div>%</div>
                  </th>
                  <th className="border-r border-zinc-300 dark:border-zinc-700 p-1 w-10 print:border-black">
                    <div className="text-[10px] text-muted-foreground font-semibold">Negativas</div>
                    <div>Nº</div>
                  </th>
                  <th className="border-r border-zinc-400 dark:border-zinc-700 p-1 w-11 print:border-black">
                    <div className="text-[10px] text-muted-foreground font-semibold">Negativas</div>
                    <div>%</div>
                  </th>

                  {/* Meninas: Positivas (Nº, %), Negativas (Nº, %) */}
                  <th className="border-r border-zinc-300 dark:border-zinc-700 p-1 w-10 print:border-black">
                    <div className="text-[10px] text-muted-foreground font-semibold">Positivas</div>
                    <div>Nº</div>
                  </th>
                  <th className="border-r border-zinc-400 dark:border-zinc-700 p-1 w-11 print:border-black">
                    <div className="text-[10px] text-muted-foreground font-semibold">Positivas</div>
                    <div>%</div>
                  </th>
                  <th className="border-r border-zinc-300 dark:border-zinc-700 p-1 w-10 print:border-black">
                    <div className="text-[10px] text-muted-foreground font-semibold">Negativas</div>
                    <div>Nº</div>
                  </th>
                  <th className="p-1 w-11 print:border-black">
                    <div className="text-[10px] text-muted-foreground font-semibold">Negativas</div>
                    <div>%</div>
                  </th>
                </tr>
              </thead>

              {/* Table 1: 15 Exact Disciplines Body */}
              <tbody>
                {table1Data.map((row, idx) => (
                  <tr
                    key={row.id}
                    className="border-b border-zinc-300 dark:border-zinc-700 hover:bg-muted/30 odd:bg-muted/5 even:bg-transparent print:border-black"
                  >
                    {/* Disciplina Name */}
                    <td className="border-r border-zinc-300 dark:border-zinc-700 p-1.5 text-left font-bold text-foreground print:text-black whitespace-nowrap">
                      {row.disciplina}
                    </td>

                    {/* Professor */}
                    <td className="border-r border-zinc-300 dark:border-zinc-700 p-1">
                      <input
                        type="text"
                        value={row.professor}
                        onChange={(e) => handleTable1Change(idx, 'professor', e.target.value)}
                        placeholder="Nome do Prof."
                        className="w-full text-center bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-purple-500 rounded text-xs print:text-[9px]"
                      />
                    </td>

                    {/* A.A. (Alunos Avaliados) */}
                    <td className="border-r border-zinc-300 dark:border-zinc-700 p-1 font-bold bg-muted/10">
                      <input
                        type="text"
                        value={row.aa}
                        onChange={(e) => handleTable1Change(idx, 'aa', e.target.value)}
                        placeholder="-"
                        className="w-full text-center bg-transparent border-0 focus:outline-none font-bold text-foreground text-xs print:text-[9px]"
                        title="Alunos Avaliados = NS + S + Bom + MB + E"
                      />
                    </td>

                    {/* NS (0/9) */}
                    <td className="border-r border-zinc-300 dark:border-zinc-700 p-1">
                      <input
                        type="text"
                        value={row.ns}
                        onChange={(e) => handleTable1Change(idx, 'ns', e.target.value)}
                        placeholder="-"
                        className={`w-full text-center bg-transparent border-0 focus:outline-none text-xs print:text-[9px] ${
                          row.ns && row.ns !== '0' ? 'text-red-600 dark:text-red-400 font-bold' : ''
                        }`}
                      />
                    </td>

                    {/* S (10/13) */}
                    <td className="border-r border-zinc-300 dark:border-zinc-700 p-1">
                      <input
                        type="text"
                        value={row.s}
                        onChange={(e) => handleTable1Change(idx, 's', e.target.value)}
                        placeholder="-"
                        className="w-full text-center bg-transparent border-0 focus:outline-none text-xs print:text-[9px]"
                      />
                    </td>

                    {/* Bom (14/16) */}
                    <td className="border-r border-zinc-300 dark:border-zinc-700 p-1">
                      <input
                        type="text"
                        value={row.bom}
                        onChange={(e) => handleTable1Change(idx, 'bom', e.target.value)}
                        placeholder="-"
                        className="w-full text-center bg-transparent border-0 focus:outline-none text-xs print:text-[9px]"
                      />
                    </td>

                    {/* MB (17/18) */}
                    <td className="border-r border-zinc-300 dark:border-zinc-700 p-1">
                      <input
                        type="text"
                        value={row.mb}
                        onChange={(e) => handleTable1Change(idx, 'mb', e.target.value)}
                        placeholder="-"
                        className="w-full text-center bg-transparent border-0 focus:outline-none text-xs print:text-[9px]"
                      />
                    </td>

                    {/* E (19/20) */}
                    <td className="border-r border-zinc-300 dark:border-zinc-700 p-1">
                      <input
                        type="text"
                        value={row.e}
                        onChange={(e) => handleTable1Change(idx, 'e', e.target.value)}
                        placeholder="-"
                        className="w-full text-center bg-transparent border-0 focus:outline-none text-xs print:text-[9px]"
                      />
                    </td>

                    {/* Positivas Nº */}
                    <td className="border-r border-zinc-300 dark:border-zinc-700 p-1 font-bold text-blue-600 dark:text-blue-400 bg-blue-50/20 dark:bg-blue-950/20 print:text-black">
                      <input
                        type="text"
                        value={row.positivasNum}
                        onChange={(e) => handleTable1Change(idx, 'positivasNum', e.target.value)}
                        placeholder="-"
                        className="w-full text-center bg-transparent border-0 focus:outline-none font-bold text-xs print:text-[9px]"
                        title="Positivas Nº = S + Bom + MB + E"
                      />
                    </td>

                    {/* Positivas % */}
                    <td className="border-r border-zinc-300 dark:border-zinc-700 p-1 text-muted-foreground print:text-black">
                      <input
                        type="text"
                        value={row.positivasPct}
                        onChange={(e) => handleTable1Change(idx, 'positivasPct', e.target.value)}
                        placeholder="-"
                        className="w-full text-center bg-transparent border-0 focus:outline-none text-xs print:text-[9px]"
                        title="Positivas % = (Positivas / A.A.) * 100"
                      />
                    </td>

                    {/* Negativas Nº */}
                    <td className="border-r border-zinc-300 dark:border-zinc-700 p-1 font-bold text-red-600 dark:text-red-400 bg-red-50/20 dark:bg-red-950/20 print:text-black">
                      <input
                        type="text"
                        value={row.negativasNum}
                        onChange={(e) => handleTable1Change(idx, 'negativasNum', e.target.value)}
                        placeholder="-"
                        className="w-full text-center bg-transparent border-0 focus:outline-none font-bold text-xs print:text-[9px]"
                        title="Negativas Nº = NS"
                      />
                    </td>

                    {/* Negativas % */}
                    <td className="border-r border-zinc-300 dark:border-zinc-700 p-1 text-muted-foreground print:text-black">
                      <input
                        type="text"
                        value={row.negativasPct}
                        onChange={(e) => handleTable1Change(idx, 'negativasPct', e.target.value)}
                        placeholder="-"
                        className="w-full text-center bg-transparent border-0 focus:outline-none text-xs print:text-[9px]"
                        title="Negativas % = (Negativas / A.A.) * 100"
                      />
                    </td>

                    {/* Meninas Positivas Nº */}
                    <td className="border-r border-zinc-300 dark:border-zinc-700 p-1 font-semibold text-emerald-600 dark:text-emerald-400 print:text-black">
                      <input
                        type="text"
                        value={row.meninasPosNum}
                        onChange={(e) => handleTable1Change(idx, 'meninasPosNum', e.target.value)}
                        placeholder="-"
                        className="w-full text-center bg-transparent border-0 focus:outline-none font-semibold text-xs print:text-[9px]"
                      />
                    </td>

                    {/* Meninas Positivas % */}
                    <td className="border-r border-zinc-300 dark:border-zinc-700 p-1 text-muted-foreground print:text-black">
                      <input
                        type="text"
                        value={row.meninasPosPct}
                        onChange={(e) => handleTable1Change(idx, 'meninasPosPct', e.target.value)}
                        placeholder="-"
                        className="w-full text-center bg-transparent border-0 focus:outline-none text-xs print:text-[9px]"
                        title="Meninas Positivas % = (Meninas Pos / Meninas Avaliadas) * 100"
                      />
                    </td>

                    {/* Meninas Negativas Nº */}
                    <td className="border-r border-zinc-300 dark:border-zinc-700 p-1 font-semibold text-red-600 dark:text-red-400 print:text-black">
                      <input
                        type="text"
                        value={row.meninasNegNum}
                        onChange={(e) => handleTable1Change(idx, 'meninasNegNum', e.target.value)}
                        placeholder="-"
                        className="w-full text-center bg-transparent border-0 focus:outline-none font-semibold text-xs print:text-[9px]"
                      />
                    </td>

                    {/* Meninas Negativas % */}
                    <td className="p-1 text-muted-foreground print:text-black">
                      <input
                        type="text"
                        value={row.meninasNegPct}
                        onChange={(e) => handleTable1Change(idx, 'meninasNegPct', e.target.value)}
                        placeholder="-"
                        className="w-full text-center bg-transparent border-0 focus:outline-none text-xs print:text-[9px]"
                        title="Meninas Negativas % = (Meninas Neg / Meninas Avaliadas) * 100"
                      />
                    </td>
                  </tr>
                ))}

                {/* Total Row */}
                <tr className="bg-zinc-200/90 dark:bg-zinc-800/90 font-black border-t-2 border-zinc-500 dark:border-zinc-600 print:bg-gray-200 print:text-black print:border-black text-xs print:text-[9px]">
                  <td className="border-r border-zinc-400 dark:border-zinc-700 p-2 text-left font-black tracking-wider">
                    TOTAL
                  </td>
                  <td className="border-r border-zinc-400 dark:border-zinc-700 p-2 text-muted-foreground">-</td>
                  <td className="border-r border-zinc-400 dark:border-zinc-700 p-2 text-center font-black bg-muted/20">
                    {table1Totals.aa}
                  </td>
                  <td className="border-r border-zinc-400 dark:border-zinc-700 p-2 text-center">{table1Totals.ns}</td>
                  <td className="border-r border-zinc-400 dark:border-zinc-700 p-2 text-center">{table1Totals.s}</td>
                  <td className="border-r border-zinc-400 dark:border-zinc-700 p-2 text-center">{table1Totals.bom}</td>
                  <td className="border-r border-zinc-400 dark:border-zinc-700 p-2 text-center">{table1Totals.mb}</td>
                  <td className="border-r border-zinc-400 dark:border-zinc-700 p-2 text-center">{table1Totals.e}</td>
                  <td className="border-r border-zinc-400 dark:border-zinc-700 p-2 text-center text-blue-700 dark:text-blue-300 font-black bg-blue-50/30 dark:bg-blue-950/30 print:text-black">
                    {table1Totals.posNum}
                  </td>
                  <td className="border-r border-zinc-400 dark:border-zinc-700 p-2 text-center font-bold">
                    {table1Totals.posPct}%
                  </td>
                  <td className="border-r border-zinc-400 dark:border-zinc-700 p-2 text-center text-red-700 dark:text-red-300 font-black bg-red-50/30 dark:bg-red-950/30 print:text-black">
                    {table1Totals.negNum}
                  </td>
                  <td className="border-r border-zinc-400 dark:border-zinc-700 p-2 text-center font-bold">
                    {table1Totals.negPct}%
                  </td>
                  <td className="border-r border-zinc-400 dark:border-zinc-700 p-2 text-center font-black text-emerald-700 dark:text-emerald-300 print:text-black">
                    {table1Totals.mPosNum}
                  </td>
                  <td className="border-r border-zinc-400 dark:border-zinc-700 p-2 text-center font-bold">
                    {table1Totals.mPosPct}%
                  </td>
                  <td className="border-r border-zinc-400 dark:border-zinc-700 p-2 text-center font-black text-red-700 dark:text-red-300 print:text-black">
                    {table1Totals.mNegNum}
                  </td>
                  <td className="p-2 text-center font-bold">{table1Totals.mNegPct}%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ============================================================ */}
        {/* TABELA 2: Situação Geral da Turma (Exatamente como na foto)  */}
        {/* ============================================================ */}
        <div className="space-y-3 pt-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs sm:text-sm font-extrabold tracking-wide uppercase text-foreground print:text-black">
              2. Situação Geral da Turma (Mapa 3/3)
            </h4>
          </div>

          <div className="overflow-x-auto custom-desktop-scrollbar border border-zinc-400 dark:border-zinc-700 rounded-lg print:border-black">
            <table className="w-full border-collapse text-center text-xs print:text-[8px]">
              {/* Header Row 1: 10 main columns matching the photo */}
              <thead>
                <tr className="bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-extrabold border-b border-zinc-400 dark:border-zinc-700 print:bg-gray-200 print:text-black print:border-black">
                  <th colSpan={3} className="border-r border-zinc-400 dark:border-zinc-700 p-2 min-w-[75px]">
                    Mapa 3/3
                  </th>
                  <th colSpan={3} className="border-r border-zinc-400 dark:border-zinc-700 p-2 min-w-[125px]">
                    {trimester === '1'
                      ? 'Existentes no Início do 1º Trimestre'
                      : trimester === '2'
                      ? 'Existentes no fim do 1º Trimestre'
                      : 'Existentes no fim do 2º Trimestre'}
                  </th>
                  <th colSpan={3} className="border-r border-zinc-400 dark:border-zinc-700 p-2 min-w-[110px]">
                    Que entraram no {trimester}º Trimestre
                  </th>
                  <th colSpan={3} className="border-r border-zinc-400 dark:border-zinc-700 p-2 min-w-[75px]">
                    Total
                  </th>
                  <th colSpan={3} className="border-r border-zinc-400 dark:border-zinc-700 p-2 min-w-[85px]">
                    Transferidos
                  </th>
                  <th colSpan={3} className="border-r border-zinc-400 dark:border-zinc-700 p-2 min-w-[120px]">
                    Existentes no Fim do {trimester}ºTrimestre
                  </th>
                  <th colSpan={3} className="border-r border-zinc-400 dark:border-zinc-700 p-2 min-w-[125px]">
                    Situação Positiva (Número)
                  </th>
                  <th colSpan={3} className="border-r border-zinc-400 dark:border-zinc-700 p-2 min-w-[110px]">
                    Situação Positiva (%)
                  </th>
                  <th colSpan={3} className="border-r border-zinc-400 dark:border-zinc-700 p-2 min-w-[125px]">
                    Situação Negativa (Número)
                  </th>
                  <th colSpan={3} className="p-2 min-w-[110px]">
                    Situação Negativa (%)
                  </th>
                </tr>

                {/* Header Row 2: H, M, HM under each column */}
                <tr className="bg-zinc-200/90 dark:bg-zinc-800/90 text-zinc-900 dark:text-zinc-100 font-bold border-b border-zinc-400 dark:border-zinc-700 print:bg-gray-150 print:text-black print:border-black text-[11px]">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <React.Fragment key={i}>
                      <th className="border-r border-zinc-300 dark:border-zinc-700 p-1 w-9 print:border-black" title="Homens (Rapazes)">
                        H
                      </th>
                      <th className="border-r border-zinc-300 dark:border-zinc-700 p-1 w-9 print:border-black" title="Mulheres (Raparigas)">
                        M
                      </th>
                      <th
                        className={`p-1 w-10 font-black bg-muted/20 ${
                          i < 9 ? 'border-r border-zinc-400 dark:border-zinc-700 print:border-black' : ''
                        }`}
                        title="Total Homens + Mulheres"
                      >
                        HM
                      </th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>

              {/* Data Row */}
              <tbody>
                <tr className="border-b border-zinc-400 dark:border-zinc-700 font-semibold print:border-black">
                  {/* 1. Mapa 3/3 */}
                  <td className="border-r border-zinc-300 dark:border-zinc-700 p-1">
                    <input
                      type="text"
                      value={table2Data.mapa33.h}
                      onChange={(e) => handleTable2Change('mapa33', 'h', e.target.value)}
                      className="w-full text-center bg-transparent border-0 focus:outline-none text-xs print:text-[8px]"
                    />
                  </td>
                  <td className="border-r border-zinc-300 dark:border-zinc-700 p-1">
                    <input
                      type="text"
                      value={table2Data.mapa33.m}
                      onChange={(e) => handleTable2Change('mapa33', 'm', e.target.value)}
                      className="w-full text-center bg-transparent border-0 focus:outline-none text-xs print:text-[8px]"
                    />
                  </td>
                  <td className="border-r border-zinc-400 dark:border-zinc-700 p-1 font-bold bg-muted/20">
                    <input
                      type="text"
                      value={table2Data.mapa33.hm}
                      onChange={(e) => handleTable2Change('mapa33', 'hm', e.target.value)}
                      className="w-full text-center bg-transparent border-0 focus:outline-none font-bold text-xs print:text-[8px]"
                    />
                  </td>

                  {/* 2. Existentes fim anterior */}
                  <td className="border-r border-zinc-300 dark:border-zinc-700 p-1">
                    <input
                      type="text"
                      value={table2Data.existentesFim1.h}
                      onChange={(e) => handleTable2Change('existentesFim1', 'h', e.target.value)}
                      className="w-full text-center bg-transparent border-0 focus:outline-none text-xs print:text-[8px]"
                    />
                  </td>
                  <td className="border-r border-zinc-300 dark:border-zinc-700 p-1">
                    <input
                      type="text"
                      value={table2Data.existentesFim1.m}
                      onChange={(e) => handleTable2Change('existentesFim1', 'm', e.target.value)}
                      className="w-full text-center bg-transparent border-0 focus:outline-none text-xs print:text-[8px]"
                    />
                  </td>
                  <td className="border-r border-zinc-400 dark:border-zinc-700 p-1 font-bold bg-muted/20">
                    <input
                      type="text"
                      value={table2Data.existentesFim1.hm}
                      onChange={(e) => handleTable2Change('existentesFim1', 'hm', e.target.value)}
                      className="w-full text-center bg-transparent border-0 focus:outline-none font-bold text-xs print:text-[8px]"
                    />
                  </td>

                  {/* 3. Que entraram */}
                  <td className="border-r border-zinc-300 dark:border-zinc-700 p-1">
                    <input
                      type="text"
                      value={table2Data.entraram2.h}
                      onChange={(e) => handleTable2Change('entraram2', 'h', e.target.value)}
                      className="w-full text-center bg-transparent border-0 focus:outline-none text-xs print:text-[8px]"
                    />
                  </td>
                  <td className="border-r border-zinc-300 dark:border-zinc-700 p-1">
                    <input
                      type="text"
                      value={table2Data.entraram2.m}
                      onChange={(e) => handleTable2Change('entraram2', 'm', e.target.value)}
                      className="w-full text-center bg-transparent border-0 focus:outline-none text-xs print:text-[8px]"
                    />
                  </td>
                  <td className="border-r border-zinc-400 dark:border-zinc-700 p-1 font-bold bg-muted/20">
                    <input
                      type="text"
                      value={table2Data.entraram2.hm}
                      onChange={(e) => handleTable2Change('entraram2', 'hm', e.target.value)}
                      className="w-full text-center bg-transparent border-0 focus:outline-none font-bold text-xs print:text-[8px]"
                    />
                  </td>

                  {/* 4. Total (Existentes + Entraram) */}
                  <td className="border-r border-zinc-300 dark:border-zinc-700 p-1 bg-muted/10">
                    <input
                      type="text"
                      value={table2Data.total.h}
                      onChange={(e) => handleTable2Change('total', 'h', e.target.value)}
                      className="w-full text-center bg-transparent border-0 focus:outline-none text-xs print:text-[8px]"
                      title="Total H = Existentes H + Entraram H"
                    />
                  </td>
                  <td className="border-r border-zinc-300 dark:border-zinc-700 p-1 bg-muted/10">
                    <input
                      type="text"
                      value={table2Data.total.m}
                      onChange={(e) => handleTable2Change('total', 'm', e.target.value)}
                      className="w-full text-center bg-transparent border-0 focus:outline-none text-xs print:text-[8px]"
                      title="Total M = Existentes M + Entraram M"
                    />
                  </td>
                  <td className="border-r border-zinc-400 dark:border-zinc-700 p-1 font-bold bg-muted/25">
                    <input
                      type="text"
                      value={table2Data.total.hm}
                      onChange={(e) => handleTable2Change('total', 'hm', e.target.value)}
                      className="w-full text-center bg-transparent border-0 focus:outline-none font-bold text-xs print:text-[8px]"
                    />
                  </td>

                  {/* 5. Transferidos */}
                  <td className="border-r border-zinc-300 dark:border-zinc-700 p-1">
                    <input
                      type="text"
                      value={table2Data.transferidos.h}
                      onChange={(e) => handleTable2Change('transferidos', 'h', e.target.value)}
                      className="w-full text-center bg-transparent border-0 focus:outline-none text-xs print:text-[8px]"
                    />
                  </td>
                  <td className="border-r border-zinc-300 dark:border-zinc-700 p-1">
                    <input
                      type="text"
                      value={table2Data.transferidos.m}
                      onChange={(e) => handleTable2Change('transferidos', 'm', e.target.value)}
                      className="w-full text-center bg-transparent border-0 focus:outline-none text-xs print:text-[8px]"
                    />
                  </td>
                  <td className="border-r border-zinc-400 dark:border-zinc-700 p-1 font-bold bg-muted/20">
                    <input
                      type="text"
                      value={table2Data.transferidos.hm}
                      onChange={(e) => handleTable2Change('transferidos', 'hm', e.target.value)}
                      className="w-full text-center bg-transparent border-0 focus:outline-none font-bold text-xs print:text-[8px]"
                    />
                  </td>

                  {/* 6. Existentes no Fim (Total - Transferidos) */}
                  <td className="border-r border-zinc-300 dark:border-zinc-700 p-1 bg-muted/10">
                    <input
                      type="text"
                      value={table2Data.existentesFim2.h}
                      onChange={(e) => handleTable2Change('existentesFim2', 'h', e.target.value)}
                      className="w-full text-center bg-transparent border-0 focus:outline-none text-xs print:text-[8px]"
                      title="Existentes Fim H = Total H - Transferidos H"
                    />
                  </td>
                  <td className="border-r border-zinc-300 dark:border-zinc-700 p-1 bg-muted/10">
                    <input
                      type="text"
                      value={table2Data.existentesFim2.m}
                      onChange={(e) => handleTable2Change('existentesFim2', 'm', e.target.value)}
                      className="w-full text-center bg-transparent border-0 focus:outline-none text-xs print:text-[8px]"
                      title="Existentes Fim M = Total M - Transferidos M"
                    />
                  </td>
                  <td className="border-r border-zinc-400 dark:border-zinc-700 p-1 font-bold bg-muted/25">
                    <input
                      type="text"
                      value={table2Data.existentesFim2.hm}
                      onChange={(e) => handleTable2Change('existentesFim2', 'hm', e.target.value)}
                      className="w-full text-center bg-transparent border-0 focus:outline-none font-bold text-xs print:text-[8px]"
                    />
                  </td>

                  {/* 7. Situação Positiva (Número) */}
                  <td className="border-r border-zinc-300 dark:border-zinc-700 p-1 text-blue-600 dark:text-blue-400 font-bold bg-blue-50/20 dark:bg-blue-950/20 print:text-black">
                    <input
                      type="text"
                      value={table2Data.positivasNum.h}
                      onChange={(e) => handleTable2Change('positivasNum', 'h', e.target.value)}
                      className="w-full text-center bg-transparent border-0 focus:outline-none font-bold text-xs print:text-[8px]"
                    />
                  </td>
                  <td className="border-r border-zinc-300 dark:border-zinc-700 p-1 text-blue-600 dark:text-blue-400 font-bold bg-blue-50/20 dark:bg-blue-950/20 print:text-black">
                    <input
                      type="text"
                      value={table2Data.positivasNum.m}
                      onChange={(e) => handleTable2Change('positivasNum', 'm', e.target.value)}
                      className="w-full text-center bg-transparent border-0 focus:outline-none font-bold text-xs print:text-[8px]"
                    />
                  </td>
                  <td className="border-r border-zinc-400 dark:border-zinc-700 p-1 font-black text-blue-700 dark:text-blue-300 bg-blue-100/30 dark:bg-blue-950/40 print:text-black">
                    <input
                      type="text"
                      value={table2Data.positivasNum.hm}
                      onChange={(e) => handleTable2Change('positivasNum', 'hm', e.target.value)}
                      className="w-full text-center bg-transparent border-0 focus:outline-none font-black text-xs print:text-[8px]"
                    />
                  </td>

                  {/* 8. Situação Positiva (%) */}
                  <td className="border-r border-zinc-300 dark:border-zinc-700 p-1 text-muted-foreground print:text-black">
                    <input
                      type="text"
                      value={table2Data.positivasPct.h}
                      onChange={(e) => handleTable2Change('positivasPct', 'h', e.target.value)}
                      className="w-full text-center bg-transparent border-0 focus:outline-none text-xs print:text-[8px]"
                      title="Positivas % (H) = (Positivas H / Existentes Fim H) * 100"
                    />
                  </td>
                  <td className="border-r border-zinc-300 dark:border-zinc-700 p-1 text-muted-foreground print:text-black">
                    <input
                      type="text"
                      value={table2Data.positivasPct.m}
                      onChange={(e) => handleTable2Change('positivasPct', 'm', e.target.value)}
                      className="w-full text-center bg-transparent border-0 focus:outline-none text-xs print:text-[8px]"
                      title="Positivas % (M) = (Positivas M / Existentes Fim M) * 100"
                    />
                  </td>
                  <td className="border-r border-zinc-400 dark:border-zinc-700 p-1 font-bold text-foreground bg-muted/20 print:text-black">
                    <input
                      type="text"
                      value={table2Data.positivasPct.hm}
                      onChange={(e) => handleTable2Change('positivasPct', 'hm', e.target.value)}
                      className="w-full text-center bg-transparent border-0 focus:outline-none font-bold text-xs print:text-[8px]"
                      title="Positivas % (HM) = (Positivas HM / Existentes Fim HM) * 100"
                    />
                  </td>

                  {/* 9. Situação Negativa (Número) */}
                  <td className="border-r border-zinc-300 dark:border-zinc-700 p-1 text-red-600 dark:text-red-400 font-bold bg-red-50/20 dark:bg-red-950/20 print:text-black">
                    <input
                      type="text"
                      value={table2Data.negativasNum.h}
                      onChange={(e) => handleTable2Change('negativasNum', 'h', e.target.value)}
                      className="w-full text-center bg-transparent border-0 focus:outline-none font-bold text-xs print:text-[8px]"
                      title="Negativas H = Existentes Fim H - Positivas H"
                    />
                  </td>
                  <td className="border-r border-zinc-300 dark:border-zinc-700 p-1 text-red-600 dark:text-red-400 font-bold bg-red-50/20 dark:bg-red-950/20 print:text-black">
                    <input
                      type="text"
                      value={table2Data.negativasNum.m}
                      onChange={(e) => handleTable2Change('negativasNum', 'm', e.target.value)}
                      className="w-full text-center bg-transparent border-0 focus:outline-none font-bold text-xs print:text-[8px]"
                      title="Negativas M = Existentes Fim M - Positivas M"
                    />
                  </td>
                  <td className="border-r border-zinc-400 dark:border-zinc-700 p-1 font-black text-red-700 dark:text-red-300 bg-red-100/30 dark:bg-red-950/40 print:text-black">
                    <input
                      type="text"
                      value={table2Data.negativasNum.hm}
                      onChange={(e) => handleTable2Change('negativasNum', 'hm', e.target.value)}
                      className="w-full text-center bg-transparent border-0 focus:outline-none font-black text-xs print:text-[8px]"
                    />
                  </td>

                  {/* 10. Situação Negativa (%) */}
                  <td className="border-r border-zinc-300 dark:border-zinc-700 p-1 text-muted-foreground print:text-black">
                    <input
                      type="text"
                      value={table2Data.negativasPct.h}
                      onChange={(e) => handleTable2Change('negativasPct', 'h', e.target.value)}
                      className="w-full text-center bg-transparent border-0 focus:outline-none text-xs print:text-[8px]"
                      title="Negativas % (H) = (Negativas H / Existentes Fim H) * 100"
                    />
                  </td>
                  <td className="border-r border-zinc-300 dark:border-zinc-700 p-1 text-muted-foreground print:text-black">
                    <input
                      type="text"
                      value={table2Data.negativasPct.m}
                      onChange={(e) => handleTable2Change('negativasPct', 'm', e.target.value)}
                      className="w-full text-center bg-transparent border-0 focus:outline-none text-xs print:text-[8px]"
                      title="Negativas % (M) = (Negativas M / Existentes Fim M) * 100"
                    />
                  </td>
                  <td className="p-1 font-bold text-foreground bg-muted/20 print:text-black">
                    <input
                      type="text"
                      value={table2Data.negativasPct.hm}
                      onChange={(e) => handleTable2Change('negativasPct', 'hm', e.target.value)}
                      className="w-full text-center bg-transparent border-0 focus:outline-none font-bold text-xs print:text-[8px]"
                      title="Negativas % (HM) = (Negativas HM / Existentes Fim HM) * 100"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
