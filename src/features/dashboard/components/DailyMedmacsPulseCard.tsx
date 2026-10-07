import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Gamepad2, Trophy, Timer, CheckCircle2, XCircle, ArrowRight, Flame, Check, Sparkles } from 'lucide-react';
import { fetchSubjects, fetchChaptersBySubject, fetchMCQsByChapter, MCQ } from '@/utils/mcqData';
import { fetchCloudContent } from '@/utils/cloudContent';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { supabase } from '@/integrations/supabase/client';
import { DashboardProfile } from '../types';

export interface PulseMCQ extends MCQ {
  is_ahroid_verified?: boolean;
  verdict?: string;
}

export interface PulseLeader {
  full_name: string;
  institute?: string;
  avatar_url?: string;
  time_taken: string;
  cycle_date?: string;
}

interface DailyMedmacsPulseCardProps {
  profile?: DashboardProfile | null;
  isOfflineMode?: boolean;
}

const DAILY_GAME_API_URL = 'https://dailygame.medmacs.app/api/daily-game';

/**
 * Calculates the Daily Game cycle string based on 3:00 PM PKT (UTC+5) daily refresh.
 * 3:00 PM PKT corresponds to 15:00 PKT (10:00 UTC).
 */
function getPkt3PmCycleDateStr(): string {
  const now = new Date();
  // Shift by +5 hours for PKT
  const pktMs = now.getTime() + 5 * 60 * 60 * 1000;
  const pktDate = new Date(pktMs);

  const hours = pktDate.getUTCHours();
  
  // If before 15:00 PKT (3 PM PKT), the current game cycle started yesterday at 15:00 PKT
  if (hours < 15) {
    pktDate.setUTCDate(pktDate.getUTCDate() - 1);
  }

  const yyyy = pktDate.getUTCFullYear();
  const mm = String(pktDate.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(pktDate.getUTCDate()).padStart(2, '0');

  return `${yyyy}-${mm}-${dd}`;
}

// Dr Ahroid Verified MCQs per year for offline/fallback mode
const VERIFIED_YEAR_MCQS: Record<string, PulseMCQ[]> = {
  '1': [
    {
      id: 'pulse-yr1-1',
      question: 'Which ligament prevents hyperextension of the hip joint during standing?',
      options: ['Iliofemoral ligament', 'Ischiofemoral ligament', 'Pubofemoral ligament', 'Ligamentum teres', 'Zona orbicularis'],
      correct_answer: 'Iliofemoral ligament',
      explanation: 'The iliofemoral ligament (Y-ligament of Bigelow) is the strongest ligament in the body and prevents hyperextension of the hip joint.',
      subject: 'Anatomy',
      chapter_id: 'ch-anatomy-1',
      is_ahroid_verified: true,
      verdict: 'verified'
    },
    {
      id: 'pulse-yr1-2',
      question: 'Which organelle is responsible for post-translational modification and sorting of proteins?',
      options: ['Golgi apparatus', 'Rough endoplasmic reticulum', 'Lysosome', 'Peroxisome', 'Nucleolus'],
      correct_answer: 'Golgi apparatus',
      explanation: 'The Golgi apparatus modifies proteins (e.g., glycosylation) and packages them for membrane delivery or secretion.',
      subject: 'Histology',
      chapter_id: 'ch-histo-1',
      is_ahroid_verified: true,
      verdict: 'verified'
    }
  ],
  '2': [
    {
      id: 'pulse-yr2-1',
      question: 'Which ion flow is primarily responsible for the rapid repolarization phase (Phase 3) of ventricular cardiac action potentials?',
      options: ['Efflux of K+ ions', 'Influx of Na+ ions', 'Influx of Ca2+ ions', 'Efflux of Cl- ions', 'Influx of K+ ions'],
      correct_answer: 'Efflux of K+ ions',
      explanation: 'Phase 3 repolarization is driven by the opening of delayed rectifier voltage-gated potassium channels leading to rapid K+ efflux.',
      subject: 'Physiology',
      chapter_id: 'ch-cardio-phys',
      is_ahroid_verified: true,
      verdict: 'verified'
    }
  ],
  '3': [
    {
      id: 'pulse-yr3-1',
      question: 'Which cellular change is pathognomonic for irreversible cell injury leading to necrosis?',
      options: ['Pyknosis and karyorrhexis', 'Cellular swelling', 'Fatty change', 'Plasma membrane blebbing', 'Ribosomal detachment'],
      correct_answer: 'Pyknosis and karyorrhexis',
      explanation: 'Nuclear breakdown (pyknosis, karyorrhexis, karyolysis) signifies irreversible cell death, whereas cellular swelling is reversible.',
      subject: 'General Pathology',
      chapter_id: 'ch-path-1',
      is_ahroid_verified: true,
      verdict: 'verified'
    }
  ],
  '4': [
    {
      id: 'pulse-yr4-1',
      question: 'A 24-year-old female presents with fever, right lower quadrant abdominal pain, and leukocytosis. McBurney sign is positive. What is the most likely diagnosis?',
      options: ['Acute appendicitis', 'Ovarian torsion', 'Ectopic pregnancy', 'Meckel diverticulitis', 'Acute mesenteric adenitis'],
      correct_answer: 'Acute appendicitis',
      explanation: 'Maximal tenderness at McBurney point along with RLQ pain and fever is classic for acute appendicitis.',
      subject: 'Special Pathology / Surgery',
      chapter_id: 'ch-surg-1',
      is_ahroid_verified: true,
      verdict: 'verified'
    }
  ],
  '5': [
    {
      id: 'pulse-yr5-1',
      question: 'A 55-year-old male with severe chest pain radiating to left jaw shows ST-segment elevation in leads V1-V4. Which coronary artery is occluded?',
      options: ['Left anterior descending (LAD) artery', 'Right coronary artery (RCA)', 'Left circumflex artery (LCx)', 'Posterior descending artery', 'Left main artery'],
      correct_answer: 'Left anterior descending (LAD) artery',
      explanation: 'Leads V1-V4 represent the anterior wall of the left ventricle, which is supplied by the LAD artery.',
      subject: 'Medicine',
      chapter_id: 'ch-med-1',
      is_ahroid_verified: true,
      verdict: 'verified'
    }
  ]
};



const EXPANSION_MAP: [RegExp, string][] = [
  [/\b(AIMC|ALLAMA\s*IQBAL)\b/i, 'Allama Iqbal Medical College, Lahore'],
  [/\b(KEMU|KING\s*EDWARD)\b/i, 'King Edward Medical University, Lahore'],
  [/\b(FJMU|FATIMA\s*JINNAH)\b/i, 'Fatima Jinnah Medical University, Lahore'],
  [/\b(RMU|RAWALPINDI\s*MEDICAL)\b/i, 'Rawalpindi Medical University, Rawalpindi'],
  [/\b(AKU|AGA\s*KHAN)\b/i, 'Aga Khan University, Karachi'],
  [/\b(DOW|DUHS)\b/i, 'Dow University of Health Sciences, Karachi'],
  [/\b(KMC|KHYBER\s*MEDICAL\s*COLLEGE)\b/i, 'Khyber Medical College, Peshawar'],
  [/\b(NMC|NISHTAR)\b/i, 'Nishtar Medical University, Multan'],
  [/\b(NUST)\b/i, 'NUST School of Health Sciences, Islamabad'],
  [/\b(SIMS|SERVICES\s*INSTITUTE)\b/i, 'Services Institute of Medical Sciences, Lahore'],
  [/\b(QAMC|QUAID-E-AZAM)\b/i, 'Quaid-e-Azam Medical College, Bahawalpur'],
  [/\b(JSMU|JINNAH\s*SINDH)\b/i, 'Jinnah Sindh Medical University, Karachi'],
  [/\b(SZABMU)\b/i, 'Shaheed Zulfiqar Ali Bhutto Medical University, Islamabad'],
  [/\b(NUMS)\b/i, 'National University of Medical Sciences, Rawalpindi'],
  [/\b(LUMHS)\b/i, 'Liaquat University of Medical & Health Sciences, Jamshoro'],
  [/\b(KMU)\b/i, 'Khyber Medical University, Peshawar'],
  [/\b(AMC|ARMY\s*MEDICAL)\b/i, 'Army Medical College, Rawalpindi'],
  [/\b(CMH)\b/i, 'CMH Institute of Medical Sciences'],
  [/\b(FMH)\b/i, 'FMH College of Medicine & Dentistry, Lahore'],
  [/\b(RLMC)\b/i, 'Rashid Latif Medical College, Lahore'],
  [/\b(LMDC)\b/i, 'Lahore Medical & Dental College, Lahore'],
  [/\b(PMC|FMU)\b/i, 'Faisalabad Medical University, Faisalabad'],
  [/\b(PUMHS)\b/i, 'Peoples University of Medical & Health Sciences, Nawabshah'],
  [/\b(BUMHS|BMC)\b/i, 'Bolan University of Medical & Health Sciences, Quetta']
];

function formatFullInstitute(rawInstitute: string | undefined): string {
  if (!rawInstitute) return 'Medical College';
  const trimmed = rawInstitute.trim();
  if (!trimmed) return 'Medical College';

  for (const [pattern, fullName] of EXPANSION_MAP) {
    if (pattern.test(trimmed)) {
      return fullName;
    }
  }

  return trimmed;
}

function getDeterministicHash(seedStr: string, max: number): number {
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = (hash << 5) - hash + seedStr.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % Math.max(1, max);
}

function resolveCorrectAnswerText(rawCorrect: string | undefined | null, options: string[]): string {
  if (!options || options.length === 0) return rawCorrect || '';
  if (!rawCorrect) return options[0];

  const trimmedRaw = String(rawCorrect).trim();
  
  // 1. If options already includes exact rawCorrect (or case-insensitive exact match)
  const exactMatch = options.find(opt => opt.trim().toLowerCase() === trimmedRaw.toLowerCase());
  if (exactMatch) return exactMatch;

  // 2. Check if rawCorrect is a letter like "A", "B", "C", "D", "E" or "Option A", "Option D", etc.
  const letterMatch = trimmedRaw.match(/^(?:option\s*)?([a-e])(?:\.|\:|\s|$)/i) || trimmedRaw.match(/^([a-e])$/i);
  if (letterMatch) {
    const letterIdx = letterMatch[1].toUpperCase().charCodeAt(0) - 65;
    if (letterIdx >= 0 && letterIdx < options.length) {
      return options[letterIdx];
    }
  }

  // 3. Check if rawCorrect is 1-indexed number ("1", "2", "3", "4", "5")
  const numMatch = trimmedRaw.match(/^(?:option\s*)?([1-5])$/i);
  if (numMatch) {
    const numIdx = Number(numMatch[1]) - 1;
    if (numIdx >= 0 && numIdx < options.length) {
      return options[numIdx];
    }
  }

  // 4. Check if rawCorrect starts with "A) ", "A. ", "D. ", etc.
  const prefixMatch = trimmedRaw.match(/^[a-e][\.\:\)]\s*(.+)$/i);
  if (prefixMatch) {
    const contentText = prefixMatch[1].trim();
    const contentMatch = options.find(opt => opt.trim().toLowerCase() === contentText.toLowerCase());
    if (contentMatch) return contentMatch;
  }

  return trimmedRaw;
}

