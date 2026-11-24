export type Grades = {
  acs1: string;
  acs2: string;
  acs3: string;
  ap: string;
  exame: string;
  mediaGeral?: string;
};

export type StudentNote = {
  id: string;
  date: string;
  text: string;
};

export type Student = {
  id: string;
  studentNumber?: string;
  name: string;
  gender?: 'M' | 'F';
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
  notes?: StudentNote[];
  subjectGrades?: Record<string, string>;
  trimesterSubjectGrades?: {
    1?: Record<string, string>;
    2?: Record<string, string>;
    3?: Record<string, string>;
  };
};

export const isStudentFemale = (student: Student): boolean => {
  if (student.gender === 'F') return true;
  if (student.gender === 'M') return false;
  const firstName = (student.name || '').trim().split(' ')[0].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const knownFemale = [
    'maria', 'ana', 'fatima', 'amina', 'luisa', 'carla', 'sofia', 'marta', 'paula', 'cristina',
    'isabel', 'ines', 'beatriz', 'raquel', 'carmen', 'teresa', 'claudia', 'helena', 'joana',
    'sara', 'patricia', 'jessica', 'vanessa', 'daniela', 'lucia', 'rosa', 'albertina', 'angela',
    'elsa', 'esperanca', 'julia', 'nadia', 'zaida', 'leila', 'samira', 'mariamo', 'aida',
    'neuza', 'yara', 'telma', 'shelsea', 'edna', 'sonia', 'natercia', 'lucinda', 'margarida',
    'catarina', 'susana', 'ivone', 'alice', 'filomena', 'graziela', 'inacia', 'olga', 'tania'
  ];
  if (knownFemale.includes(firstName)) return true;
  if (firstName.endsWith('a') && !['joshua', 'luca', 'elias', 'isaia', 'mussa', 'issa', 'mustafa', 'babua'].includes(firstName)) return true;
  return false;
};

export const MEDIA_GERAL_SUBJECTS = [
  { key: 'P', label: 'P', name: 'Português' },
  { key: 'I', label: 'I', name: 'Inglês' },
  { key: 'H', label: 'H', name: 'História' },
  { key: 'G', label: 'G', name: 'Geografia' },
  { key: 'M', label: 'M', name: 'Matemática' },
  { key: 'F', label: 'F', name: 'Física' },
  { key: 'Q', label: 'Q', name: 'Química' },
  { key: 'B', label: 'B', name: 'Biologia' },
  { key: 'EdV', label: 'Ed. V', name: 'Educação Visual' },
  { key: 'AP', label: 'AP', name: 'Agropecuária' },
  { key: 'EdMC', label: 'Ed. MC', name: 'Educação Moral e Cívica' },
  { key: 'TICs', label: 'TICs', name: 'Tecnologias de Informação e Comunicação' },
  { key: 'EdF', label: 'Ed. F', name: 'Educação Física' },
] as const;

export type SubjectKey = typeof MEDIA_GERAL_SUBJECTS[number]['key'];

export const emptyGrades = (): Grades => ({ acs1: '', acs2: '', acs3: '', ap: '', exame: '', mediaGeral: '' });

export const normalizeSearchText = (text: string): string => {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
};

export const getStudentOrderNumber = (student: Student, sortedList?: Student[]): string => {
  if (student.studentNumber && student.studentNumber.trim()) {
    return student.studentNumber.trim();
  }
  if (sortedList && sortedList.length > 0) {
    const idx = sortedList.findIndex((s) => s.id === student.id);
    if (idx >= 0) return String(idx + 1);
  }
  return '-';
};

