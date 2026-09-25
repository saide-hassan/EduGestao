import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, BarChart3, Download, Printer, RefreshCw, Save, Check } from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ClassData, Student } from '@/src/App';
import { calculateMediaGeralForStudent, isStudentFemale } from '@/src/App';

export const APROVEITAMENTO_DISCIPLINAS = [
  { id: 'portugues', name: 'Português', key: 'P' },
  { id: 'ingles', name: 'Inglês', key: 'I' },
  { id: 'historia', name: 'História', key: 'H' },
  { id: 'geografia', name: 'Geografia', key: 'G' },
  { id: 'filosofia', name: 'Filosofia', key: 'FIL' },
  { id: 'matematica', name: 'Matemática', key: 'M' },
  { id: 'fisica', name: 'Física', key: 'F' },
  { id: 'quimica', name: 'Química', key: 'Q' },
  { id: 'biologia', name: 'Biologia', key: 'B' },
  { id: 'ed_visual', name: 'Ed. Visual', key: 'EdV' },
  { id: 'frances', name: 'Francês', key: 'FR' },
  { id: 'ne', name: 'NE', key: 'NE' },
  { id: 'ap', name: 'AP', key: 'AP' },
  { id: 'dgd', name: 'DGD', key: 'DGD' },
  { id: 'ed_fisica', name: 'Ed. Física', key: 'EdF' },
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
          // Look for grade in trimesterSubjectGrades
          const subGrades = student.trimesterSubjectGrades?.[t] || {};
          let valStr = subGrades[disc.key] || subGrades[disc.id] || '';

          // If not found in Média Geral subGrades, check if the class itself teaches this subject
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
        const posPct = aa > 0 ? ((posNum / aa) * 100).toFixed(1).replace('.', ',') : '';
        const negPct = aa > 0 ? ((negNum / aa) * 100).toFixed(1).replace('.', ',') : '';
        const mPosPct = meninasAA > 0 ? ((meninasPos / meninasAA) * 100).toFixed(1).replace('.', ',') : '';
        const mNegPct = meninasAA > 0 ? ((meninasNeg / meninasAA) * 100).toFixed(1).replace('.', ',') : '';

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

      // 2. Compute Table 2 (Situação Geral)
      let totalH = 0;
      let totalM = 0;
      selectedClass.students.forEach((student) => {
        if (isStudentFemale(student)) totalM++;
        else totalH++;
      });
      const totalHM = totalH + totalM;

      let posH = 0;
      let posM = 0;
      let negH = 0;
      let negM = 0;
      let evalH = 0;
      let evalM = 0;

      selectedClass.students.forEach((student) => {
        const mg = calculateMediaGeralForStudent(student, t);
        if (mg.hasAnyGrade && mg.rounded !== '-') {
          const val = parseFloat(mg.rounded);
          if (!isNaN(val)) {
            const isFemale = isStudentFemale(student);
            if (isFemale) {
              evalM++;
              if (val >= 10) posM++;
              else negM++;
            } else {
              evalH++;
              if (val >= 10) posH++;
              else negH++;
            }
          }
        }
      });

      const posHM = posH + posM;
      const negHM = negH + negM;
      const evalHM = evalH + evalM;

      const posPctH = evalH > 0 ? ((posH / evalH) * 100).toFixed(1).replace('.', ',') : '';
      const posPctM = evalM > 0 ? ((posM / evalM) * 100).toFixed(1).replace('.', ',') : '';
      const posPctHM = evalHM > 0 ? ((posHM / evalHM) * 100).toFixed(1).replace('.', ',') : '';

      const negPctH = evalH > 0 ? ((negH / evalH) * 100).toFixed(1).replace('.', ',') : '';
      const negPctM = evalM > 0 ? ((negM / evalM) * 100).toFixed(1).replace('.', ',') : '';
      const negPctHM = evalHM > 0 ? ((negHM / evalHM) * 100).toFixed(1).replace('.', ',') : '';

      const computedT2: Table2Data = {
        mapa33: { h: String(totalH), m: String(totalM), hm: String(totalHM) },
        existentesFim1: { h: String(totalH), m: String(totalM), hm: String(totalHM) },
        entraram2: { h: '0', m: '0', hm: '0' },
        total: { h: String(totalH), m: String(totalM), hm: String(totalHM) },
        transferidos: { h: '0', m: '0', hm: '0' },
        existentesFim2: { h: String(totalH), m: String(totalM), hm: String(totalHM) },
        positivasNum: {
          h: posH > 0 ? String(posH) : '0',
          m: posM > 0 ? String(posM) : '0',
          hm: posHM > 0 ? String(posHM) : '0',
        },
        positivasPct: { h: posPctH, m: posPctM, hm: posPctHM },
        negativasNum: {
          h: negH > 0 ? String(negH) : '0',
          m: negM > 0 ? String(negM) : '0',
          hm: negHM > 0 ? String(negHM) : '0',
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
      // Merge saved with computed structure
      const mergedT1 = computed.t1.map((cRow) => {
        const sRow = saved.table1.find((r: Table1RowData) => r.id === cRow.id);
        return sRow ? { ...cRow, ...sRow } : cRow;
      });
      setTable1Data(mergedT1);
    } else {
      setTable1Data(computed.t1);
    }

    if (saved && saved.table2) {
      setTable2Data({ ...computed.t2, ...saved.table2 });
    } else {
      setTable2Data(computed.t2);
    }

    setHasChanges(false);
  }, [trimester, selectedClass, computeFromClass]);

  // Handle cell edit in Table 1
  const handleTable1Change = (index: number, field: keyof Table1RowData, value: string) => {
    setTable1Data((prev) => {
      const updated = [...prev];
      const row = { ...updated[index], [field]: value };

      // Auto update calculations when numeric fields change
      const nsNum = parseFloat(row.ns || '0') || 0;
      const sNum = parseFloat(row.s || '0') || 0;
      const bomNum = parseFloat(row.bom || '0') || 0;
      const mbNum = parseFloat(row.mb || '0') || 0;
      const eNum = parseFloat(row.e || '0') || 0;

      if (['ns', 's', 'bom', 'mb', 'e'].includes(field as string)) {
        const calcPos = sNum + bomNum + mbNum + eNum;
        const calcNeg = nsNum;
        const calcAA = calcPos + calcNeg;
        if (calcAA > 0) {
          row.aa = String(calcAA);
          row.positivasNum = String(calcPos);
          row.positivasPct = ((calcPos / calcAA) * 100).toFixed(1).replace('.', ',');
          row.negativasNum = String(calcNeg);
          row.negativasPct = ((calcNeg / calcAA) * 100).toFixed(1).replace('.', ',');
        }
      }

      if (['meninasPosNum', 'aa'].includes(field as string)) {
        const mPos = parseFloat(row.meninasPosNum || '0') || 0;
        const aaTotal = parseFloat(row.aa || '0') || 0;
        if (aaTotal > 0 && mPos > 0) {
          row.meninasPosPct = ((mPos / aaTotal) * 100).toFixed(1).replace('.', ',');
        }
      }

      if (['meninasNegNum', 'aa'].includes(field as string)) {
        const mNeg = parseFloat(row.meninasNegNum || '0') || 0;
        const aaTotal = parseFloat(row.aa || '0') || 0;
        if (aaTotal > 0 && mNeg > 0) {
          row.meninasNegPct = ((mNeg / aaTotal) * 100).toFixed(1).replace('.', ',');
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

      if (sub === 'h' || sub === 'm') {
        const hVal = parseFloat(sub === 'h' ? value : currentGroup.h) || 0;
        const mVal = parseFloat(sub === 'm' ? value : currentGroup.m) || 0;
        currentGroup.hm = String(hVal + mVal);
      }

      updated[group] = currentGroup;
      return updated;
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
      toast.success('Dados de Aproveitamento Pedagógico guardados!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao guardar os dados.');
    } finally {
      setIsSaving(false);
    }
  };

  // Reset to auto-computed values
  const handleResetToAuto = () => {
    const computed = computeFromClass(trimester);
    setTable1Data(computed.t1);
    setTable2Data(computed.t2);
    setHasChanges(true);
    toast.info('Dados sincronizados a partir das notas da turma.');
  };

  // Table 1 Totals
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
      aaSum += parseFloat(row.aa || '0') || 0;
      nsSum += parseFloat(row.ns || '0') || 0;
      sSum += parseFloat(row.s || '0') || 0;
      bomSum += parseFloat(row.bom || '0') || 0;
      mbSum += parseFloat(row.mb || '0') || 0;
      eSum += parseFloat(row.e || '0') || 0;
      posNumSum += parseFloat(row.positivasNum || '0') || 0;
      negNumSum += parseFloat(row.negativasNum || '0') || 0;
      mPosNumSum += parseFloat(row.meninasPosNum || '0') || 0;
      mNegNumSum += parseFloat(row.meninasNegNum || '0') || 0;
    });

    const posPctAvg = aaSum > 0 ? ((posNumSum / aaSum) * 100).toFixed(1).replace('.', ',') : '-';
    const negPctAvg = aaSum > 0 ? ((negNumSum / aaSum) * 100).toFixed(1).replace('.', ',') : '-';
    const mPosPctAvg = aaSum > 0 ? ((mPosNumSum / aaSum) * 100).toFixed(1).replace('.', ',') : '-';
    const mNegPctAvg = aaSum > 0 ? ((mNegNumSum / aaSum) * 100).toFixed(1).replace('.', ',') : '-';

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

  // Export to Excel
  const handleExportExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      // Title & Subtitle
      const aoa: any[][] = [
        [`APROVEITAMENTO PEDAGÓGICO DO ${trimester}º TRIMESTRE`],
        [`Escola: ${selectedClass.school || 'EduGestão'} | Turma: ${selectedClass.level} ${selectedClass.section} | Ano Lectivo: ${selectedClass.academicYear || '-'}`],
        [],
        // Table 1 Header Row 1
        ['Disciplina', 'Professor', 'A.A.', 'Quantificação', '', '', '', '', 'Resultados', '', '', '', 'Meninas', '', '', ''],
        // Table 1 Header Row 2
        ['', '', '', 'NS', 'S', 'Bom', 'MB', 'E', 'Positivas', '', 'Negativas', '', 'Positivas', '', 'Negativas', ''],
        // Table 1 Header Row 3 (sub headers)
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
          row.positivasPct,
          row.negativasNum,
          row.negativasPct,
          row.meninasPosNum,
          row.meninasPosPct,
          row.meninasNegNum,
          row.meninasNegPct,
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
        table1Totals.posPct,
        table1Totals.negNum,
        table1Totals.negPct,
        table1Totals.mPosNum,
        table1Totals.mPosPct,
        table1Totals.mNegNum,
        table1Totals.mNegPct,
      ]);

      // Spacers
      aoa.push([]);
      aoa.push([]);

      // Table 2 Header Row 1
      aoa.push([
        'Situação Geral da Turma',
      ]);
      aoa.push([
        'Mapa 3/3', '', '',
        `Existentes no fim do ${trimester === '1' ? 'Início' : trimester === '2' ? '1º' : '2º'} Trimestre`, '', '',
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
        table2Data.positivasPct.h, table2Data.positivasPct.m, table2Data.positivasPct.hm,
        table2Data.negativasNum.h, table2Data.negativasNum.m, table2Data.negativasNum.hm,
        table2Data.negativasPct.h, table2Data.negativasPct.m, table2Data.negativasPct.hm,
      ]);

      const ws = XLSX.utils.aoa_to_sheet(aoa);

      // Auto col widths
      const colWidths = Array.from({ length: 30 }, (_, i) => ({
        wch: i === 0 ? 18 : i === 1 ? 22 : 8,
      }));
      ws['!cols'] = colWidths;

      XLSX.utils.book_append_sheet(wb, ws, `Aproveitamento ${trimester}º Trim`);
      XLSX.writeFile(
        wb,
        `Aproveitamento_Pedagogico_${selectedClass.level.replace(/\s+/g, '_')}_${selectedClass.section}_${trimester}Trimestre.xlsx`
      );
      toast.success('Ficheiro Excel exportado com sucesso!');
    } catch (e) {
      console.error(e);
      toast.error('Erro ao exportar para Excel.');
    }
  };

  return (
    <div className="space-y-6 pt-4 sm:pt-6 animate-in fade-in duration-300">
      {/* Top Header Card (Hidden on Print) */}
      <div className="bg-card rounded-2xl border border-border shadow-xs p-4 sm:p-5 no-print">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={onBack}
              className="h-9 px-3.5 border border-purple-200 dark:border-purple-900/40 bg-purple-50/20 dark:bg-purple-950/20 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded-xl shadow-2xs flex items-center gap-1.5 cursor-pointer transition-all shrink-0 text-xs sm:text-sm font-semibold"
              title="Voltar para a página de Cálculo da Média Geral"
            >
              <ChevronLeft className="h-4.5 w-4.5 shrink-0" />
              <span>Voltar</span>
            </Button>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  <span>Aproveitamento Pedagógico</span>
                </h2>
                <span className="bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  Mapa 3/3
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {selectedClass.level} {selectedClass.section} &bull; {selectedClass.school || 'EduGestão'} &bull; Director de Turma
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2">
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

            <Button
              variant="outline"
              onClick={handleResetToAuto}
              className="h-8.5 px-3 border border-purple-200 dark:border-purple-900/50 bg-purple-50/10 dark:bg-purple-950/10 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/30 text-xs font-semibold rounded-xl shadow-2xs flex items-center gap-1.5 cursor-pointer"
              title="Recalcular dados com base nas notas atuais dos alunos"
            >
              <RefreshCw className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline">Recalcular da Turma</span>
              <span className="sm:hidden">Sincronizar</span>
            </Button>

            <Button
              variant="outline"
              onClick={handleExportExcel}
              className="h-8.5 px-3 border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/10 dark:bg-emerald-950/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 text-xs font-semibold rounded-xl shadow-2xs flex items-center gap-1.5 cursor-pointer"
              title="Exportar pauta completa para ficheiro Excel"
            >
              <Download className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Exportar</span>
            </Button>

            <Button
              variant="outline"
              onClick={() => window.print()}
              className="h-8.5 px-3 border border-border/80 text-foreground hover:bg-muted text-xs font-semibold rounded-xl shadow-2xs flex items-center gap-1.5 cursor-pointer"
              title="Imprimir modelo oficial (A4 Paisagem)"
            >
              <Printer className="h-3.5 w-3.5 shrink-0" />
              <span>Imprimir</span>
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
      <div className="bg-card rounded-2xl border border-border shadow-xs p-4 sm:p-6 space-y-8 overflow-hidden print:border-0 print:p-0 print:bg-white print:text-black">
        {/* ============================================================ */}
        {/* TABELA 1: APROVEITAMENTO PEDAGÓGICO DO _____ TRIMESTRE       */}
        {/* ============================================================ */}
        <div className="space-y-3">
          <div className="text-center">
            <h3 className="text-base sm:text-xl font-black uppercase tracking-wider text-foreground print:text-black font-sans">
              APROVEITAMENTO PEDAGÓGICO DO {trimester}º TRIMESTRE
            </h3>
            <p className="text-xs text-muted-foreground print:text-gray-600 mt-0.5">
              Turma: {selectedClass.level} {selectedClass.section} &bull; Escola: {selectedClass.school || 'EduGestão'} &bull; Ano Lectivo: {selectedClass.academicYear || '-'}
            </p>
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
                    title="Alunos Avaliados"
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
                    <td className="border-r border-zinc-300 dark:border-zinc-700 p-1 font-bold">
                      <input
                        type="text"
                        value={row.aa}
                        onChange={(e) => handleTable1Change(idx, 'aa', e.target.value)}
                        placeholder="-"
                        className="w-full text-center bg-transparent border-0 focus:outline-none font-bold text-foreground text-xs print:text-[9px]"
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
                    <td className="border-r border-zinc-300 dark:border-zinc-700 p-1 font-bold text-blue-600 dark:text-blue-400 print:text-black">
                      <input
                        type="text"
                        value={row.positivasNum}
                        onChange={(e) => handleTable1Change(idx, 'positivasNum', e.target.value)}
                        placeholder="-"
                        className="w-full text-center bg-transparent border-0 focus:outline-none font-bold text-xs print:text-[9px]"
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
                      />
                    </td>

                    {/* Negativas Nº */}
                    <td className="border-r border-zinc-300 dark:border-zinc-700 p-1 font-bold text-red-600 dark:text-red-400 print:text-black">
                      <input
                        type="text"
                        value={row.negativasNum}
                        onChange={(e) => handleTable1Change(idx, 'negativasNum', e.target.value)}
                        placeholder="-"
                        className="w-full text-center bg-transparent border-0 focus:outline-none font-bold text-xs print:text-[9px]"
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
                      />
                    </td>
                  </tr>
                ))}

                {/* Total Row */}
                <tr className="bg-zinc-200/80 dark:bg-zinc-800/80 font-black border-t-2 border-zinc-400 dark:border-zinc-700 print:bg-gray-200 print:text-black print:border-black text-xs print:text-[9px]">
                  <td className="border-r border-zinc-400 dark:border-zinc-700 p-2 text-left font-black">TOTAL</td>
                  <td className="border-r border-zinc-400 dark:border-zinc-700 p-2">-</td>
                  <td className="border-r border-zinc-400 dark:border-zinc-700 p-2 text-center font-black">{table1Totals.aa}</td>
                  <td className="border-r border-zinc-400 dark:border-zinc-700 p-2 text-center">{table1Totals.ns}</td>
                  <td className="border-r border-zinc-400 dark:border-zinc-700 p-2 text-center">{table1Totals.s}</td>
                  <td className="border-r border-zinc-400 dark:border-zinc-700 p-2 text-center">{table1Totals.bom}</td>
                  <td className="border-r border-zinc-400 dark:border-zinc-700 p-2 text-center">{table1Totals.mb}</td>
                  <td className="border-r border-zinc-400 dark:border-zinc-700 p-2 text-center">{table1Totals.e}</td>
                  <td className="border-r border-zinc-400 dark:border-zinc-700 p-2 text-center text-blue-700 dark:text-blue-300 font-black print:text-black">{table1Totals.posNum}</td>
                  <td className="border-r border-zinc-400 dark:border-zinc-700 p-2 text-center">{table1Totals.posPct}</td>
                  <td className="border-r border-zinc-400 dark:border-zinc-700 p-2 text-center text-red-700 dark:text-red-300 font-black print:text-black">{table1Totals.negNum}</td>
                  <td className="border-r border-zinc-400 dark:border-zinc-700 p-2 text-center">{table1Totals.negPct}</td>
                  <td className="border-r border-zinc-400 dark:border-zinc-700 p-2 text-center font-black">{table1Totals.mPosNum}</td>
                  <td className="border-r border-zinc-400 dark:border-zinc-700 p-2 text-center">{table1Totals.mPosPct}</td>
                  <td className="border-r border-zinc-400 dark:border-zinc-700 p-2 text-center font-black">{table1Totals.mNegNum}</td>
                  <td className="p-2 text-center">{table1Totals.mNegPct}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ============================================================ */}
        {/* TABELA 2: Situação Geral da Turma (Exatamente como na foto)  */}
        {/* ============================================================ */}
        <div className="space-y-3 pt-4">
          <div className="text-center">
            <h3 className="text-base sm:text-xl font-black tracking-wider text-foreground print:text-black font-sans">
              Situação Geral da Turma
            </h3>
          </div>

          <div className="overflow-x-auto custom-desktop-scrollbar border border-zinc-400 dark:border-zinc-700 rounded-lg print:border-black">
            <table className="w-full border-collapse text-center text-xs print:text-[8px]">
              {/* Header Row 1: 10 main columns matching the photo */}
              <thead>
                <tr className="bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-extrabold border-b border-zinc-400 dark:border-zinc-700 print:bg-gray-200 print:text-black print:border-black">
                  <th colSpan={3} className="border-r border-zinc-400 dark:border-zinc-700 p-2 min-w-[75px]">
                    Mapa 3/3
                  </th>
                  <th colSpan={3} className="border-r border-zinc-400 dark:border-zinc-700 p-2 min-w-[120px]">
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
                      <th className="border-r border-zinc-300 dark:border-zinc-700 p-1 w-9 print:border-black">H</th>
                      <th className="border-r border-zinc-300 dark:border-zinc-700 p-1 w-9 print:border-black">M</th>
                      <th className={`p-1 w-10 ${i < 9 ? 'border-r border-zinc-400 dark:border-zinc-700 print:border-black' : ''}`}>HM</th>
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

                  {/* 4. Total */}
                  <td className="border-r border-zinc-300 dark:border-zinc-700 p-1">
                    <input
                      type="text"
                      value={table2Data.total.h}
                      onChange={(e) => handleTable2Change('total', 'h', e.target.value)}
                      className="w-full text-center bg-transparent border-0 focus:outline-none text-xs print:text-[8px]"
                    />
                  </td>
                  <td className="border-r border-zinc-300 dark:border-zinc-700 p-1">
                    <input
                      type="text"
                      value={table2Data.total.m}
                      onChange={(e) => handleTable2Change('total', 'm', e.target.value)}
                      className="w-full text-center bg-transparent border-0 focus:outline-none text-xs print:text-[8px]"
                    />
                  </td>
                  <td className="border-r border-zinc-400 dark:border-zinc-700 p-1 font-bold bg-muted/20">
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

                  {/* 6. Existentes no Fim */}
                  <td className="border-r border-zinc-300 dark:border-zinc-700 p-1">
                    <input
                      type="text"
                      value={table2Data.existentesFim2.h}
                      onChange={(e) => handleTable2Change('existentesFim2', 'h', e.target.value)}
                      className="w-full text-center bg-transparent border-0 focus:outline-none text-xs print:text-[8px]"
                    />
                  </td>
                  <td className="border-r border-zinc-300 dark:border-zinc-700 p-1">
                    <input
                      type="text"
                      value={table2Data.existentesFim2.m}
                      onChange={(e) => handleTable2Change('existentesFim2', 'm', e.target.value)}
                      className="w-full text-center bg-transparent border-0 focus:outline-none text-xs print:text-[8px]"
                    />
                  </td>
                  <td className="border-r border-zinc-400 dark:border-zinc-700 p-1 font-bold bg-muted/20">
                    <input
                      type="text"
                      value={table2Data.existentesFim2.hm}
                      onChange={(e) => handleTable2Change('existentesFim2', 'hm', e.target.value)}
                      className="w-full text-center bg-transparent border-0 focus:outline-none font-bold text-xs print:text-[8px]"
                    />
                  </td>

                  {/* 7. Situação Positiva (Número) */}
                  <td className="border-r border-zinc-300 dark:border-zinc-700 p-1 text-blue-600 dark:text-blue-400 font-bold print:text-black">
                    <input
                      type="text"
                      value={table2Data.positivasNum.h}
                      onChange={(e) => handleTable2Change('positivasNum', 'h', e.target.value)}
                      className="w-full text-center bg-transparent border-0 focus:outline-none font-bold text-xs print:text-[8px]"
                    />
                  </td>
                  <td className="border-r border-zinc-300 dark:border-zinc-700 p-1 text-blue-600 dark:text-blue-400 font-bold print:text-black">
                    <input
                      type="text"
                      value={table2Data.positivasNum.m}
                      onChange={(e) => handleTable2Change('positivasNum', 'm', e.target.value)}
                      className="w-full text-center bg-transparent border-0 focus:outline-none font-bold text-xs print:text-[8px]"
                    />
                  </td>
                  <td className="border-r border-zinc-400 dark:border-zinc-700 p-1 font-black text-blue-700 dark:text-blue-300 bg-muted/20 print:text-black">
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
                    />
                  </td>
                  <td className="border-r border-zinc-300 dark:border-zinc-700 p-1 text-muted-foreground print:text-black">
                    <input
                      type="text"
                      value={table2Data.positivasPct.m}
                      onChange={(e) => handleTable2Change('positivasPct', 'm', e.target.value)}
                      className="w-full text-center bg-transparent border-0 focus:outline-none text-xs print:text-[8px]"
                    />
                  </td>
                  <td className="border-r border-zinc-400 dark:border-zinc-700 p-1 font-bold text-foreground bg-muted/20 print:text-black">
                    <input
                      type="text"
                      value={table2Data.positivasPct.hm}
                      onChange={(e) => handleTable2Change('positivasPct', 'hm', e.target.value)}
                      className="w-full text-center bg-transparent border-0 focus:outline-none font-bold text-xs print:text-[8px]"
                    />
                  </td>

                  {/* 9. Situação Negativa (Número) */}
                  <td className="border-r border-zinc-300 dark:border-zinc-700 p-1 text-red-600 dark:text-red-400 font-bold print:text-black">
                    <input
                      type="text"
                      value={table2Data.negativasNum.h}
                      onChange={(e) => handleTable2Change('negativasNum', 'h', e.target.value)}
                      className="w-full text-center bg-transparent border-0 focus:outline-none font-bold text-xs print:text-[8px]"
                    />
                  </td>
                  <td className="border-r border-zinc-300 dark:border-zinc-700 p-1 text-red-600 dark:text-red-400 font-bold print:text-black">
                    <input
                      type="text"
                      value={table2Data.negativasNum.m}
                      onChange={(e) => handleTable2Change('negativasNum', 'm', e.target.value)}
                      className="w-full text-center bg-transparent border-0 focus:outline-none font-bold text-xs print:text-[8px]"
                    />
                  </td>
                  <td className="border-r border-zinc-400 dark:border-zinc-700 p-1 font-black text-red-700 dark:text-red-300 bg-muted/20 print:text-black">
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
                    />
                  </td>
                  <td className="border-r border-zinc-300 dark:border-zinc-700 p-1 text-muted-foreground print:text-black">
                    <input
                      type="text"
                      value={table2Data.negativasPct.m}
                      onChange={(e) => handleTable2Change('negativasPct', 'm', e.target.value)}
                      className="w-full text-center bg-transparent border-0 focus:outline-none text-xs print:text-[8px]"
                    />
                  </td>
                  <td className="p-1 font-bold text-foreground bg-muted/20 print:text-black">
                    <input
                      type="text"
                      value={table2Data.negativasPct.hm}
                      onChange={(e) => handleTable2Change('negativasPct', 'hm', e.target.value)}
                      className="w-full text-center bg-transparent border-0 focus:outline-none font-bold text-xs print:text-[8px]"
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