function ensureFourOptions(options: string[], correctAnswer: string, seed: string): string[] {
  if (!options || options.length === 0) return ['Option A', 'Option B', 'Option C', 'Option D'];
  
  const resolvedCorrectText = resolveCorrectAnswerText(correctAnswer, options);
  let result = [...options];
  
  if (result.length > 4) {
    const incorrectIndices: number[] = [];
    result.forEach((opt, idx) => {
      if (opt.trim().toLowerCase() !== resolvedCorrectText.trim().toLowerCase()) {
        incorrectIndices.push(idx);
      }
    });

    if (incorrectIndices.length > 0) {
      const dropIndexInDistractors = getDeterministicHash(seed + '_drop', incorrectIndices.length);
      const actualDropIndex = incorrectIndices[dropIndexInDistractors];
      result = result.filter((_, idx) => idx !== actualDropIndex);
    }
  }

  if (result.length > 4) {
    result = result.slice(0, 4);
  }

  if (!result.some(opt => opt.trim().toLowerCase() === resolvedCorrectText.trim().toLowerCase())) {
    result[0] = resolvedCorrectText;
  }

  return result;
}

export function DailyMedmacsPulseCard({ profile, isOfflineMode }: DailyMedmacsPulseCardProps) {
  // Academic year key ('1', '2', '3', '4', '5')
  const userYearRaw = String(profile?.year || '1').trim();
  const yearMatch = userYearRaw.match(/\d/);
  const yearKey = yearMatch ? yearMatch[0] : '1';

  // Compute 3 PM PKT Daily Game Cycle string
  const pktCycleStr = getPkt3PmCycleDateStr();
  const storageKey = `daily_pulse_${pktCycleStr}_yr${yearKey}`;

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isPastWinnersOpen, setIsPastWinnersOpen] = useState<boolean>(false);
  const [isAttemptedToday, setIsAttemptedToday] = useState<boolean>(false);
  const [selectedMCQ, setSelectedMCQ] = useState<PulseMCQ | null>(null);
  const [formattedOptions, setFormattedOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [responseTime, setResponseTime] = useState<number>(0);
  const [cloudPrevWinner, setCloudPrevWinner] = useState<PulseLeader | null>(null);
  const [cloudPrevWinners, setCloudPrevWinners] = useState<PulseLeader[]>([]);
  const [cloudTodayLeader, setCloudTodayLeader] = useState<PulseLeader | null>(null);
  const [cloudTodayLeaders, setCloudTodayLeaders] = useState<PulseLeader[]>([]);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  // Load Dr Ahroid verified game question & live winner data from Cloudflare endpoint or Supabase
  useEffect(() => {
    let isMounted = true;
    async function loadDailyGameQuestion() {
      setLoading(true);
      const seed = `${pktCycleStr}_year_${yearKey}`;
      const savedAttempt = localStorage.getItem(storageKey);

      let chosenMCQ: PulseMCQ | null = null;
      let userCloudAttempt: { selectedOption: string; isCorrect: boolean; responseTime: number } | null = null;
      let fetchedWinner: PulseLeader | null = null;
      let fetchedWinners: PulseLeader[] = [];
      let fetchedLeader: PulseLeader | null = null;
      let fetchedLeaders: PulseLeader[] = [];

      try {
        if (!isOfflineMode) {
          // 1. Check live user attempt directly from Supabase DB with 3s timeout
          try {
            const userId = profile?.id || (await Promise.race([
              supabase.auth.getUser().then(r => r.data.user?.id),
              new Promise<undefined>(res => setTimeout(() => res(undefined), 2500))
            ]));

            if (userId) {
              const { data: userRow } = await Promise.race([
                (supabase as any)
                  .from('daily_game_attempts')
                  .select('selected_option, is_correct, response_time_seconds')
                  .eq('year', yearKey)
                  .eq('cycle_date', pktCycleStr)
                  .eq('user_id', userId)
                  .maybeSingle(),
                new Promise<{ data: null }>(res => setTimeout(() => res({ data: null }), 2500))
              ]);

              if (userRow) {
                userCloudAttempt = {
                  selectedOption: userRow.selected_option,
                  isCorrect: Boolean(userRow.is_correct),
                  responseTime: Number(userRow.response_time_seconds)
                };
              }
            }
          } catch {
            // DB query attempt fallback
          }

          // 2. Try Cloudflare Worker endpoint with 3s timeout
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3000);
          const cfRes = await fetch(`${DAILY_GAME_API_URL}?year=${yearKey}&cycle=${pktCycleStr}&_t=${Date.now()}`, { 
            cache: 'no-store',
            signal: controller.signal 
          }).catch(() => null);
          clearTimeout(timeoutId);

          if (cfRes && cfRes.ok) {
            const cfData = await cfRes.json().catch(() => null);
            if (cfData?.prev_winner) fetchedWinner = cfData.prev_winner;
            if (Array.isArray(cfData?.prev_winners)) fetchedWinners = cfData.prev_winners;
            if (cfData?.today_leader) fetchedLeader = cfData.today_leader;
            if (Array.isArray(cfData?.today_leaders)) fetchedLeaders = cfData.today_leaders;
            if (cfData?.question) chosenMCQ = cfData.question;
          }

          // 3. If Cloudflare worker is unreachable or missing question, fetch directly from Supabase RPC with timeout
          if (!chosenMCQ || !fetchedWinner || fetchedWinners.length === 0) {
            try {
              const { data: dbPulse } = await Promise.race([
                (supabase as any).rpc('get_daily_game_pulse', {
                  p_year: yearKey,
                  p_user_id: profile?.id || null
                }),
                new Promise<{ data: null }>(res => setTimeout(() => res({ data: null }), 3000))
              ]);

              if (dbPulse) {
                if (dbPulse.prev_winner && !fetchedWinner) fetchedWinner = dbPulse.prev_winner;
                if (Array.isArray(dbPulse.prev_winners) && fetchedWinners.length === 0) fetchedWinners = dbPulse.prev_winners;
                if (dbPulse.today_leader && !fetchedLeader) fetchedLeader = dbPulse.today_leader;
                if (Array.isArray(dbPulse.today_leaders) && fetchedLeaders.length === 0) fetchedLeaders = dbPulse.today_leaders;
                if (dbPulse.user_attempt && !userCloudAttempt) {
                  userCloudAttempt = {
                    selectedOption: dbPulse.user_attempt.selected_option,
                    isCorrect: Boolean(dbPulse.user_attempt.is_correct),
                    responseTime: Number(dbPulse.user_attempt.response_time_seconds)
                  };
                }
                if (dbPulse.question && !chosenMCQ) {
                  chosenMCQ = {
                    id: dbPulse.question.id || `pulse-yr${yearKey}`,
                    question: dbPulse.question.question,
                    options: dbPulse.question.options,
                    correct_answer: dbPulse.question.correct_answer,
                    explanation: dbPulse.question.explanation,
                    subject: dbPulse.question.subject || 'Medical Science',
                    chapter_id: 'daily-pulse',
                    is_ahroid_verified: true,
                    verdict: 'verified'
                  };
                }
              }
            } catch {
              // Supabase RPC optional fallback ignored
            }
          }

          if (fetchedWinners.length > 0 && !fetchedWinner) {
            fetchedWinner = fetchedWinners[0];
          }
          if (fetchedLeaders.length === 0 && fetchedLeader) {
            fetchedLeaders = [fetchedLeader];
          }
        }
      } catch (err) {
        console.warn('Could not fetch pulse content from cloud/db, using Dr Ahroid verified fallback', err);
      } finally {
        if (!chosenMCQ) {
          const pool = VERIFIED_YEAR_MCQS[yearKey] || VERIFIED_YEAR_MCQS['1'];
          const idx = getDeterministicHash(seed + '_fallback', pool.length);
          chosenMCQ = pool[idx];
        }

        if (isMounted) {
          setCloudPrevWinner(fetchedWinner);
          setCloudPrevWinners(fetchedWinners);
          setCloudTodayLeader(fetchedLeader);
          setCloudTodayLeaders(fetchedLeaders);

          const resolvedCorrect = resolveCorrectAnswerText(chosenMCQ.correct_answer, chosenMCQ.options);
          const normalizedMCQ = { ...chosenMCQ, correct_answer: resolvedCorrect };
          setSelectedMCQ(normalizedMCQ);
          const options4 = ensureFourOptions(normalizedMCQ.options, resolvedCorrect, seed);
          setFormattedOptions(options4);

          if (!isOfflineMode) {
            // Cloud DB is Single Source of Truth
            if (userCloudAttempt) {
              setSelectedOption(userCloudAttempt.selectedOption);
              setIsCorrect(userCloudAttempt.isCorrect);
              setResponseTime(userCloudAttempt.responseTime);
              setIsAttemptedToday(true);
              localStorage.setItem(storageKey, JSON.stringify(userCloudAttempt));
            } else {
              // Attempt deleted or not found in Cloud database -> Purge local storage & reset
              setSelectedOption(null);
              setIsCorrect(null);
              setResponseTime(0);
              setIsAttemptedToday(false);
              localStorage.removeItem(storageKey);
            }
          } else if (savedAttempt) {
            // Offline mode fallback
            try {
              const parsed = JSON.parse(savedAttempt);
              setSelectedOption(parsed.selectedOption);
              setIsCorrect(parsed.isCorrect);
              setResponseTime(parsed.responseTime);
              setIsAttemptedToday(true);
            } catch {
              setIsAttemptedToday(false);
            }
          } else {
            setIsAttemptedToday(false);
          }
          setLoading(false);
        }
      }
    }

    loadDailyGameQuestion();
    return () => {
      isMounted = false;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [pktCycleStr, yearKey, isOfflineMode, storageKey, profile?.id]);

  // Determine Leader / Winner data for display (Only present if real winner/leader exists)
  const prevWinner = cloudPrevWinner;
  const baseTodayLeader = cloudTodayLeader;

  // Check if current user is leading today after solving
  const isUserLeadingToday = isAttemptedToday && isCorrect && (
    !baseTodayLeader || (responseTime > 0 && responseTime <= parseFloat(baseTodayLeader.time_taken))
  );

  const activeTodayLeader: PulseLeader | null = isUserLeadingToday ? {
    full_name: profile?.full_name || profile?.username || 'You',
    institute: profile?.institute || 'Medmacs',
    avatar_url: profile?.avatar_url || '',
    time_taken: `${responseTime.toFixed(1)}s`
  } : baseTodayLeader;

  const currentDisplayWinner: PulseLeader | null = !isAttemptedToday ? prevWinner : activeTodayLeader;
  const topLeadersList: PulseLeader[] = isAttemptedToday && cloudTodayLeaders.length > 0 
    ? cloudTodayLeaders 
    : (currentDisplayWinner ? [currentDisplayWinner] : []);

  // Open Bottom Modal & Start timer
  const handleLetsGo = () => {
    if (isAttemptedToday) return;
    setIsModalOpen(true);
    startTimeRef.current = Date.now();
    setResponseTime(0);

    timerRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      setResponseTime(Math.min(999, Math.round(elapsed * 10) / 10));
    }, 100);
  };

  // Submit Answer inside Modal
  const handleSelectOption = (option: string) => {
    if (isAttemptedToday || !selectedMCQ) return;

    if (timerRef.current) clearInterval(timerRef.current);
    const elapsedSeconds = (Date.now() - startTimeRef.current) / 1000;
    const finalTime = Math.max(0.4, Math.round(elapsedSeconds * 10) / 10);

    const actualCorrectText = resolveCorrectAnswerText(selectedMCQ.correct_answer, selectedMCQ.options);
    const correct = option.trim().toLowerCase() === actualCorrectText.trim().toLowerCase();
    
    setSelectedOption(option);
    setIsCorrect(correct);
    setResponseTime(finalTime);
    setIsAttemptedToday(true);

    // Save attempt to local storage
    localStorage.setItem(storageKey, JSON.stringify({
      selectedOption: option,
      isCorrect: correct,
      responseTime: finalTime,
      timestamp: Date.now()
    }));

    // Record attempt to Supabase directly if logged in
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await (supabase as any).from('daily_game_attempts').insert([{
            user_id: user.id,
            year: yearKey,
            cycle_date: pktCycleStr,
            selected_option: option,
            is_correct: correct,
            response_time_seconds: finalTime
          }]);
        }
      } catch {
        // Ignore Supabase direct insertion error
      }
    })();

    // Async record attempt to Cloudflare worker dailygame.medmacs.app
    fetch(`${DAILY_GAME_API_URL}/attempt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        year: yearKey,
        selectedOption: option,
        correctAnswer: selectedMCQ.correct_answer,
        responseTime: finalTime,
        cycle: pktCycleStr
      })
    }).catch(() => {});
  };

  const handleCloseModal = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsModalOpen(false);
  };

  if (loading) {
    return (
      <div className="w-full rounded-2xl border border-border/40 bg-card p-5 animate-pulse flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-4 w-32 bg-muted rounded"></div>
          <div className="h-3 w-48 bg-muted rounded"></div>
        </div>
        <div className="h-9 w-24 bg-muted rounded-xl"></div>
      </div>
    );
  }

  return (
    <>
      {/* Dashboard Card View with Pure Alpha Mask Image Fade & Right-Pinned Action Button */}
      <motion.div
        animate={!isAttemptedToday ? {
          boxShadow: [
            '0 0 10px rgba(245, 158, 11, 0.15)',
            '0 0 25px rgba(245, 158, 11, 0.45)',
            '0 0 10px rgba(245, 158, 11, 0.15)',
          ]
        } : {}}
        transition={!isAttemptedToday ? {
          duration: 2.2,
          repeat: Infinity,
          ease: 'easeInOut'
        } : {}}
        className={`relative overflow-hidden rounded-2xl border ${
          !isAttemptedToday
            ? 'border-amber-500/60 bg-gradient-to-br from-amber-500/20 via-card to-orange-500/15'
            : 'border-amber-500/25 bg-gradient-to-br from-amber-500/10 via-card to-orange-500/5'
        } p-4 sm:p-6 shadow-md transition-all`}
      >
        {/* Render Winner Picture Overlay ONLY if a winner/leader exists */}
        {currentDisplayWinner && (
          <div className="absolute top-0 right-0 bottom-0 w-48 sm:w-80 pointer-events-none overflow-hidden rounded-r-2xl mix-blend-multiply dark:mix-blend-luminosity [mask-image:linear-gradient(to_left,rgba(0,0,0,0.85)_0%,rgba(0,0,0,0.4)_50%,rgba(0,0,0,0)_100%)] [-webkit-mask-image:linear-gradient(to_left,rgba(0,0,0,0.85)_0%,rgba(0,0,0,0.4)_50%,rgba(0,0,0,0)_100%)]">
            {currentDisplayWinner.avatar_url && (
              <img
                src={currentDisplayWinner.avatar_url}
                alt={currentDisplayWinner.full_name}
                className="h-full w-full object-cover object-center opacity-80 dark:opacity-40 transition-all duration-700 hover:scale-105"
              />
            )}
          </div>
        )}

        {/* Yesterday's Winner Overlay (Only shown before attempt if winner exists) */}
        {!isAttemptedToday && currentDisplayWinner && (
          <div className="absolute top-3.5 right-4 text-right z-10 pointer-events-none drop-shadow-md">
            <span className="block text-[9px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Yesterday's Winner 🏆
            </span>
            <span className="block text-xs sm:text-sm font-black text-foreground truncate max-w-[150px]">
              {currentDisplayWinner.full_name}
            </span>
            {currentDisplayWinner.institute && (
              <span className="block text-[10px] font-extrabold text-muted-foreground truncate max-w-[150px]">
                {formatFullInstitute(currentDisplayWinner.institute)}
              </span>
            )}
            <span className="block text-[10px] sm:text-xs font-extrabold text-amber-600 dark:text-amber-400 font-mono">
              {currentDisplayWinner.time_taken}
            </span>
          </div>
        )}

        {/* Ambient Glow Accent */}
        {!isAttemptedToday && (
          <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-amber-500/20 blur-2xl animate-pulse" />
        )}

        <div className="relative z-10 flex items-center gap-2 mb-3">
          <motion.div
            animate={!isAttemptedToday ? { scale: [1, 1.15, 1] } : {}}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-sm"
          >
            {isAttemptedToday ? <Trophy className="h-4.5 w-4.5" /> : <Gamepad2 className="h-4.5 w-4.5" />}
          </motion.div>
          <span className="text-xs font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">
            {!isAttemptedToday ? 'Daily Game' : 'Daily Medmacs Pulse'}
          </span>
        </div>

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="min-w-0 flex-1 pr-2 sm:pr-4">
            {!isAttemptedToday && (
              <h3 className="text-xl sm:text-2xl font-black tracking-tight bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 bg-clip-text text-transparent drop-shadow-xs">
                Daily Medmacs Pulse
              </h3>
            )}

            {!isAttemptedToday ? (
              <p className="mt-1 text-xs sm:text-sm text-muted-foreground leading-relaxed font-medium">
                A random MCQ will be selected from each year. Refreshes 3:00 PM PKT daily.
              </p>
            ) : (
              /* Left-Side Today's Top 3 Leaders (1st in prominent shining font, 2nd & 3rd in smaller font) */
              topLeadersList.length > 0 ? (
                <div className="mt-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
                      Today's Top Leaders ⚡
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 px-2.5 py-0.5 text-[11px] font-black text-white shadow-xs font-mono">
                      <Timer className="h-3 w-3" />
                      {topLeadersList[0].time_taken}
                    </span>
                  </div>

                  {/* #1 Leader - Prominent Shining Gradient Name */}
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black text-amber-500">🥇</span>
                      <h3 className="text-xl sm:text-2xl font-black tracking-tight bg-gradient-to-r from-amber-500 via-amber-300 to-orange-500 bg-clip-text text-transparent drop-shadow-sm truncate">
                        {topLeadersList[0].full_name}
                      </h3>
                    </div>
                    {topLeadersList[0].institute && (
                      <p className="text-xs sm:text-sm font-extrabold text-muted-foreground leading-snug pl-5">
                        {formatFullInstitute(topLeadersList[0].institute)}
                      </p>
                    )}
                  </div>

                  {/* #2 & #3 Leaders - Always displayed (shows N/A if rank is empty) */}
                  <div className="pt-1.5 space-y-1.5 border-t border-border/30">
                    {[1, 2].map((rankIdx) => {
                      const leader = topLeadersList[rankIdx];
                      const medal = rankIdx === 1 ? '🥈' : '🥉';
                      return (
                        <div key={rankIdx} className="flex items-center justify-between text-xs font-bold text-muted-foreground gap-2">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="text-[11px] font-extrabold">{medal}</span>
                            {leader ? (
                              <>
                                <span className="truncate text-foreground font-extrabold text-[11px] sm:text-xs">
                                  {leader.full_name}
                                </span>
                                {leader.institute && (
                                  <span className="text-[10px] text-muted-foreground/80 truncate hidden sm:inline">
                                    ({formatFullInstitute(leader.institute)})
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="text-[11px] sm:text-xs font-semibold text-muted-foreground/60 italic">
                                N/A
                              </span>
                            )}
                          </div>
                          <span className={`text-[10px] font-extrabold font-mono shrink-0 px-1.5 py-0.5 rounded-md ${
                            leader ? 'text-amber-600 dark:text-amber-400 bg-amber-500/10' : 'text-muted-foreground/40 bg-muted/50'
                          }`}>
                            {leader ? leader.time_taken : 'N/A'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="mt-1 text-xs sm:text-sm text-muted-foreground leading-relaxed font-medium">
                  Completed today! Refreshes at 3:00 PM PKT.
                </p>
              )
            )}

            {/* Status Information & Past Winners link */}
            <div className="flex items-center gap-3 pt-3">
              {isAttemptedToday ? (
                isCorrect ? (
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-500">
                      <Check className="h-3 w-3" />
                    </div>
                    <span>Completed Today ({responseTime.toFixed(1)}s)</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs font-bold text-rose-600 dark:text-rose-400">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-500/20 text-rose-500">
                      <XCircle className="h-3.5 w-3.5" />
                    </div>
                    <span>Incorrect</span>
                  </div>
                )
              ) : (
                <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-amber-600/90 dark:text-amber-400/90 font-bold">
                  <Flame className="h-4 w-4 text-amber-500 animate-pulse" /> Same question for all Year {yearKey} students
                </div>
              )}

              {cloudPrevWinners.length > 0 && (
                <button
                  onClick={() => setIsPastWinnersOpen(true)}
                  className="flex items-center gap-1 text-[11px] font-extrabold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer transition-colors"
                >
                  <Trophy className="h-3 w-3 text-amber-500" />
                  <span>Past 3 Days ({cloudPrevWinners.length})</span>
                </button>
              )}
            </div>
          </div>

          {/* Action Button Pinned to Right Side */}
          <div className="shrink-0 z-10 self-start sm:self-center">
            {isAttemptedToday ? (
              <button
                disabled
                className="flex items-center gap-1.5 rounded-xl bg-muted px-5 py-2.5 text-xs font-bold text-muted-foreground opacity-80 pointer-events-none cursor-default shadow-xs"
              >
                {isCorrect ? (
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <XCircle className="h-3.5 w-3.5 text-rose-500" />
                )}
                <span>Done</span>
              </button>
            ) : (
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.95 }}
                animate={{
                  scale: [1, 1.03, 1],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: 'easeInOut'
                }}
                onClick={handleLetsGo}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 px-6 py-2.5 text-xs font-extrabold text-white shadow-lg shadow-amber-500/30 hover:brightness-110 active:scale-[0.98] transition-all"
              >
                <Sparkles className="h-3.5 w-3.5 animate-spin-slow" />
                <span>Let's go</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </motion.button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Past 3 Days Winners Modal */}
      <BottomSheet
        open={isPastWinnersOpen}
        onClose={() => setIsPastWinnersOpen(false)}
        eyebrow={`Year ${yearKey} Hall of Fame`}
        title="Past 3 Days Winners"
        description="Fastest correct responders for the past 3 daily game cycles."
        media={
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/20 text-amber-500">
            <Trophy className="h-5 w-5" />
          </div>
        }
      >
        <div className="space-y-3 pt-2">
          {cloudPrevWinners.map((winner, idx) => (
            <div
              key={winner.cycle_date || idx}
              className="flex items-center justify-between gap-3 p-3.5 rounded-2xl border border-amber-500/20 bg-amber-500/5 dark:bg-amber-500/10"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white font-black text-xs shadow-xs">
                  {idx === 0 ? '🏆' : idx === 1 ? '🥈' : '🥉'}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400 tracking-wider">
                      {winner.cycle_date || `Day -${idx + 1}`}
                    </span>
                  </div>
                  <div className="text-sm font-black text-foreground truncate">
                    {winner.full_name}
                  </div>
                  {winner.institute && (
                    <div className="text-xs font-bold text-muted-foreground truncate">
                      {formatFullInstitute(winner.institute)}
                    </div>
                  )}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-2.5 py-1 text-xs font-mono font-black text-white shadow-xs">
                  <Timer className="h-3 w-3" />
                  {winner.time_taken}
                </span>
              </div>
            </div>
          ))}
        </div>
      </BottomSheet>

      {/* Pinned Bottom Modal (Respecting bottom safe area) */}
      <BottomSheet
        open={isModalOpen}
        onClose={handleCloseModal}
        eyebrow={`Year ${yearKey}`}
        title="Daily Medmacs Pulse"
        description="Select the correct option as fast as you can! Top 3 fastest win."
        media={
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/20 text-amber-500">
            <Gamepad2 className="h-5 w-5" />
          </div>
        }
      >
        {selectedMCQ && (
          <div className="space-y-4 pt-1">
            {/* Question & Live Response Speed Header */}
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-border/40">
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                  {selectedMCQ.subject || `Year ${yearKey}`}
                </span>
                <h4 className="text-sm font-bold text-foreground leading-snug mt-1">
                  {selectedMCQ.question}
                </h4>
              </div>

              {/* Timer Badge */}
              {(!isAttemptedToday || isCorrect) && (
                <div className={`flex shrink-0 items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-black font-mono border ${
                  !isAttemptedToday
                    ? 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 animate-pulse'
                    : 'border-border/60 bg-muted/50 text-foreground'
                }`}>
                  <Timer className="h-3.5 w-3.5" />
                  <span>{responseTime.toFixed(1)}s</span>
                </div>
              )}
            </div>

            {/* 4 Strictly Formatted Options */}
            <div className="grid grid-cols-1 gap-2.5">
              {formattedOptions.map((opt, idx) => {
                const optLetter = String.fromCharCode(65 + idx); // A, B, C, D
                const isSelected = selectedOption === opt;
                const isCorrectOpt = opt.trim().toLowerCase() === selectedMCQ.correct_answer.trim().toLowerCase();

                let optionStyle = 'border-border/50 bg-background hover:bg-muted/40 text-foreground active:scale-[0.99]';

                if (isAttemptedToday) {
                  if (isCorrectOpt) {
                    optionStyle = 'border-emerald-500/60 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold';
                  } else if (isSelected && !isCorrect) {
                    optionStyle = 'border-rose-500/60 bg-rose-500/15 text-rose-700 dark:text-rose-300 font-bold';
                  } else {
                    optionStyle = 'border-border/20 bg-background/50 opacity-45 text-muted-foreground';
                  }
                }

                return (
                  <button
                    key={opt}
                    disabled={isAttemptedToday}
                    onClick={() => handleSelectOption(opt)}
                    className={`flex items-center gap-3 w-full text-left rounded-xl border p-3.5 text-xs transition-all ${optionStyle}`}
                  >
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold ${
                      isAttemptedToday && isCorrectOpt
                        ? 'bg-emerald-500 text-white'
                        : isAttemptedToday && isSelected && !isCorrect
                        ? 'bg-rose-500 text-white'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {optLetter}
                    </span>
                    <span className="flex-1 leading-snug">{opt}</span>
                    {isAttemptedToday && isCorrectOpt && (
                      <CheckCircle2 className="h-4.5 w-4.5 shrink-0 text-emerald-500" />
                    )}
                    {isAttemptedToday && isSelected && !isCorrect && (
                      <XCircle className="h-4.5 w-4.5 shrink-0 text-rose-500" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Post-attempt feedback banner */}
            {isAttemptedToday && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3 rounded-xl border border-border/50 bg-muted/40 p-3.5 mt-3"
              >
                <div className="flex items-center gap-2">
                  {isCorrect ? (
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      <span>Correct! Response time: <strong>{responseTime.toFixed(1)}s</strong></span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs font-bold text-rose-600 dark:text-rose-400">
                      <XCircle className="h-4 w-4 text-rose-500" />
                      <span>Incorrect!</span>
                    </div>
                  )}
                </div>

                <p className="text-[11px] text-muted-foreground leading-relaxed font-medium">
                  {isCorrect
                    ? `⚡ Outstanding speed! Top 3 fastest responses win daily rewards.`
                    : `The correct answer was: "${selectedMCQ.correct_answer}".`}
                </p>

                <div className="pt-2">
                  <button
                    onClick={handleCloseModal}
                    className="w-full rounded-xl bg-primary py-2.5 text-xs font-bold text-primary-foreground shadow-sm hover:brightness-110 active:scale-[0.98] transition-all"
                  >
                    Done
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        )}
      </BottomSheet>
    </>
  );
}