export const filterStudentByQuery = (
  student: Student,
  query: string,
  classOrderIndex: number
): boolean => {
  const clean = query.trim();
  if (!clean) return true;

  const numberMatch = clean.match(/^(?:n[º°.]*|no\.?|#|aluno\s+|n[úu]mero\s+)?\s*(\d+)[º°.]?$/i);
  if (numberMatch) {
    const targetNum = parseInt(numberMatch[1], 10);
    const sAssignedNum =
      student.studentNumber && student.studentNumber.trim()
        ? parseInt(student.studentNumber.trim(), 10)
        : NaN;
    const sRawNumStr = (student.studentNumber || '').trim();
    const hasAssignedNumber = !isNaN(sAssignedNum) || sRawNumStr !== '';

    const matchesExactNumber = hasAssignedNumber
      ? (!isNaN(sAssignedNum) && sAssignedNum === targetNum) || sRawNumStr === numberMatch[1]
      : classOrderIndex === targetNum;

    return matchesExactNumber;
  }

  const normQuery = normalizeSearchText(clean);
  const normName = normalizeSearchText(student.name);
  const normStudentNumber = normalizeSearchText(student.studentNumber || '');

  if (normStudentNumber && normStudentNumber === normQuery) {
    return true;
  }

  const queryWords = normQuery.split(/\s+/).filter(Boolean);
  if (queryWords.length > 0 && queryWords.every((word) => normName.includes(word))) {
    return true;
  }

  return false;
};

export const getStudentGrades = (student: Student, trimester: '1' | '2' | '3'): Grades => {
  if (student.trimesterGrades && student.trimesterGrades[trimester]) {
    return student.trimesterGrades[trimester]!;
  }
  if (trimester === '1') {
    return student.grades || emptyGrades();
  }
  return emptyGrades();
};

export const getStudentSubjectGrades = (student: Student, trimester: '1' | '2' | '3'): Record<string, string> => {
  if (student.trimesterSubjectGrades && student.trimesterSubjectGrades[trimester]) {
    return student.trimesterSubjectGrades[trimester]!;
  }
  if (trimester === '1' && student.subjectGrades) {
    return student.subjectGrades;
  }
  return {};
};

export const customRound = (value: number): string => {
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

export const calculateMediaGeralForStudent = (
  student: Student,
  trimester: '1' | '2' | '3'
): {
  rounded: string;
  raw: number | null;
  sum: number;
  filledCount: number;
  hasAnyGrade: boolean;
} => {
  const subjectGrades = getStudentSubjectGrades(student, trimester);
  let sum = 0;
  let filledCount = 0;

  MEDIA_GERAL_SUBJECTS.forEach((sub) => {
    const val = subjectGrades[sub.key];
    if (val !== undefined && val !== null && val.trim() !== '' && val.trim() !== '-') {
      const num = parseFloat(val.replace(',', '.'));
      if (!isNaN(num)) {
        sum += num;
        filledCount++;
      }
    }
  });

  if (filledCount === 0) {
    return { rounded: '-', raw: null, sum: 0, filledCount: 0, hasAnyGrade: false };
  }

  const rawAverage = sum / 13;
  const rounded = customRound(rawAverage);

  return {
    rounded,
    raw: rawAverage,
    sum,
    filledCount,
    hasAnyGrade: true,
  };
};

export type ClassData = {
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
  aproveitamentoData?: Record<string, any>;
  createdAt?: string;
};

export const calculateAcsAverage = (grades: Grades) => {
  const values = [grades.acs1, grades.acs2, grades.acs3]
    .map(v => parseFloat((v || '').replace(',', '.')))
    .filter(v => !isNaN(v));
  if (values.length < 2) return '-';
  const sum = values.reduce((acc, curr) => acc + curr, 0);
  const rawAverage = sum / values.length;
  return customRound(rawAverage);
};

export const calculateAutoGeneralAverage = (grades: Grades): string => {
  const acsAvgStr = calculateAcsAverage(grades);
  if (acsAvgStr === '-') return '-';
  const acsAvg = parseFloat(acsAvgStr.replace(',', '.'));
  const apVal = parseFloat((grades.ap || '').replace(',', '.'));
  if (isNaN(acsAvg) || isNaN(apVal)) return '-';
  const rawAverage = (acsAvg + apVal) / 2;
  return customRound(rawAverage);
};

export const calculateGeneralAverage = (grades: Grades): string => {
  const manual = (grades.mediaGeral || '').trim();
  if (manual !== '' && manual !== '-') {
    const manualNum = parseFloat(manual.replace(',', '.'));
    if (!isNaN(manualNum)) {
      return manual;
    }
  }
  return calculateAutoGeneralAverage(grades);
};

export const calculateTrimesterAverage = (student: Student): string => {
  const g1 = calculateGeneralAverage(getStudentGrades(student, '1'));
  const g2 = calculateGeneralAverage(getStudentGrades(student, '2'));
  const g3 = calculateGeneralAverage(getStudentGrades(student, '3'));

  if (g1 === '-' || g2 === '-' || g3 === '-') return '-';

  const n1 = parseFloat(g1.replace(',', '.'));
  const n2 = parseFloat(g2.replace(',', '.'));
  const n3 = parseFloat(g3.replace(',', '.'));

  if (isNaN(n1) || isNaN(n2) || isNaN(n3)) return '-';

  const rawAverage = (n1 + n2 + n3) / 3;
  return customRound(rawAverage);
};

export type ApoioAlertStatus = 'red' | 'orange' | 'green' | 'none';

export const getRepresentativeGrade = (student: Student, trimester: '1' | '2' | '3'): number | null => {
  const grades = getStudentGrades(student, trimester);

  const parseGradeVal = (v: string | undefined): number | null => {
    if (!v || v.trim() === '' || v.trim() === '-') return null;
    const n = parseFloat(v.replace(',', '.'));
    return isNaN(n) ? null : n;
  };

  const mediaGeralStr = calculateGeneralAverage(grades);
  if (mediaGeralStr !== '-') {
    const n = parseFloat(mediaGeralStr.replace(',', '.'));
    if (!isNaN(n)) return n;
  }

  const acsAvgStr = calculateAcsAverage(grades);
  if (acsAvgStr !== '-') {
    const n = parseFloat(acsAvgStr.replace(',', '.'));
    if (!isNaN(n)) return n;
  }

  const acs1 = parseGradeVal(grades.acs1);
  if (acs1 !== null) return acs1;
  const acs2 = parseGradeVal(grades.acs2);
  if (acs2 !== null) return acs2;
  const acs3 = parseGradeVal(grades.acs3);
  if (acs3 !== null) return acs3;
  const ap = parseGradeVal(grades.ap);
  if (ap !== null) return ap;
  const exame = parseGradeVal(grades.exame);
  if (exame !== null) return exame;

  return null;
};

export const getApoioAlertStatus = (student: Student, trimester: '1' | '2' | '3'): ApoioAlertStatus => {
  const representativeGrade = getRepresentativeGrade(student, trimester);
  if (representativeGrade === null) return 'none';

  if (representativeGrade < 7) {
    return 'red';
  } else if (representativeGrade >= 7 && representativeGrade <= 11) {
    return 'orange';
  } else {
    return 'green';
  }
};

export const getGradeColor = (val: string, _isAverage = false) => {
  const num = parseFloat((val || '').replace(',', '.'));
  if (isNaN(num)) return '';

  if (num < 10) return 'text-red-500 dark:text-red-400 font-semibold';
  if (num >= 10 && num <= 13) return 'text-yellow-500 dark:text-yellow-400 font-semibold';
  if (num >= 14) return 'text-green-500 dark:text-green-400 font-bold';

  return '';
};
