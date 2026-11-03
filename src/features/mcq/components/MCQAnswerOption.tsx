import { memo } from 'react';
import { CheckCircle, XCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

type AnswerState = 'default' | 'selected' | 'correct' | 'incorrect';

type MCQAnswerOptionProps = {
  option: string;
  index: number;
  state: AnswerState;
  disabled: boolean;
  explanation?: {
    verdict: string;
    explanation: string;
  };
  isExplaining: boolean;
  onSelect: (answer: string) => void;
};

const getThemeClasses = (state: AnswerState) => {
  if (state === 'correct') {
    return 'bg-emerald-50/95 dark:bg-emerald-950/40 border-emerald-500/80 dark:border-emerald-500/60 text-emerald-950 dark:text-emerald-100 shadow-sm shadow-emerald-500/10';
  }
  if (state === 'incorrect') {
    return 'bg-red-50/95 dark:bg-red-950/40 border-red-500/80 dark:border-red-500/60 text-red-950 dark:text-red-100 shadow-sm shadow-red-500/10';
  }
  if (state === 'selected') {
    return 'bg-primary/10 border-primary text-foreground ring-2 ring-primary/25 shadow-md shadow-primary/5';
  }
  return 'bg-slate-50/80 dark:bg-slate-900/60 border-slate-200/90 dark:border-slate-800/90 text-foreground hover:border-primary/50 hover:bg-slate-100/90 dark:hover:bg-slate-800/80 hover:shadow-md';
};

export const MCQAnswerOption = memo(function MCQAnswerOption({
  option,
  index,
  state,
  disabled,
  explanation,
  isExplaining,
  onSelect,
}: MCQAnswerOptionProps) {
  return (
    <div>
      <button
        type="button"
        onClick={() => onSelect(option)}
        disabled={disabled}
        className={`group relative flex min-h-14 w-full items-center gap-3.5 rounded-2xl border px-4 py-3.5 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-[0.99] sm:min-h-16 sm:px-5 ${getThemeClasses(state)}`}
      >
        {/* Subtle pill indicator representing interactive choice */}
        <span
          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-all duration-150 ${
            state === 'default'
              ? 'border-slate-300 bg-white/90 group-hover:border-primary/60 dark:border-slate-700 dark:bg-slate-800'
              : state === 'correct'
                ? 'border-emerald-500 bg-emerald-500'
                : state === 'incorrect'
                  ? 'border-red-500 bg-red-500'
                  : 'border-primary bg-primary'
          }`}
        >
          {state !== 'default' && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
        </span>
        <span className="flex-1 text-[0.95rem] font-medium leading-[1.55] tracking-[-0.005em] sm:text-base sm:leading-relaxed">
          {option}
        </span>
        {disabled && (state === 'correct' || state === 'incorrect') && (
          state === 'correct'
            ? <CheckCircle className="h-5 w-5 shrink-0 text-emerald-500" />
            : <XCircle className="h-5 w-5 shrink-0 text-red-500" />
        )}
      </button>

      {disabled && explanation?.explanation && (
        <div
          className={`mx-2 mb-2 mt-2 rounded-xl border p-3.5 text-sm font-medium leading-6 ${
            explanation.verdict === 'correct'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200'
              : 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200'
          }`}
        >
          <span className="font-black">
            {explanation.verdict === 'correct' ? 'Supported: ' : 'Why wrong: '}
          </span>
          {explanation.explanation}
        </div>
      )}

      {disabled && isExplaining && !explanation?.explanation && (
        <div className="mx-2 mb-2 mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/50">
          <div className="mb-2 flex items-center gap-2">
            <Skeleton className="h-3 w-16 rounded-full" />
            <Skeleton className="h-3 w-20 rounded-full" />
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="mt-2 h-3 w-8/12" />
        </div>
      )}
    </div>
  );
});
