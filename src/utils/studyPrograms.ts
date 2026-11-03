import type { Institute } from './institutes';

export const STUDY_PROGRAMS = {
  mbbs: { label: 'MBBS', years: ['1st', '2nd', '3rd', '4th', '5th'] },
  bds: { label: 'BDS', years: ['1st', '2nd', '3rd', '4th'] },
  pharm_d: { label: 'Pharm-D', years: ['1st', '2nd', '3rd', '4th', '5th'] },
} as const;

export type StudyProgramCode = keyof typeof STUDY_PROGRAMS;

export type StudyProgramYearOption = {
  programCode: StudyProgramCode;
  year: string;
  label: string;
};

const STUDY_PROGRAM_ORDER: StudyProgramCode[] = ['mbbs', 'bds', 'pharm_d'];

export const isStudyProgramCode = (value?: string | null): value is StudyProgramCode =>
  Boolean(value && Object.prototype.hasOwnProperty.call(STUDY_PROGRAMS, value));

export const getEffectiveProgramCode = (value?: string | null): StudyProgramCode =>
  isStudyProgramCode(value) ? value : 'mbbs';

export const getInstituteProgramCodes = (
  institute?: Pick<Institute, 'programs'> | null,
): StudyProgramCode[] => {
  const configured = Array.isArray(institute?.programs)
    ? institute.programs.filter(isStudyProgramCode)
    : [];
  return configured.length > 0
    ? STUDY_PROGRAM_ORDER.filter(programCode => configured.includes(programCode))
    : ['mbbs'];
};

export const getInstituteProgramYearOptions = (
  institute?: Pick<Institute, 'programs'> | null,
): StudyProgramYearOption[] => getInstituteProgramCodes(institute).flatMap(programCode =>
  STUDY_PROGRAMS[programCode].years.map(year => ({
    programCode,
    year,
    label: `${year} Year ${STUDY_PROGRAMS[programCode].label}`,
  })),
);

export const formatProgramYearLabel = (
  year?: string | null,
  programCode?: string | null,
) => year ? `${year} Year ${STUDY_PROGRAMS[getEffectiveProgramCode(programCode)].label}` : '';
