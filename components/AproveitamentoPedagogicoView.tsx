import React, { useState, useEffect, useMemo } from 'react';
import {
  ChevronLeft,
  BarChart3,
  RefreshCw,
  Save,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import type { ClassData, Student } from '@/src/App';
import {
  calculateMediaGeralForStudent,
  isStudentFemale,
  getStudentSubjectGrades,
  MEDIA_GERAL_SUBJECTS,
} from '@/src/App';

export const APROVEITAMENTO_DISCIPLINAS = [
  { id: 'portugues', name: 'Português', key: 'P', aliases: ['portugues', 'português', 'lp', 'lingua portuguesa', 'língua portuguesa', 'lingua_portuguesa', 'p', 'P'] },
  { id: 'ingles', name: 'Inglês', key: 'I', aliases: ['ingles', 'inglês', 'ing', 'lingua inglesa', 'língua inglesa', 'lingua_inglesa', 'i', 'I', 'english'] },
  { id: 'historia', name: 'História', key: 'H', aliases: ['historia', 'história', 'hist', 'h', 'H'] },
  { id: 'geografia', name: 'Geografia', key: 'G', aliases: ['geografia', 'geo', 'g', 'G'] },
  { id: 'filosofia', name: 'Filosofia', key: 'FIL', aliases: ['filosofia', 'fil', 'FIL'] },
  { id: 'matematica', name: 'Matemática', key: 'M', aliases: ['matematica', 'matemática', 'mat', 'm', 'M'] },
  { id: 'fisica', name: 'Física', key: 'F', aliases: ['fisica', 'física', 'fis', 'f', 'F'] },
  { id: 'quimica', name: 'Química', key: 'Q', aliases: ['quimica', 'química', 'qui', 'q', 'Q'] },
  { id: 'biologia', name: 'Biologia', key: 'B', aliases: ['biologia', 'bio', 'b', 'B'] },
  { id: 'ed_visual', name: 'Ed. Visual', key: 'EdV', aliases: ['ed_visual', 'ev', 'desenho', 'EdV', 'edv', 'Ed. V', 'ed. v', 'ed v', 'educacao visual', 'educação visual'] },
  { id: 'frances', name: 'Francês', key: 'FR', aliases: ['frances', 'francês', 'fr', 'FR'] },
  { id: 'edmc', name: 'Ed. MC / NE', key: 'EdMC', aliases: ['edmc', 'EdMC', 'ne', 'NE', 'ed_moral', 'empreendedorismo', 'Ed. MC', 'ed. mc', 'ed mc', 'moral', 'educacao moral e civica', 'educação moral e cívica'] },
  { id: 'ap', name: 'Agropecuária', key: 'AP', aliases: ['ap', 'AP', 'agropecuaria', 'agropecuária', 'agro_pecuaria'] },
  { id: 'tics', name: 'TICs / DGD', key: 'TICs', aliases: ['tics', 'TICs', 'dgd', 'DGD', 'tic', 'TIC', 'desenho_geometria', 'tecnologias', 'tecnologias de informacao e comunicacao', 'tecnologias de informação e comunicação'] },
  { id: 'ed_fisica', name: 'Ed. Física', key: 'EdF', aliases: ['ed_fisica', 'ef', 'educacao_fisica', 'educação física', 'EdF', 'edf', 'Ed. F', 'ed. f', 'ed f', 'educacao fisica'] },
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

/**
 * Verifica se a disciplina consta oficialmente na Pauta da Turma (MEDIA_GERAL_SUBJECTS).
 * Disciplinas que não constam na pauta (como Filosofia e Francês no 1º ciclo)
 * devem permanecer estritamente vazias na tabela de aproveitamento pedagógico.
 */
const normStr = (s: string): string =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();

/**
 * Mapeia uma disciplina de APROVEITAMENTO_DISCIPLINAS para a sua coluna correspondente
 * na Pauta da Turma (MEDIA_GERAL_SUBJECTS).
 * Disciplinas que não constam na Pauta da Turma (como Filosofia e Francês no 1º ciclo) retornam null.
 */
export const getPautaSubjectForDisciplina = (
  disc: { id: string; name?: string; key?: string; aliases?: readonly string[] } | string
): { key: string; label: string; name: string } | null => {
  if (!disc) return null;
  const id = typeof disc === 'string' ? disc : disc.id;
  const key = typeof disc === 'string' ? disc : (disc.key || disc.id);
  const name = typeof disc === 'string' ? disc : (disc.name || disc.id);
  const aliases = typeof disc === 'string' ? [] : (disc.aliases || []);

  const idNorm = normStr(id);
  const keyNorm = normStr(key);
  const nameNorm = normStr(name);
  const aliasesNorm = aliases.map(normStr);

  // Exclusões explícitas: Filosofia e Francês não constam na Pauta da Turma do 1º Ciclo
  if (idNorm === 'filosofia' || keyNorm === 'fil' || nameNorm.includes('filosofia')) return null;
  if (idNorm === 'frances' || keyNorm === 'fr' || nameNorm.includes('frances')) return null;

  for (const sub of MEDIA_GERAL_SUBJECTS) {
    const sKeyNorm = normStr(sub.key);
    const sNameNorm = normStr(sub.name);
    const sLabelNorm = normStr(sub.label);

    if (
      sKeyNorm === keyNorm ||
      sKeyNorm === idNorm ||
      sNameNorm === nameNorm ||
      sLabelNorm === keyNorm ||
      sLabelNorm === nameNorm ||
      sLabelNorm === idNorm ||
      aliasesNorm.includes(sKeyNorm) ||
      aliasesNorm.includes(sLabelNorm) ||
      aliasesNorm.includes(sNameNorm)
    ) {
      return sub as any;
    }
  }

  // Tenta encontrar em APROVEITAMENTO_DISCIPLINAS por id ou nome para resolver aliases
  const foundDisc = APROVEITAMENTO_DISCIPLINAS.find(
    (d) => normStr(d.id) === idNorm || normStr(d.name) === nameNorm || normStr(d.key) === keyNorm
  );
  if (foundDisc && foundDisc !== disc) {
    return getPautaSubjectForDisciplina(foundDisc);
  }

  return null;
};

/**
 * Verifica se a disciplina consta oficialmente na Pauta da Turma (MEDIA_GERAL_SUBJECTS).
 */
export const isSubjectInPauta = (
  disc: { id: string; name?: string; key?: string; aliases?: readonly string[] } | string
): boolean => {
  return getPautaSubjectForDisciplina(disc) !== null;
};

/**
 * Cria uma linha padrão com traço '-' para disciplinas que não constam na Pauta da Turma
 * ou para disciplinas que ainda não possuem dados lançados na Pauta da Turma.
 * Nenhuma disciplina fica bloqueada: o utilizador pode editar livremente qualquer campo.
 */
export const createEmptyTable1Row = (id: string, disciplina: string): Table1RowData => ({
  id,
  disciplina,
  professor: '-',
  aa: '-',
  ns: '-',
  s: '-',
  bom: '-',
  mb: '-',
  e: '-',
  positivasNum: '-',
  positivasPct: '-',
  negativasNum: '-',
  negativasPct: '-',
  meninasPosNum: '-',
  meninasPosPct: '-',
  meninasNegNum: '-',
  meninasNegPct: '-',
});

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
export const parseVal = (val: string | number | undefined | null): number => {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const cleaned = String(val).trim().replace(',', '.');
  if (cleaned === '' || cleaned === '-') return 0;
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
};

// Helper: format percent with 1 decimal and comma
export const formatPct = (num: number, total: number): string => {
  if (total <= 0) return '0,0';
  const pct = (num / total) * 100;
  return pct.toFixed(1).replace('.', ',');
};

// Helper: Get student grade for a specific subject from Pauta da Turma with case-insensitive and alias fallbacks
export const getGradeForStudentAndSubject = (
  student: Student,
  t: '1' | '2' | '3',
  disc: { id: string; name: string; key: string; aliases?: readonly string[] } | string,
  selectedClassSubject?: string
): string => {
  const pautaSub = getPautaSubjectForDisciplina(disc);
  // Se a disciplina NÃO consta na Pauta da Turma (ex: Filosofia, Francês), não tem notas na pauta
  if (!pautaSub) {
    return '';
  }

  const subGrades = getStudentSubjectGrades(student, t);
  if (!subGrades) return '';

  // 1. Direct match com a chave oficial da Pauta da Turma (ex: 'EdV', 'EdF', 'P', 'M', etc.)
  if (subGrades[pautaSub.key] !== undefined && subGrades[pautaSub.key] !== null) {
    const vStr = String(subGrades[pautaSub.key]).trim();
    if (vStr !== '' && vStr !== '-') return vStr;
  }

  // 2. Case-insensitive key match na Pauta
  const targetKeyLower = pautaSub.key.toLowerCase().trim();
  for (const [k, v] of Object.entries(subGrades)) {
    if (v !== undefined && v !== null) {
      const vStr = String(v).trim();
      if (vStr !== '' && vStr !== '-' && k.toLowerCase().trim() === targetKeyLower) {
        return vStr;
      }
    }
  }

  // 3. Match contra disc.id, disc.key ou aliases se disc for object
  if (typeof disc === 'object') {
    const idLower = disc.id.toLowerCase().trim();
    const keyLower = disc.key.toLowerCase().trim();
    for (const [k, v] of Object.entries(subGrades)) {
      if (v !== undefined && v !== null) {
        const vStr = String(v).trim();
        const kLower = k.toLowerCase().trim();
        if (vStr !== '' && vStr !== '-' && (kLower === idLower || kLower === keyLower)) {
          return vStr;
        }
        if (disc.aliases && disc.aliases.some((a) => a.toLowerCase().trim() === kLower)) {
          if (vStr !== '' && vStr !== '-') return vStr;
        }
      }
    }
  }

  // 4. Fallback: se o professor logado leciona esta disciplina na turma
  if (selectedClassSubject) {
    const normSub = normStr(selectedClassSubject);
    const matchesCurrent =
      normSub === normStr(pautaSub.name) ||
      normSub === normStr(pautaSub.label) ||
      normSub === normStr(pautaSub.key) ||
      (typeof disc === 'object' && (
        normSub === normStr(disc.name) ||
        normSub === normStr(disc.id) ||
        (disc.aliases && disc.aliases.some((a) => normSub.includes(normStr(a))))
      ));

    if (matchesCurrent) {
      const gradesObj = student.trimesterGrades?.[t] || (t === '1' ? student.grades : undefined);
      if (gradesObj) {
        const acsList = [gradesObj.acs1, gradesObj.acs2, gradesObj.acs3]
          .map((x) => parseFloat((x || '').replace(',', '.')))
          .filter((x) => !isNaN(x));
        const apVal = parseFloat((gradesObj.ap || '').replace(',', '.'));
        if (acsList.length > 0 && !isNaN(apVal)) {
          const rawAcs = acsList.reduce((a, b) => a + b, 0) / acsList.length;
          const acsAvg = Math.round(rawAcs);
          const avg = Math.round((acsAvg + apVal) / 2);
          return String(avg);
        }
        const single = (gradesObj.ap || gradesObj.acs3 || gradesObj.acs2 || gradesObj.acs1 || '').trim();
        if (single !== '' && single !== '-') return single;
      }
    }
  }

  return '';
};

export type GradeCategory = 'NS' | 'S' | 'Bom' | 'MB' | 'E';

/**
 * Classifies a grade according to the rigorous Mozambican scale:
 * NS: 0 a 9 valores
 * S: 10 a 13 valores
 * Bom: 14 a 16 valores
 * MB: 17 a 18 valores
 * E: 19 a 20 valores
 */
export const classifyGrade = (valStr: string): GradeCategory | null => {
  if (!valStr || valStr.trim() === '' || valStr.trim() === '-') return null;
  const num = parseFloat(valStr.replace(',', '.'));
  if (isNaN(num)) return null;

  const rounded = Math.round(num);

  if (rounded >= 0 && rounded <= 9) return 'NS'; // 0 a 9 valores: Não Suficiente
  if (rounded >= 10 && rounded <= 13) return 'S'; // 10 a 13 valores: Suficiente
  if (rounded >= 14 && rounded <= 16) return 'Bom'; // 14 a 16 valores: Bom
  if (rounded >= 17 && rounded <= 18) return 'MB'; // 17 a 18 valores: Muito Bom
  if (rounded >= 19 && rounded <= 20) return 'E'; // 19 a 20 valores: Excelente

  if (rounded < 0) return 'NS';
  if (rounded > 20) return 'E';

  return null;
};

// Strict Table 1 Rules Engine
export const applyStrictRulesTable1Row = (row: Table1RowData): Table1RowData => {
  const ns = parseVal(row.ns);
  const s = parseVal(row.s);
  const bom = parseVal(row.bom);
  const mb = parseVal(row.mb);
  const e = parseVal(row.e);

  // Verifica se o utilizador introduziu números válidos em alguma célula de quantificação
  const hasQuant =
    (row.ns !== '' && row.ns !== '-' && ns > 0) ||
    (row.s !== '' && row.s !== '-' && s > 0) ||
    (row.bom !== '' && row.bom !== '-' && bom > 0) ||
    (row.mb !== '' && row.mb !== '-' && mb > 0) ||
    (row.e !== '' && row.e !== '-' && e > 0);

  // Se a linha não tem números lançados e está marcada com traço, mantém os traços
  if (!hasQuant && (row.aa === '-' || row.aa === '')) {
    const dashIfEmpty = (v: string) => (v === '' ? '-' : v);
    return {
      ...row,
      professor: row.professor || '-',
      aa: dashIfEmpty(row.aa),
      ns: dashIfEmpty(row.ns),
      s: dashIfEmpty(row.s),
      bom: dashIfEmpty(row.bom),
      mb: dashIfEmpty(row.mb),
      e: dashIfEmpty(row.e),
      positivasNum: dashIfEmpty(row.positivasNum),
      positivasPct: dashIfEmpty(row.positivasPct),
      negativasNum: dashIfEmpty(row.negativasNum),
      negativasPct: dashIfEmpty(row.negativasPct),
      meninasPosNum: dashIfEmpty(row.meninasPosNum),
      meninasPosPct: dashIfEmpty(row.meninasPosPct),
      meninasNegNum: dashIfEmpty(row.meninasNegNum),
      meninasNegPct: dashIfEmpty(row.meninasNegPct),
    };
  }

  // Regra 1: A.A. refere aos alunos avaliados = NS + S + Bom + MB + E
  const aa = hasQuant ? ns + s + bom + mb + e : parseVal(row.aa);

  // Regra 2: Resultados obtidos estritamente a partir das colunas de Quantificação
  // Positivas = S + Bom + MB + E
  const posNum = s + bom + mb + e;
  // Negativas = NS
  const negNum = ns;

  // Percentagens sobre A.A.
  const posPct = aa > 0 ? formatPct(posNum, aa) : '-';
  const negPct = aa > 0 ? formatPct(negNum, aa) : '-';

  // Regra 3: Meninas (observando as colunas de Quantificação)
  let mPos = parseVal(row.meninasPosNum);
  let mNeg = parseVal(row.meninasNegNum);

  // Clamping de integridade: Meninas não podem exceder o total da respectiva situação
  if (posNum > 0 && mPos > posNum) mPos = posNum;
  if (negNum > 0 && mNeg > negNum) mNeg = negNum;
  const mAA = mPos + mNeg;
  const mPosPct = mAA > 0 ? formatPct(mPos, mAA) : '-';
  const mNegPct = mAA > 0 ? formatPct(mNeg, mAA) : '-';

  return {
    ...row,
    aa: aa > 0 ? String(aa) : (hasQuant ? '0' : '-'),
    ns: ns > 0 ? String(ns) : (row.ns === '0' ? '0' : (hasQuant ? '0' : '-')),
    s: s > 0 ? String(s) : (row.s === '0' ? '0' : (hasQuant ? '0' : '-')),
    bom: bom > 0 ? String(bom) : (row.bom === '0' ? '0' : (hasQuant ? '0' : '-')),
    mb: mb > 0 ? String(mb) : (row.mb === '0' ? '0' : (hasQuant ? '0' : '-')),
    e: e > 0 ? String(e) : (row.e === '0' ? '0' : (hasQuant ? '0' : '-')),
    positivasNum: posNum > 0 ? String(posNum) : (hasQuant ? '0' : '-'),
    positivasPct: aa > 0 ? posPct : '-',
    negativasNum: negNum > 0 ? String(negNum) : (hasQuant ? '0' : '-'),
    negativasPct: aa > 0 ? negPct : '-',
    meninasPosNum: mPos > 0 ? String(mPos) : (row.meninasPosNum === '0' ? '0' : (hasQuant ? '0' : '-')),
    meninasPosPct: mAA > 0 ? mPosPct : '-',
    meninasNegNum: mNeg > 0 ? String(mNeg) : (row.meninasNegNum === '0' ? '0' : (hasQuant ? '0' : '-')),
    meninasNegPct: mAA > 0 ? mNegPct : '-',
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
  const hPos = Math.min(hExist2, parseVal(result.positivasNum.h));
  const mPos = Math.min(mExist2, parseVal(result.positivasNum.m));
  result.positivasNum.h = String(hPos);
  result.positivasNum.m = String(mPos);
  result.positivasNum.hm = String(hPos + mPos);

  // Rule 2.6: Negativas = Existentes no Fim - Positivas
  const hNeg = Math.max(0, hExist2 - hPos);
  const mNeg = Math.max(0, mExist2 - mPos);
  result.negativasNum.h = String(hNeg);
  result.negativasNum.m = String(mNeg);
  result.negativasNum.hm = String(hNeg + mNeg);

  // Rule 2.7: Percentagens sobre Existentes no Fim (fecham em 100%)
  result.positivasPct.h = hExist2 > 0 ? formatPct(hPos, hExist2) : '0,0';
  result.positivasPct.m = mExist2 > 0 ? formatPct(mPos, mExist2) : '0,0';
  result.positivasPct.hm = (hExist2 + mExist2) > 0 ? formatPct(hPos + mPos, hExist2 + mExist2) : '0,0';

  result.negativasPct.h = hExist2 > 0 ? formatPct(hNeg, hExist2) : '0,0';
  result.negativasPct.m = mExist2 > 0 ? formatPct(mNeg, mExist2) : '0,0';
  result.negativasPct.hm = (hExist2 + mExist2) > 0 ? formatPct(hNeg + mNeg, hExist2 + mExist2) : '0,0';

  return result;
};

// Derive Table 2 from Table 1 totals when Table 1 is manually edited
export const deriveTable2FromTable1 = (t1: Table1RowData[], currentT2: Table2Data): Table2Data => {
  let posNumSum = 0;
  let negNumSum = 0;
  let mPosNumSum = 0;
  let mNegNumSum = 0;

  t1.forEach((row) => {
    posNumSum += parseVal(row.positivasNum);
    negNumSum += parseVal(row.negativasNum);
    mPosNumSum += parseVal(row.meninasPosNum);
    mNegNumSum += parseVal(row.meninasNegNum);
  });

  const totalAAT1 = posNumSum + negNumSum;
  const totalMAAT1 = mPosNumSum + mNegNumSum;
  const hPosNumSum = Math.max(0, posNumSum - mPosNumSum);
  const hNegNumSum = Math.max(0, negNumSum - mNegNumSum);
  const totalHAAT1 = hPosNumSum + hNegNumSum;

  const result: Table2Data = JSON.parse(JSON.stringify(currentT2));
  const hExist2 = parseVal(result.existentesFim2.h);
  const mExist2 = parseVal(result.existentesFim2.m);

  if (totalAAT1 > 0) {
    const mRate = totalMAAT1 > 0 ? mPosNumSum / totalMAAT1 : 0;
    const hRate = totalHAAT1 > 0 ? hPosNumSum / totalHAAT1 : 0;

    const posH = Math.min(hExist2, Math.round(hExist2 * hRate));
    const posM = Math.min(mExist2, Math.round(mExist2 * mRate));

    result.positivasNum.h = String(posH);
    result.positivasNum.m = String(posM);
    result.positivasNum.hm = String(posH + posM);

    return applyStrictRulesTable2(result);
  }

  return applyStrictRulesTable2(result);
};

// Compute pedagogical balance and general situation dynamically from class data
export const computeAproveitamentoFromClass = (
  selectedClass: ClassData,
  t: '1' | '2' | '3',
  teacherDisplayName?: string
): { t1: Table1RowData[]; t2: Table2Data } => {
  // 1. Compute Table 1 (Aproveitamento Pedagógico obtido através da verificação cuidadosa da Pauta da Turma)
  const computedT1: Table1RowData[] = APROVEITAMENTO_DISCIPLINAS.map((disc) => {
    const pautaSub = getPautaSubjectForDisciplina(disc);
    // Se a disciplina NÃO consta na Pauta da Turma (ex: Filosofia, Francês no 1º ciclo),
    // deve conter simplesmente um traço '-', conforme solicitado:
    if (!pautaSub) {
      return createEmptyTable1Row(disc.id, disc.name);
    }

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
      const valStr = getGradeForStudentAndSubject(student, t, disc, selectedClass.subject);
      const cat = classifyGrade(valStr);
      if (cat !== null) {
        aa++;
        const isFemale = isStudentFemale(student);
        if (isFemale) meninasAA++;
        switch (cat) {
          case 'NS':
            ns++;
            if (isFemale) meninasNeg++;
            break;
          case 'S':
            s++;
            if (isFemale) meninasPos++;
            break;
          case 'Bom':
            bom++;
            if (isFemale) meninasPos++;
            break;
          case 'MB':
            mb++;
            if (isFemale) meninasPos++;
            break;
          case 'E':
            e++;
            if (isFemale) meninasPos++;
            break;
        }
      }
    });

    // Default teacher name if class subject matches
    const isCurrentSubject =
      selectedClass.subject.trim().toLowerCase() === disc.name.trim().toLowerCase() ||
      (disc.aliases && disc.aliases.some(a => selectedClass.subject.trim().toLowerCase().includes(a.toLowerCase())));
    const defaultTeacher = isCurrentSubject ? (teacherDisplayName || (selectedClass as any).teacherName || '') : '';

    // Se na Pauta da Turma não constam dados para esta disciplina (aa === 0),
    // coloca-se simplesmente um traço '-' em todas as células numéricas
    if (aa === 0) {
      return {
        id: disc.id,
        disciplina: disc.name,
        professor: defaultTeacher || '-',
        aa: '-',
        ns: '-',
        s: '-',
        bom: '-',
        mb: '-',
        e: '-',
        positivasNum: '-',
        positivasPct: '-',
        negativasNum: '-',
        negativasPct: '-',
        meninasPosNum: '-',
        meninasPosPct: '-',
        meninasNegNum: '-',
        meninasNegPct: '-',
      };
    }

    // Resultados observando estritamente as colunas de Quantificação:
    // Positivas = S + Bom + MB + E
    const posNum = s + bom + mb + e;
    // Negativas = NS
    const negNum = ns;

    // Percentagens sobre A.A.
    const posPct = formatPct(posNum, aa);
    const negPct = formatPct(negNum, aa);

    // Meninas observando a Quantificação
    const mPosPct = meninasAA > 0 ? formatPct(meninasPos, meninasAA) : '-';
    const mNegPct = meninasAA > 0 ? formatPct(meninasNeg, meninasAA) : '-';

    return {
      id: disc.id,
      disciplina: disc.name,
      professor: defaultTeacher || '-',
      aa: String(aa),
      ns: String(ns),
      s: String(s),
      bom: String(bom),
      mb: String(mb),
      e: String(e),
      positivasNum: String(posNum),
      positivasPct: posPct,
      negativasNum: String(negNum),
      negativasPct: negPct,
      meninasPosNum: meninasAA > 0 ? String(meninasPos) : '0',
      meninasPosPct: mPosPct,
      meninasNegNum: meninasAA > 0 ? String(meninasNeg) : '0',
      meninasNegPct: mNegPct,
    };
  });

  // 2. Compute Table 2 (Situação Geral da Turma - Observando rigorosamente os dados da Pauta e da Tabela 1)
  let totalH = 0;
  let totalM = 0;
  selectedClass.students.forEach((student) => {
    if (isStudentFemale(student)) totalM++;
    else totalH++;
  });
  const totalHM = totalH + totalM;

  let posH = 0;
  let posM = 0;

  // Analisa cada aluno através da Pauta da Turma (Média Geral da Pauta):
  selectedClass.students.forEach((student) => {
    // 1. Tentar primeiro o cálculo oficial de Média Geral da Pauta (calculateMediaGeralForStudent)
    const mg = calculateMediaGeralForStudent(student, t);
    if (mg.hasAnyGrade && mg.rounded !== '-') {
      const num = parseFloat(mg.rounded);
      if (!isNaN(num) && num >= 10) {
        if (isStudentFemale(student)) posM++;
        else posH++;
      }
    } else {
      // 2. Fallback: média de todas as disciplinas avaliadas
      let studentSum = 0;
      let studentCount = 0;
      APROVEITAMENTO_DISCIPLINAS.forEach((disc) => {
        if (!isSubjectInPauta(disc)) return;
        const valStr = getGradeForStudentAndSubject(student, t, disc, selectedClass.subject);
        const cat = classifyGrade(valStr);
        if (cat !== null) {
          const num = parseFloat(valStr.replace(',', '.'));
          if (!isNaN(num)) {
            studentSum += num;
            studentCount++;
          }
        }
      });
      if (studentCount > 0) {
        const studentAvg = studentSum / studentCount;
        const roundedAvg = Math.round(studentAvg);
        if (roundedAvg >= 10) {
          if (isStudentFemale(student)) posM++;
          else posH++;
        }
      }
    }
  });

  const hExist2 = totalH;
  const mExist2 = totalM;
  const posHM = posH + posM;

  // Regra Estrita: Negativas = Existentes no Fim - Positivas
  const negH = Math.max(0, hExist2 - posH);
  const negM = Math.max(0, mExist2 - posM);
  const negHM = negH + negM;

  const posPctH = hExist2 > 0 ? formatPct(posH, hExist2) : '0,0';
  const posPctM = mExist2 > 0 ? formatPct(posM, mExist2) : '0,0';
  const posPctHM = totalHM > 0 ? formatPct(posHM, totalHM) : '0,0';

  const negPctH = hExist2 > 0 ? formatPct(negH, hExist2) : '0,0';
  const negPctM = mExist2 > 0 ? formatPct(negM, mExist2) : '0,0';
  const negPctHM = totalHM > 0 ? formatPct(negHM, totalHM) : '0,0';

  const computedT2: Table2Data = {
    mapa33: { h: String(totalH), m: String(totalM), hm: String(totalHM) },
    existentesFim1: { h: String(totalH), m: String(totalM), hm: String(totalHM) },
    entraram2: { h: '0', m: '0', hm: '0' },
    total: { h: String(totalH), m: String(totalM), hm: String(totalHM) },
    transferidos: { h: '0', m: '0', hm: '0' },
    existentesFim2: { h: String(hExist2), m: String(mExist2), hm: String(hExist2 + mExist2) },
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

// Builder for Excel export of Aproveitamento Pedagógico & Situação Geral
export const buildAproveitamentoExcelData = (
  selectedClass: ClassData,
  trimester: '1' | '2' | '3',
  table1Data: Table1RowData[],
  table2Data: Table2Data
): any[][] => {
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

  const aoa: any[][] = [
    ['REPÚBLICA DE MOÇAMBIQUE'],
    ['MINISTÉRIO DA EDUCAÇÃO E DESENVOLVIMENTO HUMANO'],
    [`APROVEITAMENTO PEDAGÓGICO DO ${trimester}º TRIMESTRE`],
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
      row.professor || '-',
      row.aa || '-',
      row.ns || '-',
      row.s || '-',
      row.bom || '-',
      row.mb || '-',
      row.e || '-',
      row.positivasNum || '-',
      row.positivasPct ? (row.positivasPct === '-' ? '-' : `${row.positivasPct}%`) : '-',
      row.negativasNum || '-',
      row.negativasPct ? (row.negativasPct === '-' ? '-' : `${row.negativasPct}%`) : '-',
      row.meninasPosNum || '-',
      row.meninasPosPct ? (row.meninasPosPct === '-' ? '-' : `${row.meninasPosPct}%`) : '-',
      row.meninasNegNum || '-',
      row.meninasNegPct ? (row.meninasNegPct === '-' ? '-' : `${row.meninasNegPct}%`) : '-',
    ]);
  });
  // A tabela oficial de aproveitamento pedagógico não possui linha de total

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

  return aoa;
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

  // Load and auto compute data for active trimester based on Pauta da Turma
  useEffect(() => {
    const computed = computeAproveitamentoFromClass(selectedClass, trimester, user?.displayName);
    const saved = selectedClass.aproveitamentoData?.[trimester];

    if (saved && saved.table1 && Array.isArray(saved.table1) && saved.table1.length > 0) {
      const mergedT1 = computed.t1.map((cRow) => {
        // Se a disciplina NÃO consta na Pauta da Turma (como Filosofia e Francês no 1º ciclo)
        if (!isSubjectInPauta(cRow.id)) {
          // Permite manter dados manuais caso o utilizador os tenha introduzido voluntariamente
          const sRow = saved.table1.find(
            (r: Table1RowData) =>
              r.id === cRow.id ||
              r.disciplina.toLowerCase().trim() === cRow.disciplina.toLowerCase().trim()
          );
          if (sRow && parseVal(sRow.aa) > 0) {
            return applyStrictRulesTable1Row({ ...cRow, ...sRow });
          }
          return createEmptyTable1Row(cRow.id, cRow.disciplina);
        }

        const sRow = saved.table1.find(
          (r: Table1RowData) =>
            r.id === cRow.id ||
            r.disciplina.toLowerCase().trim() === cRow.disciplina.toLowerCase().trim() ||
            (cRow.id === 'edmc' && (r.id === 'ne' || r.disciplina.toLowerCase().includes('moral') || r.disciplina.toLowerCase().includes('ne'))) ||
            (cRow.id === 'tics' && (r.id === 'dgd' || r.disciplina.toLowerCase().includes('tic') || r.disciplina.toLowerCase().includes('dgd'))) ||
            (cRow.id === 'ed_visual' && (r.id === 'ev' || r.disciplina.toLowerCase().includes('visual') || r.disciplina.toLowerCase().includes('edv'))) ||
            (cRow.id === 'ed_fisica' && (r.id === 'ef' || r.disciplina.toLowerCase().includes('fisica') || r.disciplina.toLowerCase().includes('edf')))
        );

        if (!sRow) return cRow;

        const cAA = parseVal(cRow.aa);
        // Se a disciplina tem notas avaliadas na Pauta da Turma (cAA > 0),
        // a Pauta da Turma é a FONTE OFICIAL estrita para quantificação e resultados!
        // Preserva o professor introduzido manualmente se existir.
        if (cAA > 0) {
          return {
            ...cRow,
            professor: (sRow.professor && sRow.professor !== '-') ? sRow.professor : cRow.professor,
          };
        }

        // Se na Pauta ainda não constam notas para esta disciplina mas o utilizador preencheu manualmente:
        const sAA = parseVal(sRow.aa);
        if (sAA > 0) {
          const base = { ...cRow, ...sRow };
          return applyStrictRulesTable1Row(base);
        }

        return cRow;
      });
      setTable1Data(mergedT1);
    } else {
      setTable1Data(computed.t1);
    }

    if (saved && saved.table2) {
      // Para a Tabela 2: preserva dados contextuais manuais (transferidos, que entraram, mapa33 se editado),
      // mas as Positivas e Negativas refletem rigorosamente o aproveitamento pedagógico oficial!
      const mergedT2: Table2Data = {
        ...computed.t2,
        mapa33: saved.table2.mapa33 || computed.t2.mapa33,
        existentesFim1: saved.table2.existentesFim1 || computed.t2.existentesFim1,
        entraram2: saved.table2.entraram2 || computed.t2.entraram2,
        transferidos: saved.table2.transferidos || computed.t2.transferidos,
      };
      setTable2Data(applyStrictRulesTable2(mergedT2));
    } else {
      setTable2Data(computed.t2);
    }

    setHasChanges(false);
  }, [trimester, selectedClass, user]);

  // Handle cell edit in Table 1
  const handleTable1Change = (index: number, field: keyof Table1RowData, value: string) => {
    setTable1Data((prev) => {
      const updated = [...prev];
      let row = { ...updated[index], [field]: value };
      row = applyStrictRulesTable1Row(row);
      updated[index] = row;
      // Also update Table 2 so it strictly observes Table 1
      setTable2Data((prevT2) => deriveTable2FromTable1(updated, prevT2));
      return updated;
    });
    setHasChanges(true);
  };

  // Recalculate everything fresh from Pauta da Turma
  const handleRecalculateFromPauta = () => {
    const fresh = computeAproveitamentoFromClass(selectedClass, trimester, user?.displayName);
    const mergedT1 = fresh.t1.map((cRow) => {
      const existing = table1Data.find((r) => r.id === cRow.id);
      return {
        ...cRow,
        professor: existing?.professor || cRow.professor,
      };
    });
    setTable1Data(mergedT1);
    setTable2Data(fresh.t2);
    setHasChanges(true);
    toast.success('Aproveitamento Pedagógico e Situação Geral recalculados com sucesso a partir da Pauta da Turma!');
  };

  // Handle cell edit in Table 2
  const handleTable2Change = (group: keyof Table2Data, sub: 'h' | 'm' | 'hm', value: string) => {
    setTable2Data((prev) => {
      const updated = { ...prev };
      const currentGroup = { ...updated[group], [sub]: value };
      updated[group] = currentGroup;
      return applyStrictRulesTable2(updated);
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



  return (
    <div className="space-y-6 pt-4 sm:pt-6 animate-in fade-in duration-300">
      {/* Top Header Card (Hidden on Print) */}
      <div className="bg-card rounded-2xl border border-border shadow-xs p-3.5 sm:p-5 no-print space-y-3.5">
        {/* Row 1: Botão Voltar à Esquerda & Título Situação da Turma à Direita */}
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="outline"
            onClick={onBack}
            className="h-8.5 sm:h-9 px-3 sm:px-3.5 border border-purple-200 dark:border-purple-900/40 bg-purple-50/20 dark:bg-purple-950/20 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded-xl shadow-2xs flex items-center gap-1.5 cursor-pointer transition-all shrink-0 text-xs sm:text-sm font-semibold"
            title="Voltar para a Pauta da Turma"
          >
            <ChevronLeft className="h-4 w-4 sm:h-4.5 sm:w-4.5 shrink-0" />
            <span>Voltar</span>
          </Button>

          <h2 className="text-sm sm:text-lg md:text-xl font-black text-foreground tracking-tight text-right flex items-center justify-end gap-1.5 sm:gap-2">
            <BarChart3 className="h-4.5 w-4.5 sm:h-5 sm:w-5 text-purple-600 dark:text-purple-400 shrink-0" />
            <span>Situação da Turma</span>
          </h2>
        </div>

        {/* Row 2: Aba de Selecção de Trimestres e Acções */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-border/50">
          {/* Botão Recalcular a partir da Pauta da Turma */}
          <Button
            variant="outline"
            onClick={handleRecalculateFromPauta}
            className="h-8.5 px-3 border border-purple-200 dark:border-purple-900/40 bg-purple-50/20 dark:bg-purple-950/20 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all shadow-2xs"
            title="Recalcular dados das tabelas rigorosamente a partir da Pauta da Turma"
          >
            <RefreshCw className="h-3.5 w-3.5 shrink-0 text-purple-600 dark:text-purple-400" />
            <span>Recalcular da Pauta</span>
          </Button>

          {/* Trimester Tabs - Centralized */}
          <div className="flex p-0.5 bg-muted/70 rounded-xl border border-border/40 select-none">
            {(['1', '2', '3'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTrimester(t)}
                className={`px-3.5 sm:px-6 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  trimester === t
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t}º Trimestre
              </button>
            ))}
          </div>

          {/* Optional Save button if manual changes occur */}
          {hasChanges && onUpdateClass ? (
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
          ) : (
            <div className="w-28 hidden sm:block" />
          )}
        </div>
      </div>

      {/* Official Sheet Container (Prints Crisp and Follows the Exact Clean Format) */}
      <div className="bg-card rounded-2xl border border-border shadow-xs p-3 sm:p-6 space-y-6 overflow-hidden print:border-0 print:p-0 print:bg-white print:text-black">
        {/* Document Header - Clean Mozambican Official Structure */}
        <div className="text-center space-y-1 pb-1">
          <p className="text-[11px] sm:text-xs md:text-sm font-bold tracking-widest uppercase text-muted-foreground print:text-black">
            República de Moçambique
          </p>
          <p className="text-[11px] sm:text-xs md:text-sm font-semibold tracking-wide text-muted-foreground print:text-black">
            Ministério da Educação e Desenvolvimento Humano
          </p>
          <h3 className="text-sm sm:text-base md:text-xl font-black uppercase tracking-wider text-foreground print:text-black font-sans pt-1">
            APROVEITAMENTO PEDAGÓGICO DO {trimester}º TRIMESTRE
          </h3>
        </div>

        {/* ============================================================ */}
        {/* TABELA 1: APROVEITAMENTO PEDAGÓGICO DO _____ TRIMESTRE       */}
        {/* ============================================================ */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs sm:text-sm md:text-base font-black tracking-wide uppercase text-foreground print:text-black">
              1. Aproveitamento Pedagógico
            </h4>
          </div>

          <div className="overflow-x-auto custom-desktop-scrollbar border border-zinc-400 dark:border-zinc-700 rounded-lg print:border-black">
            <table className="w-full min-w-[1050px] border-collapse text-center text-xs print:text-[9px]">
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

                {/* Subheaders: NS 0/9, S 10/13, Bom 14/16, MB 17/18, E 19/20, etc. */}
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

              {/* Table 1 Body */}
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
                        placeholder="-"
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
                          row.ns && row.ns !== '0' && row.ns !== '-' ? 'text-red-600 dark:text-red-400 font-bold' : ''
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
              </tbody>
            </table>
          </div>
        </div>

        {/* ============================================================ */}
        {/* TABELA 2: Situação Geral da Turma (Mapa 3/3)                 */}
        {/* ============================================================ */}
        <div className="space-y-3 pt-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs sm:text-sm md:text-base font-black tracking-wide uppercase text-foreground print:text-black">
              2. Situação Geral da Turma (Mapa 3/3)
            </h4>
          </div>

          <div className="overflow-x-auto custom-desktop-scrollbar border border-zinc-400 dark:border-zinc-700 rounded-lg print:border-black">
            <table className="w-full min-w-[1640px] border-collapse text-center text-xs print:min-w-0 print:w-full print:text-[8px]">
              {/* Header Row 1: 10 main columns matching the photo */}
              <thead>
                <tr className="bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-extrabold border-b border-zinc-400 dark:border-zinc-700 print:bg-gray-200 print:text-black print:border-black">
                  <th colSpan={3} className="border-r border-zinc-400 dark:border-zinc-700 p-2 min-w-[158px]">
                    Mapa 3/3
                  </th>
                  <th colSpan={3} className="border-r border-zinc-400 dark:border-zinc-700 p-2 min-w-[158px]">
                    {trimester === '1'
                      ? 'Existentes no Início do 1º Trimestre'
                      : trimester === '2'
                      ? 'Existentes no fim do 1º Trimestre'
                      : 'Existentes no fim do 2º Trimestre'}
                  </th>
                  <th colSpan={3} className="border-r border-zinc-400 dark:border-zinc-700 p-2 min-w-[158px]">
                    Que entraram no {trimester}º Trimestre
                  </th>
                  <th colSpan={3} className="border-r border-zinc-400 dark:border-zinc-700 p-2 min-w-[158px]">
                    Total
                  </th>
                  <th colSpan={3} className="border-r border-zinc-400 dark:border-zinc-700 p-2 min-w-[158px]">
                    Transferidos
                  </th>
                  <th colSpan={3} className="border-r border-zinc-400 dark:border-zinc-700 p-2 min-w-[158px]">
                    Existentes no Fim do {trimester}ºTrimestre
                  </th>
                  <th colSpan={3} className="border-r border-zinc-400 dark:border-zinc-700 p-2 min-w-[158px]">
                    Situação Positiva (Número)
                  </th>
                  <th colSpan={3} className="border-r border-zinc-400 dark:border-zinc-700 p-2 min-w-[194px]">
                    Situação Positiva (%)
                  </th>
                  <th colSpan={3} className="border-r border-zinc-400 dark:border-zinc-700 p-2 min-w-[158px]">
                    Situação Negativa (Número)
                  </th>
                  <th colSpan={3} className="p-2 min-w-[194px]">
                    Situação Negativa (%)
                  </th>
                </tr>

                {/* Header Row 2: H, M, HM under each column */}
                <tr className="bg-zinc-200/90 dark:bg-zinc-800/90 text-zinc-900 dark:text-zinc-100 font-bold border-b border-zinc-400 dark:border-zinc-700 print:bg-gray-150 print:text-black print:border-black text-xs">
                  {Array.from({ length: 10 }).map((_, i) => {
                    const isPct = i === 7 || i === 9;
                    return (
                      <React.Fragment key={i}>
                        <th
                          className={`border-r border-zinc-300 dark:border-zinc-700 py-1.5 px-1 text-center font-bold ${
                            isPct ? 'w-[62px] min-w-[62px]' : 'w-[50px] min-w-[50px]'
                          } print:border-black print:w-auto print:min-w-0`}
                          title="Homens (Rapazes)"
                        >
                          H
                        </th>
                        <th
                          className={`border-r border-zinc-300 dark:border-zinc-700 py-1.5 px-1 text-center font-bold ${
                            isPct ? 'w-[62px] min-w-[62px]' : 'w-[50px] min-w-[50px]'
                          } print:border-black print:w-auto print:min-w-0`}
                          title="Mulheres (Raparigas)"
                        >
                          M
                        </th>
                        <th
                          className={`py-1.5 px-1 text-center font-black bg-muted/20 ${
                            isPct ? 'w-[70px] min-w-[70px]' : 'w-[58px] min-w-[58px]'
                          } ${
                            i < 9 ? 'border-r border-zinc-400 dark:border-zinc-700 print:border-black' : ''
                          } print:border-black print:w-auto print:min-w-0`}
                          title="Total Homens + Mulheres"
                        >
                          HM
                        </th>
                      </React.Fragment>
                    );
                  })}
                </tr>
              </thead>

              {/* Data Row */}
              <tbody>
                <tr className="border-b border-zinc-400 dark:border-zinc-700 font-semibold print:border-black">
                  {/* 1. Mapa 3/3 */}
                  <td className="border-r border-zinc-300 dark:border-zinc-700 p-1 w-[50px] min-w-[50px]">
                    <input
                      type="text"
                      value={table2Data.mapa33.h}
                      onChange={(e) => handleTable2Change('mapa33', 'h', e.target.value)}
                      className="w-full text-center bg-transparent border-0 focus:outline-none text-xs font-semibold px-0.5 print:text-[8px]"
                    />
                  </td>
                  <td className="border-r border-zinc-300 dark:border-zinc-700 p-1 w-[50px] min-w-[50px]">
                    <input
                      type="text"
                      value={table2Data.mapa33.m}
                      onChange={(e) => handleTable2Change('mapa33', 'm', e.target.value)}
                      className="w-full text-center bg-transparent border-0 focus:outline-none text-xs font-semibold px-0.5 print:text-[8px]"
                    />
                  </td>
                  <td className="border-r border-zinc-400 dark:border-zinc-700 p-1 font-bold bg-muted/20 w-[58px] min-w-[58px]">
                    <input
                      type="text"
                      value={table2Data.mapa33.hm}
                      onChange={(e) => handleTable2Change('mapa33', 'hm', e.target.value)}
                      className="w-full text-center bg-transparent border-0 focus:outline-none font-bold text-xs px-0.5 print:text-[8px]"
                    />
                  </td>

                  {/* 2. Existentes fim anterior */}
                  <td className="border-r border-zinc-300 dark:border-zinc-700 p-1 w-[50px] min-w-[50px]">
                    <input
                      type="text"
                      value={table2Data.existentesFim1.h}
                      onChange={(e) => handleTable2Change('existentesFim1', 'h', e.target.value)}
                      className="w-full text-center bg-transparent border-0 focus:outline-none text-xs font-semibold px-0.5 print:text-[8px]"
                    />
                  </td>
                  <td className="border-r border-zinc-300 dark:border-zinc-700 p-1 w-[50px] min-w-[50px]">
                    <input
                      type="text"
                      value={table2Data.existentesFim1.m}
                      onChange={(e) => handleTable2Change('existentesFim1', 'm', e.target.value)}
                      className="w-full text-center bg-transparent border-0 focus:outline-none text-xs font-semibold px-0.5 print:text-[8px]"
                    />
                  </td>
                  <td className="border-r border-zinc-400 dark:border-zinc-700 p-1 font-bold bg-muted/20 w-[58px] min-w-[58px]">
                    <input
                      type="text"
                      value={table2Data.existentesFim1.hm}
                      onChange={(e) => handleTable2Change('existentesFim1', 'hm', e.target.value)}
                      className="w-full text-center bg-transparent border-0 focus:outline-none font-bold text-xs px-0.5 print:text-[8px]"
                    />
                  </td>

                  {/* 3. Que entraram */}
                  <td className="border-r border-zinc-300 dark:border-zinc-700 p-1 w-[50px] min-w-[50px]">
                    <input
                      type="text"
                      value={table2Data.entraram2.h}
                      onChange={(e) => handleTable2Change('entraram2', 'h', e.target.value)}
                      className="w-full text-center bg-transparent border-0 focus:outline-none text-xs font-semibold px-0.5 print:text-[8px]"
                    />
                  </td>
                  <td className="border-r border-zinc-300 dark:border-zinc-700 p-1 w-[50px] min-w-[50px]">
                    <input
                      type="text"
                      value={table2Data.entraram2.m}
                      onChange={(e) => handleTable2Change('entraram2', 'm', e.target.value)}
                      className="w-full text-center bg-transparent border-0 focus:outline-none text-xs font-semibold px-0.5 print:text-[8px]"
                    />
                  </td>
                  <td className="border-r border-zinc-400 dark:border-zinc-700 p-1 font-bold bg-muted/20 w-[58px] min-w-[58px]">
                    <input
                      type="text"
                      value={table2Data.entraram2.hm}
                      onChange={(e) => handleTable2Change('entraram2', 'hm', e.target.value)}
                      className="w-full text-center bg-transparent border-0 focus:outline-none font-bold text-xs px-0.5 print:text-[8px]"
                    />
                  </td>

                  {/* 4. Total (Existentes + Entraram) */}
                  <td className="border-r border-zinc-300 dark:border-zinc-700 p-1 bg-muted/10 w-[50px] min-w-[50px]">
                    <input
                      type="text"
                      value={table2Data.total.h}
                      onChange={(e) => handleTable2Change('total', 'h', e.target.value)}
                      className="w-full text-center bg-transparent border-0 focus:outline-none text-xs font-semibold px-0.5 print:text-[8px]"
                      title="Total H = Existentes H + Entraram H"
                    />
                  </td>
                  <td className="border-r border-zinc-300 dark:border-zinc-700 p-1 bg-muted/10 w-[50px] min-w-[50px]">
                    <input
                      type="text"
                      value={table2Data.total.m}
                      onChange={(e) => handleTable2Change('total', 'm', e.target.value)}
                      className="w-full text-center bg-transparent border-0 focus:outline-none text-xs font-semibold px-0.5 print:text-[8px]"
                      title="Total M = Existentes M + Entraram M"
                    />
                  </td>
                  <td className="border-r border-zinc-400 dark:border-zinc-700 p-1 font-bold bg-muted/25 w-[58px] min-w-[58px]">
                    <input
                      type="text"
                      value={table2Data.total.hm}
                      onChange={(e) => handleTable2Change('total', 'hm', e.target.value)}
                      className="w-full text-center bg-transparent border-0 focus:outline-none font-bold text-xs px-0.5 print:text-[8px]"
                    />
                  </td>

                  {/* 5. Transferidos */}
                  <td className="border-r border-zinc-300 dark:border-zinc-700 p-1 w-[50px] min-w-[50px]">
                    <input
                      type="text"
                      value={table2Data.transferidos.h}
                      onChange={(e) => handleTable2Change('transferidos', 'h', e.target.value)}
                      className="w-full text-center bg-transparent border-0 focus:outline-none text-xs font-semibold px-0.5 print:text-[8px]"
                    />
                  </td>
                  <td className="border-r border-zinc-300 dark:border-zinc-700 p-1 w-[50px] min-w-[50px]">
                    <input
                      type="text"
                      value={table2Data.transferidos.m}
                      onChange={(e) => handleTable2Change('transferidos', 'm', e.target.value)}
                      className="w-full text-center bg-transparent border-0 focus:outline-none text-xs font-semibold px-0.5 print:text-[8px]"
                    />
                  </td>
                  <td className="border-r border-zinc-400 dark:border-zinc-700 p-1 font-bold bg-muted/20 w-[58px] min-w-[58px]">
                    <input
                      type="text"
                      value={table2Data.transferidos.hm}
                      onChange={(e) => handleTable2Change('transferidos', 'hm', e.target.value)}
                      className="w-full text-center bg-transparent border-0 focus:outline-none font-bold text-xs px-0.5 print:text-[8px]"
                    />
                  </td>

                  {/* 6. Existentes no Fim (Total - Transferidos) */}
                  <td className="border-r border-zinc-300 dark:border-zinc-700 p-1 bg-muted/10 w-[50px] min-w-[50px]">
                    <input
                      type="text"
                      value={table2Data.existentesFim2.h}
                      onChange={(e) => handleTable2Change('existentesFim2', 'h', e.target.value)}
                      className="w-full text-center bg-transparent border-0 focus:outline-none text-xs font-semibold px-0.5 print:text-[8px]"
                      title="Existentes Fim H = Total H - Transferidos H"
                    />
                  </td>
                  <td className="border-r border-zinc-300 dark:border-zinc-700 p-1 bg-muted/10 w-[50px] min-w-[50px]">
                    <input
                      type="text"
                      value={table2Data.existentesFim2.m}
                      onChange={(e) => handleTable2Change('existentesFim2', 'm', e.target.value)}
                      className="w-full text-center bg-transparent border-0 focus:outline-none text-xs font-semibold px-0.5 print:text-[8px]"
                      title="Existentes Fim M = Total M - Transferidos M"
                    />
                  </td>
                  <td className="border-r border-zinc-400 dark:border-zinc-700 p-1 font-bold bg-muted/25 w-[58px] min-w-[58px]">
                    <input
                      type="text"
                      value={table2Data.existentesFim2.hm}
                      onChange={(e) => handleTable2Change('existentesFim2', 'hm', e.target.value)}
                      className="w-full text-center bg-transparent border-0 focus:outline-none font-bold text-xs px-0.5 print:text-[8px]"
                    />
                  </td>

                  {/* 7. Situação Positiva (Número) */}
                  <td className="border-r border-zinc-300 dark:border-zinc-700 p-1 text-blue-600 dark:text-blue-400 font-bold bg-blue-50/20 dark:bg-blue-950/20 print:text-black w-[50px] min-w-[50px]">
                    <input
                      type="text"
                      value={table2Data.positivasNum.h}
                      onChange={(e) => handleTable2Change('positivasNum', 'h', e.target.value)}
                      className="w-full text-center bg-transparent border-0 focus:outline-none font-bold text-xs px-0.5 print:text-[8px]"
                    />
                  </td>
                  <td className="border-r border-zinc-300 dark:border-zinc-700 p-1 text-blue-600 dark:text-blue-400 font-bold bg-blue-50/20 dark:bg-blue-950/20 print:text-black w-[50px] min-w-[50px]">
                    <input
                      type="text"
                      value={table2Data.positivasNum.m}
                      onChange={(e) => handleTable2Change('positivasNum', 'm', e.target.value)}
                      className="w-full text-center bg-transparent border-0 focus:outline-none font-bold text-xs px-0.5 print:text-[8px]"
                    />
                  </td>
                  <td className="border-r border-zinc-400 dark:border-zinc-700 p-1 font-black text-blue-700 dark:text-blue-300 bg-blue-100/30 dark:bg-blue-950/40 print:text-black w-[58px] min-w-[58px]">
                    <input
                      type="text"
                      value={table2Data.positivasNum.hm}
                      onChange={(e) => handleTable2Change('positivasNum', 'hm', e.target.value)}
                      className="w-full text-center bg-transparent border-0 focus:outline-none font-black text-xs px-0.5 print:text-[8px]"
                    />
                  </td>

                  {/* 8. Situação Positiva (%) */}
                  <td className="border-r border-zinc-300 dark:border-zinc-700 p-1 text-muted-foreground print:text-black w-[62px] min-w-[62px]">
                    <input
                      type="text"
                      value={table2Data.positivasPct.h}
                      onChange={(e) => handleTable2Change('positivasPct', 'h', e.target.value)}
                      className="w-full text-center bg-transparent border-0 focus:outline-none text-xs font-semibold px-0.5 print:text-[8px]"
                      title="Positivas % (H) = (Positivas H / Existentes Fim H) * 100"
                    />
                  </td>
                  <td className="border-r border-zinc-300 dark:border-zinc-700 p-1 text-muted-foreground print:text-black w-[62px] min-w-[62px]">
                    <input
                      type="text"
                      value={table2Data.positivasPct.m}
                      onChange={(e) => handleTable2Change('positivasPct', 'm', e.target.value)}
                      className="w-full text-center bg-transparent border-0 focus:outline-none text-xs font-semibold px-0.5 print:text-[8px]"
                      title="Positivas % (M) = (Positivas M / Existentes Fim M) * 100"
                    />
                  </td>
                  <td className="border-r border-zinc-400 dark:border-zinc-700 p-1 font-bold text-foreground bg-muted/20 print:text-black w-[70px] min-w-[70px]">
                    <input
                      type="text"
                      value={table2Data.positivasPct.hm}
                      onChange={(e) => handleTable2Change('positivasPct', 'hm', e.target.value)}
                      className="w-full text-center bg-transparent border-0 focus:outline-none font-bold text-xs px-0.5 print:text-[8px]"
                      title="Positivas % (HM) = (Positivas HM / Existentes Fim HM) * 100"
                    />
                  </td>

                  {/* 9. Situação Negativa (Número) */}
                  <td className="border-r border-zinc-300 dark:border-zinc-700 p-1 text-red-600 dark:text-red-400 font-bold bg-red-50/20 dark:bg-red-950/20 print:text-black w-[50px] min-w-[50px]">
                    <input
                      type="text"
                      value={table2Data.negativasNum.h}
                      onChange={(e) => handleTable2Change('negativasNum', 'h', e.target.value)}
                      className="w-full text-center bg-transparent border-0 focus:outline-none font-bold text-xs px-0.5 print:text-[8px]"
                      title="Negativas H = Existentes Fim H - Positivas H"
                    />
                  </td>
                  <td className="border-r border-zinc-300 dark:border-zinc-700 p-1 text-red-600 dark:text-red-400 font-bold bg-red-50/20 dark:bg-red-950/20 print:text-black w-[50px] min-w-[50px]">
                    <input
                      type="text"
                      value={table2Data.negativasNum.m}
                      onChange={(e) => handleTable2Change('negativasNum', 'm', e.target.value)}
                      className="w-full text-center bg-transparent border-0 focus:outline-none font-bold text-xs px-0.5 print:text-[8px]"
                      title="Negativas M = Existentes Fim M - Positivas M"
                    />
                  </td>
                  <td className="border-r border-zinc-400 dark:border-zinc-700 p-1 font-black text-red-700 dark:text-red-300 bg-red-100/30 dark:bg-red-950/40 print:text-black w-[58px] min-w-[58px]">
                    <input
                      type="text"
                      value={table2Data.negativasNum.hm}
                      onChange={(e) => handleTable2Change('negativasNum', 'hm', e.target.value)}
                      className="w-full text-center bg-transparent border-0 focus:outline-none font-black text-xs px-0.5 print:text-[8px]"
                    />
                  </td>

                  {/* 10. Situação Negativa (%) */}
                  <td className="border-r border-zinc-300 dark:border-zinc-700 p-1 text-muted-foreground print:text-black w-[62px] min-w-[62px]">
                    <input
                      type="text"
                      value={table2Data.negativasPct.h}
                      onChange={(e) => handleTable2Change('negativasPct', 'h', e.target.value)}
                      className="w-full text-center bg-transparent border-0 focus:outline-none text-xs font-semibold px-0.5 print:text-[8px]"
                      title="Negativas % (H) = (Negativas H / Existentes Fim H) * 100"
                    />
                  </td>
                  <td className="border-r border-zinc-300 dark:border-zinc-700 p-1 text-muted-foreground print:text-black w-[62px] min-w-[62px]">
                    <input
                      type="text"
                      value={table2Data.negativasPct.m}
                      onChange={(e) => handleTable2Change('negativasPct', 'm', e.target.value)}
                      className="w-full text-center bg-transparent border-0 focus:outline-none text-xs font-semibold px-0.5 print:text-[8px]"
                      title="Negativas % (M) = (Negativas M / Existentes Fim M) * 100"
                    />
                  </td>
                  <td className="p-1 font-bold text-foreground bg-muted/20 print:text-black w-[70px] min-w-[70px]">
                    <input
                      type="text"
                      value={table2Data.negativasPct.hm}
                      onChange={(e) => handleTable2Change('negativasPct', 'hm', e.target.value)}
                      className="w-full text-center bg-transparent border-0 focus:outline-none font-bold text-xs px-0.5 print:text-[8px]"
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
