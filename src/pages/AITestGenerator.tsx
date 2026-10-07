// @ts-nocheck
import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { ArrowRight, X, Sparkles, CheckCircle, XCircle, PanelLeft, AlertTriangle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import Seo from '@/components/Seo';
import { AIProgressTracker } from '@/components/ai/AIProgressTracker';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { motion, AnimatePresence } from 'framer-motion';
import { aiApiJson } from '@/utils/aiApi';
import { isAiLimitError } from '@/components/dashboard/personalization/FlashcardLimitModal';
import { LottiePlayer } from '@/components/LottiePlayer';
import openerLoadingAnimationData from '@/assets/animations/Opener Loading.json';
import { fetchSubjects, fetchChaptersBySubject, Subject, Chapter } from '@/utils/mcqData';

interface Question {
    question: string;
    options: string[];
    answer: string;
    explanation: string;
}

const topicMapping = (subjectNameOrCode?: string, subjectId?: string): string => {
    if (!subjectNameOrCode && !subjectId) return 'Foundation';
    const key = (subjectNameOrCode || subjectId || '').trim();
    const map: { [key: string]: string } = {
        "FND1": "Foundation", "Foundation": "Foundation", "Foundation Module": "Foundation",
        "HEM1": "Hematology", "Hematology": "Hematology", "Blood": "Hematology",
        "LCM1": "Locomotion", "Locomotion": "Locomotion", "Musculoskeletal": "Locomotion",
        "RSP1": "Respiratory System", "Respiratory System": "Respiratory System", "Respiratory": "Respiratory System",
        "CVS1": "Cardiovascular System", "Cardiovascular System": "Cardiovascular System", "CVS": "Cardiovascular System",
        "NEU1": "Neurosciences", "Neurosciences": "Neurosciences", "Neuroanatomy": "Neurosciences",
        "HNN1": "Head, Neck, and Special Senses", "Head, Neck, and Special Senses": "Head, Neck, and Special Senses",
        "END1": "Endocrinology", "Endocrinology": "Endocrinology",
        "GIL1": "Gastrointestinal Tract (GIT)", "Gastrointestinal Tract (GIT)": "Gastrointestinal Tract (GIT)", "GIT": "Gastrointestinal Tract (GIT)",
        "EXC1": "Renal and Excretory System", "Renal and Excretory System": "Renal and Excretory System", "Renal": "Renal and Excretory System",
        "REP1": "Reproductive System", "Reproductive System": "Reproductive System",
        "FND2": "Foundation II", "IDD1": "Infectious Diseases", "HEM2": "Hematology II", "RSP2": "Respiratory System II",
        "CVS2": "Cardiovascular System II", "GIL2": "GIT and Liver II", "END2": "Endocrinology II", "EXC2": "Renal and Excretory System II",
        "ORT2": "Orthopedics, Rheumatology, Trauma", "PMR": "Physical Medicine & Rehabilitation", "DPS": "Dermatology, Plastic Surgery/Burns",
        "GEN": "Genetics", "REP2": "Reproductive System II", "NEU2": "Neurosciences and Psychiatry", "ENT": "ENT (Otorhinolaryngology)", "OPH": "Ophthalmology",
        "MED": "Medicine Rotation", "SUR": "Surgery Rotation", "GYO": "Gynecology and Obstetrics Rotation", "PAE": "Pediatrics Rotation",
        "Anatomy": "Foundation", "Physiology": "Foundation", "Biochemistry": "Foundation",
        "Pharmacology": "Foundation II", "Pathology": "Foundation II", "Microbiology": "Infectious Diseases", "Forensic Medicine": "Foundation II",
        "Community Medicine": "Foundation II", "Ophthalmology": "Ophthalmology", "Otorhinolaryngology": "ENT (Otorhinolaryngology)",
        "Medicine": "Medicine Rotation", "Surgery": "Surgery Rotation", "Obstetrics & Gynaecology": "Gynecology and Obstetrics Rotation", "Paediatrics": "Pediatrics Rotation"
    };
    return map[key] || "Foundation";
};

const AITestGenerator: React.FC = () => {
    const { user, loading: authLoading } = useAuth();
    const navigate = useNavigate();

    const { data: profile, isLoading: planLoading } = useQuery({
        queryKey: ['plan_and_year', user?.id],
        queryFn: async () => {
            if (!user?.id) return null;
            const { data } = await supabase.from('profiles').select('plan, year, full_name, username').eq('id', user.id).single();
            return data;
        },
        enabled: !!user?.id, retry: false
    });

    const userYear = profile?.year || '1st';
    const hasAccess = !!user?.id;

    const [currentStep, setCurrentStep] = useState(1);
    const [selectedChapters, setSelectedChapters] = useState<string[]>([]);
    const [totalQ, setTotalQ] = useState(10);
    const [customPrompt, setCustomPrompt] = useState('');
    const [loading, setLoading] = useState(0);
    const [loadTime, setLoadTime] = useState(0);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [fetchedCount, setFetchedCount] = useState(0);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [idx, setIdx] = useState(0);
    const [answers, setAnswers] = useState<Record<number, string>>({});
    const [revealed, setRevealed] = useState<Record<number, boolean>>({});
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const batchTimerRef = useRef<NodeJS.Timeout | null>(null);
    const [showExitConfirm, setShowExitConfirm] = useState(false);

    // MCQ subjects & chapters state (same source as MCQ section)
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [loadingSubjects, setLoadingSubjects] = useState(true);
    const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
    const [chapters, setChapters] = useState<Chapter[]>([]);
    const [loadingChapters, setLoadingChapters] = useState(false);
    const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);

    const currentStepRef = useRef(currentStep);
    const submittedRef = useRef(submitted);
    const showExitConfirmRef = useRef(showExitConfirm);
    const isDrawerOpenRef = useRef(isDrawerOpen);
    const loadingRef = useRef(loading);

    useEffect(() => { currentStepRef.current = currentStep; }, [currentStep]);
    useEffect(() => { submittedRef.current = submitted; }, [submitted]);
    useEffect(() => { showExitConfirmRef.current = showExitConfirm; }, [showExitConfirm]);
    useEffect(() => { isDrawerOpenRef.current = isDrawerOpen; }, [isDrawerOpen]);
    useEffect(() => { loadingRef.current = loading; }, [loading]);

    // Fixed Capacitor back button handler
    useEffect(() => {
        let removeNativeListener: (() => void) | null = null;

        const setupBackHandler = async () => {
            try {
                const { Capacitor } = await import('@capacitor/core');
                if (Capacitor.isNativePlatform()) {
                    const { App } = await import('@capacitor/app');
                    const backListener = await App.addListener('backButton', () => {
                        if (showExitConfirmRef.current) {
                            setShowExitConfirm(false);
                            return;
                        }
                        if (isDrawerOpenRef.current) {
                            setIsDrawerOpen(false);
                            return;
                        }
                        if (currentStepRef.current > 1 && !submittedRef.current) {
                            setShowExitConfirm(true);
                            return;
                        }
                        if (currentStepRef.current === 1) {
                            window.history.back();
                            return;
                        }
                        window.history.back();
                    });
                    removeNativeListener = () => backListener.remove();
                }
            } catch (err) {
                console.debug('Capacitor not available, using web back button behavior');
            }
        };

        void setupBackHandler();
        return () => {
            if (removeNativeListener) removeNativeListener();
        };
    }, []);

    // Load MCQ subjects (exact same as MCQ section)
    useEffect(() => {
        let isMounted = true;
        const loadSubjectsData = async () => {
            setLoadingSubjects(true);
            try {
                const data = await fetchSubjects();
                if (isMounted && data && data.length > 0) {
                    setSubjects(data);
                }
            } catch (err) {
                console.error('Failed to load MCQ subjects for AI Test Generator:', err);
            } finally {
                if (isMounted) setLoadingSubjects(false);
            }
        };
        if (userYear) loadSubjectsData();
        return () => { isMounted = false; };
    }, [userYear]);

    const handleSubjectSelect = async (subj: Subject) => {
        if (selectedSubject?.id === subj.id) {
            setSelectedSubject(null);
            setChapters([]);
            setSelectedChapter(null);
            setSelectedChapters([]);
            return;
        }
        setSelectedSubject(subj);
        setSelectedChapter(null);
        setSelectedChapters([subj.name]);
        setError(null);
        setLoadingChapters(true);
        try {
            const chapterData = await fetchChaptersBySubject(subj.id);
            // Skip chapters labelled as Past Papers
            const filteredChapters = (chapterData || []).filter(ch => ch.content_type !== 'past_paper');
            setChapters(filteredChapters);
        } catch (err) {
            console.error('Failed to load chapters:', err);
            setChapters([]);
        } finally {
            setLoadingChapters(false);
        }
    };

    const handleChapterSelect = (chap: Chapter | null) => {
        setSelectedChapter(chap);
        if (chap) {
            setSelectedChapters([chap.name]);
        } else if (selectedSubject) {
            setSelectedChapters([selectedSubject.name]);
        }
        setError(null);
    };

    const handleConfirmChapters = () => {
        if (selectedChapters.length === 1) {
            setCurrentStep(2);
            setError(null);
        } else {
            setError('Please select a subject or chapter.');
        }
    };

    const handleConfirmQuestions = () => {
        if (totalQ > 0 && totalQ <= 100) setCurrentStep(3);
        else setError('Please enter 1-100 questions.');
    };

    const fetchBatch = async (batchSize: number, batchNumber: number, totalBatches: number) => {
        const apiTopic = topicMapping(selectedSubject?.name, selectedSubject?.id);
        const specificDetail = selectedChapter ? `Chapter: ${selectedChapter.name}` : (selectedSubject ? `Subject: ${selectedSubject.name}` : selectedChapters[0] || '');
        const data = await aiApiJson<any>('ai/generate-test', {
            topic: apiTopic,
            difficulty: 'medium',
            count: batchNumber === totalBatches ? (totalQ % 10 === 0 ? 10 : totalQ % 10) : batchSize,
            prompt: `Strictly adhere to the syllabus for ${userYear} year and specific topic/module/chapter: "${specificDetail}". Provide exactly 5 options (A, B, C, D, E) for each question. Batch ${batchNumber} of ${totalBatches}. ${customPrompt}`
        }, {});
        const rawQuestions = data?.questions || data?.Questions || (Array.isArray(data) ? data : []);
        return rawQuestions as Question[];
    };

    const fetchAll = async () => {
        setError(null);
        setLoading(1);
        setLoadTime(0);
        setQuestions([]);
        setFetchedCount(0);
        setIdx(0);
        setAnswers({});
        setRevealed({});
        setSubmitted(false);

        if (timerRef.current) clearInterval(timerRef.current);
        if (batchTimerRef.current) clearTimeout(batchTimerRef.current);
        timerRef.current = setInterval(() => setLoadTime(t => t + 1), 1000);

        const BATCH_SIZE = 10;
        const totalBatches = Math.ceil(totalQ / BATCH_SIZE);

        const fetchWithBatching = async (batchNumber: number) => {
            if (batchNumber > totalBatches) {
                setLoading(0);
                if (timerRef.current) clearInterval(timerRef.current);
                return;
            }

            try {
                const newQuestions = await fetchBatch(BATCH_SIZE, batchNumber, totalBatches);
                // Ensure every question has 5 options (A, B, C, D, E)
                const sanitizedQuestions = newQuestions.map(q => {
                    const opts = Array.isArray(q.options) ? [...q.options] : [];
                    while (opts.length < 5) {
                        opts.push(`None of the above`);
                    }
                    return { ...q, options: opts.slice(0, 5) };
                });
                const trimmedQuestions = sanitizedQuestions.slice(0, batchNumber === totalBatches ? (totalQ % 10 === 0 ? 10 : totalQ % 10) : BATCH_SIZE);

                setQuestions(prev => {
                    const combined = [...prev, ...trimmedQuestions];
                    return combined.slice(0, totalQ);
                });
                setFetchedCount(prev => Math.min(prev + trimmedQuestions.length, totalQ));
            } catch (e: any) {
                console.error('AI Test Generation Error:', e);
                if (isAiLimitError(e)) {
                    setLoading(0);
                    if (timerRef.current) clearInterval(timerRef.current);
                    return;
                }
                let errorMessage = 'Something went wrong. Please try again.';
                if (e.message.includes('network') || e.message.includes('fetch')) {
                    errorMessage = 'Network error. Please check your connection and try again.';
                } else if (e.message.includes('429') || e.message.includes('rate limit')) {
                    errorMessage = 'Too many requests. Please wait a moment and try again.';
                } else if (e.message.includes('500') || e.message.includes('server')) {
                    errorMessage = 'Server error. Please try again later or contact support.';
                } else if (e.message.includes('timeout')) {
                    errorMessage = 'Request timed out. Please try again.';
                } else if (e.message) {
                    errorMessage = e.message;
                }
                setError(errorMessage);
                setLoading(0);
                if (timerRef.current) clearInterval(timerRef.current);
                return;
            }

            if (batchNumber === 1) {
                setLoading(Math.round((batchNumber / totalBatches) * 100));
                setCurrentStep(4);
                if (batchNumber < totalBatches) {
                    batchTimerRef.current = setTimeout(() => fetchWithBatching(batchNumber + 1), 10000);
                } else {
                    setLoading(100);
                    if (timerRef.current) clearInterval(timerRef.current);
                }
            } else {
                setLoading(Math.round((batchNumber / totalBatches) * 100));
                if (batchNumber < totalBatches) {
                    batchTimerRef.current = setTimeout(() => fetchWithBatching(batchNumber + 1), 10000);
                } else {
                    setLoading(100);
                    if (timerRef.current) clearInterval(timerRef.current);
                }
            }
        };

        fetchWithBatching(1);
    };

    const select = (i: number, a: string) => !revealed[i] && setAnswers(s => ({ ...s, [i]: a }));

    const revealAnswer = () => {
        if (answers[idx]) {
            setRevealed(s => ({ ...s, [idx]: true }));
        }
    };

    const goToQuestion = (index: number) => {
        if (index >= 0 && index < questions.length && index < fetchedCount) {
            setIdx(index);
        }
    };

    const next = () => idx < questions.length - 1 && setIdx(idx + 1);
    const prev = () => idx > 0 && setIdx(idx - 1);
    const submit = async () => {
        setSubmitted(true);
        setCurrentStep(5);
        if (user) {
            const finalScore = questions.reduce((acc, q, i) => answers[i] === q.answer ? acc + 1 : acc, 0);
            const accuracy = questions.length > 0 ? parseFloat(((finalScore / questions.length) * 100).toFixed(2)) : 0;
            try {
                await supabase.from('ai_generated_tests').insert({
                    user_id: user.id,
                    topic: topicMapping(selectedChapters[0]),
                    difficulty: 'medium',
                    questions: questions,
                    total_questions: totalQ,
                    test_taken: true,
                    score: finalScore,
                    accuracy,
                });
            } catch (e) { console.error('Failed to save AI test result:', e); }
        }
    };
    const score = questions.reduce((acc, q, i) => answers[i] === q.answer ? acc + 1 : acc, 0);

    const startNewTest = () => {
        setQuestions([]);
        setIdx(0);
        setAnswers({});
        setRevealed({});
        setSubmitted(false);
        setTotalQ(10);
        setFetchedCount(0);
        setCustomPrompt('');
        setSelectedChapters([]);
        setSelectedSubject(null);
        setSelectedChapter(null);
        setError(null);
        setShowExitConfirm(false);
        setLoading(0);
        setLoadTime(0);
        setIsDrawerOpen(false);
        setCurrentStep(1);
        if (timerRef.current) clearInterval(timerRef.current);
        if (batchTimerRef.current) clearTimeout(batchTimerRef.current);
    };

    if (authLoading || planLoading) {
        return <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] dark:bg-gray-950"><img src="/lovable-uploads/bf69a7f7-550a-45a1-8808-a02fb889f8c5.png" alt="Loading" className="w-16 h-16 animate-pulse" /></div>;
    }
    if (!user) {
        return <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] dark:bg-gray-950"><Link to="/login"><Button>Sign In</Button></Link></div>;
    }

    return (
        <div className="fixed inset-0 bg-background flex flex-col overflow-hidden">
            <Seo title="AI Test Generator" description="Create custom AI practice tests on Medmacs App." canonical="https://medistics.app/ai/test-generator" />

            {/* Background decoration */}
            <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-accent/5 rounded-full blur-[120px] pointer-events-none" />

            <main className="flex-grow flex flex-col items-center px-4 pb-[env(safe-area-inset-bottom)] overflow-y-auto w-full relative z-10">
                <div className="w-full max-w-2xl">
                    {/* Step 1: Subject Selection */}
                    {hasAccess && questions.length === 0 && currentStep === 1 && (
                        <div>
                            {/* Main Title Section */}
                            <div className="text-center mb-6 sm:mb-8 animate-fade-in px-4">
                                <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-normal leading-[1.08] text-foreground uppercase italic mb-3 mt-[env(safe-area-inset-top)]">
                                    🧠 AI <span className="text-amber-500">Test</span> Generator
                                </h1>
                                <p className="text-muted-foreground text-xs uppercase tracking-[0.2em] max-w-2xl mx-auto">
                                    Create custom AI-powered practice tests on any medical topic
                                </p>
                            </div>

                            {/* AI Test Stats Peek */}
                            <div className="max-w-4xl mx-auto px-4 sm:px-0 mb-6">
                                <AIProgressTracker userId={user?.id} />
                            </div>

                            <motion.div
                                initial={{ opacity: 0, y: -20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="text-center mb-4 px-4"
                            >
                                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-500 mb-3 block">Step 1 of 3</span>
                            </motion.div>

                            <div className="sticky top-0 z-50 bg-background/45 dark:bg-background/20 backdrop-blur-xl pt-[env(safe-area-inset-top)] -mx-4 sm:mx-0 px-4 sm:px-0">
                                <div className="max-w-4xl mx-auto">
                                    <div className="pb-3">
                                        <h2 className="px-1 text-3xl sm:text-5xl font-black tracking-normal text-foreground uppercase italic leading-[1.08] text-center">
                                            Select <span className="heading-glyph-safe text-amber-500">Subject&nbsp;</span>
                                        </h2>
                                        <p className="text-muted-foreground text-sm font-medium mt-2 max-w-lg mx-auto text-center">
                                            Choose a subject or chapter to generate your AI-powered test
                                        </p>
                                    </div>
                                </div>
                                <div className="h-4 bg-gradient-to-b from-background/40 dark:from-background/10 to-transparent pointer-events-none" />
                            </div>

                            <div className="max-w-4xl mx-auto px-4 sm:px-0 pb-32 flex flex-col gap-4 mt-4">
                                {loadingSubjects ? (
                                    Array.from({ length: 4 }).map((_, i) => (
                                        <div key={i} className="relative overflow-hidden rounded-3xl bg-white/5 dark:bg-white/[0.035] backdrop-blur-xl p-6 animate-pulse border border-border/40">
                                            <div className="flex items-center gap-4">
                                                <div className="w-16 h-16 rounded-2xl bg-muted" />
                                                <div className="flex-1 space-y-2">
                                                    <div className="h-5 w-1/3 bg-muted rounded-full" />
                                                    <div className="h-3 w-2/3 bg-muted rounded-full" />
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : subjects.length === 0 ? (
                                    <div className="p-8 text-center text-muted-foreground bg-white/5 rounded-3xl border border-border/40">
                                        <p className="font-bold text-sm">No subjects found for your profile year.</p>
                                        <p className="text-xs mt-1">Make sure your MBBS year is selected in your profile.</p>
                                    </div>
                                ) : (
                                    subjects.map((subject, index) => {
                                        const isSubjectSelected = selectedSubject?.id === subject.id;
                                        return (
                                            <div key={subject.id} className="flex flex-col gap-2">
                                                <motion.div
                                                    initial={{ opacity: 0, scale: 0.98 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    transition={{ delay: index * 0.04 }}
                                                    whileHover={{ scale: 1.01, y: -2 }}
                                                    whileTap={{ scale: 0.99 }}
                                                    onClick={() => handleSubjectSelect(subject)}
                                                    className={`group cursor-pointer relative overflow-hidden rounded-3xl border-2 p-5 transition-all duration-300 ${isSubjectSelected
                                                        ? 'border-amber-500 bg-amber-500/5 shadow-xl shadow-amber-500/10'
                                                        : 'border-border/40 bg-white/5 dark:bg-white/[0.035] backdrop-blur-xl hover:border-amber-500/30 hover:bg-amber-500/5'
                                                        }`}
                                                >
                                                    {isSubjectSelected && (
                                                        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/20 blur-[60px] -mr-16 -mt-16 pointer-events-none" />
                                                    )}

                                                    <div className="flex items-center gap-4 relative z-10">
                                                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-lg transition-transform duration-300 group-hover:scale-110 ${isSubjectSelected ? 'bg-amber-500 text-white' : 'bg-muted/50 text-foreground/70'
                                                            }`}>
                                                            {subject.icon || '📚'}
                                                        </div>

                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 mb-0.5">
                                                                <h3 className={`text-lg font-black uppercase italic tracking-normal leading-snug transition-colors ${isSubjectSelected ? 'text-amber-500' : 'text-foreground'
                                                                    }`}>
                                                                    {subject.name}
                                                                </h3>
                                                                {isSubjectSelected && (
                                                                    <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                                                                )}
                                                            </div>
                                                            <p className="text-muted-foreground text-xs font-medium leading-relaxed">
                                                                {subject.year ? `${subject.year} Year` : 'MBBS Subject'} • Tap to select or pick chapter
                                                            </p>
                                                        </div>

                                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isSubjectSelected ? 'bg-amber-500 text-white' : 'bg-muted opacity-60 group-hover:opacity-100'
                                                            }`}>
                                                            <ArrowRight className={`w-4 h-4 transition-transform ${isSubjectSelected ? 'rotate-90' : ''}`} />
                                                        </div>
                                                    </div>
                                                </motion.div>

                                                {/* Expanded Chapter Selection */}
                                                <AnimatePresence>
                                                    {isSubjectSelected && (
                                                        <motion.div
                                                            initial={{ opacity: 0, height: 0 }}
                                                            animate={{ opacity: 1, height: 'auto' }}
                                                            exit={{ opacity: 0, height: 0 }}
                                                            className="overflow-hidden pl-4 pr-1 py-2 space-y-2 border-l-2 border-amber-500/40 ml-6"
                                                        >
                                                            <p className="text-[10px] font-black uppercase tracking-widest text-amber-500 mb-2">
                                                                Select Test Scope for {subject.name}:
                                                            </p>
                                                            
                                                            {/* All Chapters Option */}
                                                            <button
                                                                type="button"
                                                                onClick={() => handleChapterSelect(null)}
                                                                className={`w-full text-left p-3 rounded-2xl border transition-all text-xs font-bold flex items-center justify-between ${!selectedChapter
                                                                    ? 'border-amber-500 bg-amber-500/15 text-amber-600 dark:text-amber-400 font-extrabold shadow-sm'
                                                                    : 'border-border/30 bg-background/50 hover:bg-muted/40 text-foreground'
                                                                    }`}
                                                            >
                                                                <span>All Chapters (Full {subject.name})</span>
                                                                {!selectedChapter && <CheckCircle className="w-4 h-4 text-amber-500" />}
                                                            </button>

                                                            {loadingChapters ? (
                                                                <div className="py-4 text-center text-xs text-muted-foreground animate-pulse">
                                                                    Loading chapters...
                                                                </div>
                                                            ) : chapters.length === 0 ? (
                                                                <p className="text-xs text-muted-foreground p-2 italic">Full subject test selected</p>
                                                            ) : (
                                                                chapters.map(chap => {
                                                                    const isChapSelected = selectedChapter?.id === chap.id;
                                                                    return (
                                                                        <button
                                                                            key={chap.id}
                                                                            type="button"
                                                                            onClick={() => handleChapterSelect(chap)}
                                                                            className={`w-full text-left p-3 rounded-2xl border transition-all text-xs font-semibold flex items-center justify-between ${isChapSelected
                                                                                ? 'border-amber-500 bg-amber-500/15 text-amber-600 dark:text-amber-400 font-extrabold shadow-sm'
                                                                                : 'border-border/30 bg-background/40 hover:bg-muted/30 text-foreground/80'
                                                                                }`}
                                                                        >
                                                                            <span className="truncate pr-2">{chap.name}</span>
                                                                            {isChapSelected && <CheckCircle className="w-4 h-4 text-amber-500 shrink-0" />}
                                                                        </button>
                                                                    );
                                                                })
                                                            )}
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            <AnimatePresence>
                                {selectedChapters.length === 1 && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 100 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: 100 }}
                                        className="fixed bottom-0 left-0 right-0 px-6 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] z-50 flex justify-center pointer-events-none"
                                    >
                                        <div className="w-full max-w-md pointer-events-auto">
                                            <Button
                                                onClick={handleConfirmChapters}
                                                className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 text-white shadow-2xl shadow-amber-500/40 rounded-2xl h-16 uppercase font-black text-sm tracking-[0.2em] group transition-all"
                                                size="lg"
                                            >
                                                Continue to Questions
                                                <motion.div
                                                    animate={{ x: [0, 5, 0] }}
                                                    transition={{ duration: 1.5, repeat: Infinity }}
                                                >
                                                    <ArrowRight className="w-5 h-5 ml-2" />
                                                </motion.div>
                                            </Button>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <div className="text-center pt-20 pb-10 opacity-40">
                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">© 2026 Medmacs App • AI Test Generator</p>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Question Count */}
                    {hasAccess && questions.length === 0 && currentStep === 2 && (
                        <div>
                            <motion.div
                                initial={{ opacity: 0, y: -20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="text-center mb-4 px-4"
                            >
                                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-500 mb-3 block">Step 2 of 3</span>
                            </motion.div>

                            <div className="sticky top-0 z-50 bg-background/45 dark:bg-background/20 backdrop-blur-xl pt-[env(safe-area-inset-top)] -mx-4 sm:mx-0 px-4 sm:px-0">
                                <div className="max-w-4xl mx-auto">
                                    <div className="pb-3">
                                        <h2 className="px-1 text-3xl sm:text-5xl font-black tracking-normal text-foreground uppercase italic leading-[1.08] text-center">
                                             Number of <span className="text-amber-500">Questions</span>
                                         </h2>
                                         <div className="mt-2 flex flex-col items-center gap-1">
                                             <p className="text-muted-foreground text-sm font-bold uppercase tracking-widest">
                                                 {selectedChapter ? `${selectedSubject?.name || 'Subject'} • ${selectedChapter.name}` : selectedSubject?.name || selectedChapters[0] || 'Selected Subject'}
                                             </p>
                                             <p className="text-muted-foreground/60 text-[10px] font-medium uppercase tracking-[0.2em]">
                                                 {profile?.plan === 'free' ? 'Free daily limits apply' : 'Unlimited Premium Access'}
                                             </p>
                                         </div>
                                     </div>
                                 </div>
                                 <div className="h-4 bg-gradient-to-b from-background/40 dark:from-background/10 to-transparent pointer-events-none" />
                             </div>

                             <div className="max-w-4xl mx-auto px-4 sm:px-0">
                                 {/* Subject Preview Card */}
                                 <motion.div
                                     initial={{ opacity: 0, scale: 0.95 }}
                                     animate={{ opacity: 1, scale: 1 }}
                                     transition={{ delay: 0.05 }}
                                     className="relative overflow-hidden rounded-3xl border-2 border-amber-500/20 bg-amber-500/5 p-5 mb-8"
                                 >
                                     <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 blur-[60px] -mr-16 -mt-16 pointer-events-none" />
                                     <div className="flex items-center gap-5 relative z-10">
                                         <div className="w-16 h-16 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-xl shadow-amber-500/30 text-2xl">
                                             {selectedSubject?.icon || '🧠'}
                                         </div>
                                         <div className="flex-1 min-w-0">
                                             <p className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-500 mb-1">Selected Scope</p>
                                             <h3 className="text-xl font-black uppercase italic tracking-normal leading-snug text-foreground">
                                                 {selectedSubject?.name || selectedChapters[0] || 'Selected Subject'}
                                             </h3>
                                             <p className="text-muted-foreground text-xs font-medium leading-snug break-words">
                                                 {selectedChapter ? `Chapter: ${selectedChapter.name}` : 'Full Subject Practice'}
                                             </p>
                                         </div>
                                         <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0">
                                             <ArrowRight className="w-4 h-4" />
                                         </div>
                                     </div>
                                 </motion.div>

                                 {/* Question Count Options - Stacking single column */}
                                 <div className="grid grid-cols-1 gap-3 mb-6">
                                    {[
                                        { num: 5, label: 'Quick Review', desc: 'Fast practice session' },
                                        { num: 10, label: 'Short Test', desc: 'Brief assessment' },
                                        { num: 20, label: 'Full Practice', desc: 'Comprehensive test' },
                                        { num: 50, label: 'Extended Practice', desc: 'Deep learning session' },
                                        { num: 100, label: 'Marathon Session', desc: 'Maximum practice' }
                                    ].map((item, idx) => {
                                        const isSelected = totalQ === item.num;
                                        return (
                                            <motion.div
                                                key={item.num}
                                                initial={{ opacity: 0, scale: 0.95 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                transition={{ delay: 0.1 + idx * 0.04 }}
                                                whileHover={{ scale: 1.02, x: 5 }}
                                                whileTap={{ scale: 0.98 }}
                                                onClick={() => setTotalQ(item.num)}
                                                className={`group cursor-pointer relative overflow-hidden rounded-2xl border-2 p-4 transition-all duration-300 ${isSelected
                                                    ? 'border-amber-500 bg-amber-500/5 shadow-xl shadow-amber-500/10'
                                                    : 'border-border/40 bg-white/5 dark:bg-white/[0.035] backdrop-blur-xl hover:border-amber-500/30 hover:bg-amber-500/5'
                                                    }`}
                                            >
                                                {isSelected && (
                                                    <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/20 blur-[50px] -mr-12 -mt-12 pointer-events-none" />
                                                )}

                                                <div className="flex items-center gap-4 relative z-10">
                                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-all ${isSelected ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30' : 'bg-muted/50 text-foreground/70'
                                                        }`}>
                                                        <span className="font-black text-lg">{item.num}</span>
                                                    </div>

                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-0.5">
                                                            <h3 className={`text-sm font-black uppercase italic tracking-normal leading-snug transition-colors ${isSelected ? 'text-amber-500' : 'text-foreground'
                                                                }`}>
                                                                {item.label}
                                                            </h3>
                                                            {isSelected && (
                                                                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                                                            )}
                                                        </div>
                                                        <p className="text-muted-foreground text-xs font-medium leading-relaxed line-clamp-1">
                                                            {item.desc}
                                                        </p>
                                                    </div>

                                                    <div className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${isSelected ? 'bg-amber-500/10 text-amber-500' : 'bg-muted/50 text-muted-foreground/60 opacity-0 group-hover:opacity-100'
                                                        }`}>
                                                        Qs
                                                    </div>
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            </div>

                            <AnimatePresence>
                                {totalQ > 0 && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 100 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: 100 }}
                                        className="fixed bottom-0 left-0 right-0 px-6 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] z-50 flex justify-center pointer-events-none"
                                    >
                                        <div className="w-full max-w-md pointer-events-auto flex gap-3">
                                            <Button onClick={() => setCurrentStep(1)} variant="outline" className="flex-1 rounded-2xl h-16 font-black uppercase text-sm tracking-[0.2em]">Back</Button>
                                            <Button onClick={handleConfirmQuestions} className="flex-1 bg-gradient-to-r from-amber-500 to-yellow-500 text-white rounded-2xl h-16 font-black uppercase text-sm tracking-[0.2em] shadow-2xl shadow-amber-500/30 group transition-all">
                                                Confirm
                                                <motion.div
                                                    animate={{ x: [0, 5, 0] }}
                                                    transition={{ duration: 1.5, repeat: Infinity }}
                                                >
                                                    <ArrowRight className="w-5 h-5 ml-2" />
                                                </motion.div>
                                            </Button>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <div className="text-center pt-20 pb-10 opacity-40">
                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">© 2026 Medmacs App • AI Test Generator</p>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Custom Prompt */}
                    {hasAccess && questions.length === 0 && currentStep === 3 && (
                        <div className="max-w-4xl mx-auto px-4 sm:px-0">
                            <motion.div
                                initial={{ opacity: 0, y: -20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="text-center mb-4 px-4"
                            >
                                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-500 mb-3 block">Step 3 of 3</span>
                            </motion.div>

                            <div className="sticky top-0 z-50 bg-background/45 dark:bg-background/20 backdrop-blur-xl pt-[env(safe-area-inset-top)] -mx-4 sm:mx-0 px-4 sm:px-0">
                                <div className="max-w-4xl mx-auto">
                                    <div className="pb-3">
                                        <h2 className="px-1 text-3xl sm:text-5xl font-black tracking-normal text-foreground uppercase italic leading-[1.08] text-center">
                                            Custom <span className="text-amber-500">Prompt</span>
                                        </h2>
                                        <p className="text-muted-foreground text-sm font-medium mt-2 max-w-lg mx-auto text-center">
                                            Optional instructions for AI
                                        </p>
                                    </div>
                                </div>
                                <div className="h-4 bg-gradient-to-b from-background/40 dark:from-background/10 to-transparent pointer-events-none" />
                            </div>

                            {/* Subject Preview Card */}
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.05 }}
                                className="relative overflow-hidden rounded-3xl border-2 border-amber-500/20 bg-amber-500/5 p-5 mb-8 mt-4"
                            >
                                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 blur-[60px] -mr-16 -mt-16 pointer-events-none" />
                                <div className="flex items-center gap-5 relative z-10">
                                    <div className="w-16 h-16 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-xl shadow-amber-500/30 text-2xl">
                                        🧠
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-500 mb-1">Generating Test</p>
                                        <h3 className="text-xl font-black uppercase italic tracking-normal leading-snug text-foreground">
                                            {selectedSubject?.name || selectedChapters[0] || 'Selected Subject'}
                                        </h3>
                                        <p className="text-muted-foreground text-xs font-medium leading-snug break-words">
                                            {selectedChapter ? `Chapter: ${selectedChapter.name} • ${totalQ} Questions` : `${totalQ} AI Generated Questions`}
                                        </p>
                                    </div>
                                    <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0">
                                        <ArrowRight className="w-4 h-4" />
                                    </div>
                                </div>
                            </motion.div>

                            {/* Prompt Input */}
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 }}
                                className="mb-6"
                            >
                                <div className="flex items-center gap-2 mb-3">
                                    <Sparkles className="w-4 h-4 text-amber-500" />
                                    <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Add Custom Instructions (Optional)</p>
                                </div>
                                <textarea
                                    rows={4}
                                    placeholder="e.g., Focus on clinical scenarios, include more diagrams..."
                                    value={customPrompt}
                                    onChange={e => setCustomPrompt(e.target.value)}
                                    className="w-full p-4 rounded-2xl border-2 border-border/40 bg-muted/20 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 transition-all resize-none"
                                />
                            </motion.div>

                            {error && <p className="text-destructive text-sm text-center mb-4">{error}</p>}

                            <AnimatePresence>
                                <motion.div
                                    initial={{ opacity: 0, y: 100 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 100 }}
                                    className="fixed bottom-0 left-0 right-0 p-6 pb-[env(safe-area-inset-bottom)] z-50 flex justify-center pointer-events-none"
                                >
                                    <div className="w-full max-w-md pointer-events-auto flex gap-3">
                                        <Button onClick={() => setCurrentStep(2)} variant="outline" className="flex-1 rounded-2xl h-16 font-black uppercase text-sm tracking-[0.2em]">Back</Button>
                                        <Button onClick={fetchAll} disabled={loading > 0} className="flex-1 bg-gradient-to-r from-amber-500 to-yellow-500 text-white rounded-2xl h-16 font-black uppercase text-sm tracking-[0.2em] shadow-2xl shadow-amber-500/30 group transition-all">
                                            Start Test
                                            <motion.div
                                                animate={{ x: [0, 5, 0] }}
                                                transition={{ duration: 1.5, repeat: Infinity }}
                                            >
                                                <ArrowRight className="w-5 h-5 ml-2" />
                                            </motion.div>
                                        </Button>
                                    </div>
                                </motion.div>
                            </AnimatePresence>

                            {/* Bottom Pinned Generating Test / Error Modal */}
                            <Sheet open={loading > 0 || (currentStep === 3 && !!error)} onOpenChange={(open) => { if (!open && !loading) setError(null); }}>
                                <SheetContent side="bottom" className={`rounded-t-[2.5rem] border-t backdrop-blur-2xl p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] z-[110] outline-none [&>button]:hidden transition-colors ${
                                    error ? 'border-destructive/40 bg-background/95' : 'border-amber-500/30 bg-background/95'
                                }`}>
                                    {error ? (
                                        <div className="flex flex-col items-center justify-center text-center space-y-4 py-2">
                                            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
                                                <AlertTriangle className="w-8 h-8" />
                                            </div>
                                            <SheetHeader className="text-center space-y-1">
                                                <SheetTitle className="text-xl font-black uppercase italic tracking-tight text-destructive">
                                                    Generation Failed
                                                </SheetTitle>
                                                <SheetDescription className="text-xs text-muted-foreground font-medium max-w-sm mx-auto">
                                                    {error}
                                                </SheetDescription>
                                            </SheetHeader>
                                            <div className="flex gap-3 w-full max-w-xs pt-2">
                                                <Button
                                                    variant="outline"
                                                    onClick={() => setError(null)}
                                                    className="flex-1 rounded-2xl h-12 font-bold uppercase tracking-wider text-xs"
                                                >
                                                    Dismiss
                                                </Button>
                                                <Button
                                                    onClick={() => {
                                                        setError(null);
                                                        fetchAll();
                                                    }}
                                                    className="flex-1 rounded-2xl h-12 font-black uppercase tracking-wider text-xs bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/20"
                                                >
                                                    Try Again
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <SheetHeader className="text-center space-y-1">
                                                <SheetTitle className="text-xl font-black uppercase italic tracking-tight text-foreground">
                                                    Generating <span className="text-amber-500">Your Test</span>
                                                </SheetTitle>
                                                <SheetDescription className="text-xs text-muted-foreground font-medium">
                                                    Please wait while AI prepares your custom practice test
                                                </SheetDescription>
                                            </SheetHeader>
                                            <div className="flex flex-col items-center justify-center py-4 space-y-3">
                                                <div className="w-40 h-40 flex items-center justify-center">
                                                    <LottiePlayer
                                                        animationData={openerLoadingAnimationData}
                                                        loop={true}
                                                        autoplay={true}
                                                        className="w-full h-full"
                                                    />
                                                </div>
                                                <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 px-4 py-1.5 rounded-full">
                                                    <div className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                                                    <span className="text-xs font-black uppercase tracking-widest text-amber-500">
                                                        {selectedChapter ? selectedChapter.name : selectedSubject?.name || 'Medical Test'}
                                                    </span>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </SheetContent>
                            </Sheet>
                        </div>
                    )}

                    {/* Step 4: Test Taking */}
                    {hasAccess && questions.length > 0 && currentStep === 4 && (
                        <div className="flex flex-col flex-1 w-full max-w-2xl pt-[env(safe-area-inset-top)]">
                            {/* Question Map Drawer - Outside AnimatePresence */}
                            <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
                                <SheetContent side="left" className="w-[280px] sm:w-[320px] p-0 border-r border-amber-200 dark:border-amber-800 bg-background/95 backdrop-blur-xl flex flex-col z-[101]">
                                    <SheetHeader className="p-6 border-b border-amber-200 dark:border-amber-800">
                                        <SheetTitle className="text-xl font-black italic tracking-tight">Question <span className="text-amber-500">Map</span></SheetTitle>
                                        <SheetDescription className="text-xs text-muted-foreground">{fetchedCount} of {totalQ} loaded</SheetDescription>
                                    </SheetHeader>
                                    <div className="flex-grow overflow-y-auto p-6">
                                        <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                                            {Array.from({ length: totalQ }).map((_, index) => {
                                                const isAnswered = index in answers;
                                                const isCurrent = idx === index;
                                                const isLoaded = index < fetchedCount;

                                                if (!isLoaded) {
                                                    return (
                                                        <Skeleton key={`skeleton-${index}`} className="w-full h-10 rounded-xl" />
                                                    );
                                                }

                                                return (
                                                    <Button
                                                        key={`qmap-${index}`}
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => {
                                                            setIdx(index);
                                                            setIsDrawerOpen(false);
                                                        }}
                                                        className={`w-full h-10 rounded-xl text-sm font-bold transition-all ${isCurrent
                                                            ? 'bg-gradient-to-br from-amber-500 to-yellow-500 text-white border-transparent shadow-lg'
                                                            : isAnswered
                                                                ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                                                                : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                                            }`}
                                                    >
                                                        {index + 1}
                                                    </Button>
                                                );
                                            })}
                                        </div>
                                        <div className="mt-4 text-xs text-muted-foreground space-y-1.5">
                                            <p className="flex items-center"><span className="inline-block w-3 h-3 rounded-full bg-gradient-to-br from-amber-500 to-yellow-500 mr-2" />Current</p>
                                            <p className="flex items-center"><span className="inline-block w-3 h-3 rounded-full bg-emerald-500 mr-2" />Answered</p>
                                            <p className="flex items-center"><span className="inline-block w-3 h-3 rounded-full bg-muted mr-2" />Unanswered</p>
                                            <p className="flex items-center"><span className="inline-block w-3 h-3 rounded-full bg-muted animate-pulse mr-2" />Loading</p>
                                        </div>
                                    </div>
                                </SheetContent>
                            </Sheet>

                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={`question-wrapper-${idx}`}
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="flex flex-col flex-1"
                                >
                                    {/* Question Header Info */}
                                    <div className="flex items-center justify-between mb-6">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">
                                                Question {idx + 1} of {totalQ}
                                                {fetchedCount < totalQ && <span className="text-amber-500 ml-1">({fetchedCount} loaded)</span>}
                                            </span>
                                            <div className="flex items-center gap-2 mt-1">
                                                <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full">
                                                    <Sparkles className="w-3 h-3 text-amber-500" />
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-amber-500">AI Generated</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button variant="ghost" size="icon" onClick={() => setIsDrawerOpen(true)} className="w-10 h-10 rounded-xl bg-slate-200/90 dark:bg-slate-800/90 hover:bg-slate-300 dark:hover:bg-slate-700 text-foreground border border-border/50 shadow-sm">
                                                <PanelLeft className="w-5 h-5" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => setShowExitConfirm(true)} className="w-10 h-10 rounded-xl bg-slate-200/90 dark:bg-slate-800/90 hover:bg-slate-300 dark:hover:bg-slate-700 text-foreground border border-border/50 shadow-sm">
                                                <X className="w-5 h-5" />
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Question Text */}
                                    <h2 className="text-xl sm:text-2xl font-black text-foreground leading-[1.3] tracking-tight mb-8">
                                        {questions[idx]?.question || 'Loading...'}
                                    </h2>

                                    {/* Options List */}
                                    <div className="space-y-4 mb-8">
                                        {questions[idx]?.options.map((opt, i) => {
                                            const isSelected = answers[idx] === opt;
                                            const isCorrectOption = opt === questions[idx].answer;
                                            const isRevealed = revealed[idx];

                                            let state: 'default' | 'selected' | 'correct' | 'incorrect' = 'default';
                                            if (isRevealed) {
                                                if (isCorrectOption) state = 'correct';
                                                else if (isSelected) state = 'incorrect';
                                            } else if (isSelected) {
                                                state = 'selected';
                                            }

                                            let animation: { scale?: number[]; x?: number[]; transition?: { duration?: number } } = {};
                                            if (isRevealed) {
                                                if (isCorrectOption) {
                                                    animation = { scale: [1, 1.08, 1], transition: { duration: 0.4 } };
                                                } else if (isSelected) {
                                                    animation = { x: [-6, 6, -6, 6, 0], transition: { duration: 0.4 } };
                                                }
                                            }

                                            const optionKey = opt ? `option-${idx}-${i}` : `option-empty-${idx}-${i}`;

                                            return (
                                                <motion.button
                                                    key={optionKey}
                                                    onClick={() => select(idx, opt)}
                                                    disabled={isRevealed || !opt}
                                                    animate={animation}
                                                    whileTap={{ scale: 0.98 }}
                                                    className={`group relative w-full p-5 rounded-[1.8rem] text-left border-2 transition-all duration-300 ${state === 'default'
                                                        ? 'bg-muted/10 border-transparent hover:bg-muted/20 hover:border-muted'
                                                        : state === 'selected'
                                                            ? 'bg-amber-500/10 border-amber-500 shadow-[0_10px_30px_rgba(20,184,166,0.1)]'
                                                            : state === 'correct'
                                                                ? 'bg-emerald-500/10 border-emerald-500 shadow-[0_10px_25px_rgba(16,185,129,0.15)] z-20 scale-[1.01]'
                                                                : 'bg-destructive/10 border-destructive shadow-[0_10px_25px_rgba(239,68,68,0.15)]'
                                                        }`}
                                                >
                                                    <div className="flex items-center justify-between gap-4">
                                                        <div className="flex-1 flex gap-4 items-start">
                                                            <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-[11px] font-black transition-colors shrink-0 ${state === 'default' ? 'bg-muted/20 text-muted-foreground' :
                                                                state === 'correct' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30' :
                                                                    state === 'incorrect' ? 'bg-destructive text-white shadow-lg shadow-destructive/30' : 'bg-amber-600 text-white shadow-lg shadow-amber-500/30'
                                                                }`}>
                                                                {String.fromCharCode(65 + i)}
                                                            </span>
                                                            <span className={`text-base font-bold leading-snug transition-colors ${state === 'default' ? 'text-foreground/80' :
                                                                state === 'correct' ? 'text-emerald-700 dark:text-emerald-300' :
                                                                    state === 'incorrect' ? 'text-destructive' : 'text-amber-500'
                                                                }`}>
                                                                {opt || 'Loading...'}
                                                            </span>
                                                        </div>
                                                        <div className="shrink-0">
                                                            {isRevealed && isCorrectOption && <motion.div initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring" }}><CheckCircle className="w-5 h-5 text-emerald-500" /></motion.div>}
                                                            {isRevealed && isSelected && !isCorrectOption && <motion.div initial={{ scale: 0, rotate: 20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring" }}><XCircle className="w-5 h-5 text-destructive" /></motion.div>}
                                                        </div>
                                                    </div>
                                                </motion.button>
                                            );
                                        })}
                                    </div>

                                    {/* Explanation / Result */}
                                    {revealed[idx] && questions[idx] && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="mb-28 p-6 rounded-[2rem] bg-muted/20 border border-border/40 backdrop-blur-md shadow-sm"
                                        >
                                            <div className="flex items-center gap-2 mb-3">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${answers[idx] === questions[idx].answer ? 'bg-emerald-500/10' : 'bg-destructive/10'}`}>
                                                    {answers[idx] === questions[idx].answer ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-destructive" />}
                                                </div>
                                                <h4 className="text-xs font-black uppercase tracking-widest text-foreground">
                                                    {answers[idx] === questions[idx].answer ? 'Correct Answer' : 'Incorrect Answer'}
                                                </h4>
                                            </div>
                                            <p className="text-sm text-muted-foreground leading-relaxed font-medium mt-2">
                                                {questions[idx].explanation}
                                            </p>
                                        </motion.div>
                                    )}

                                    {/* Best of Luck Wish */}
                                    {!answers[idx] && !revealed[idx] && (
                                        <div className="mt-12 text-center space-y-2 animate-in fade-in slide-in-from-bottom-4 duration-1000">
                                            <h3 className="text-2xl font-black italic tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500">
                                                Best of Luck, {profile?.username || 'Student'}!
                                            </h3>
                                            <p className="text-[10px] uppercase tracking-[0.4em] font-bold text-slate-400">
                                                Prepared specifically for {profile?.full_name}
                                            </p>
                                        </div>
                                    )}
                                </motion.div>
                            </AnimatePresence>

                            {/* Floating Buttons */}
                            <div className="fixed bottom-0 left-0 right-0 px-6 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] z-50 flex justify-center pointer-events-none">
                                <div className="w-full max-w-md pointer-events-auto flex gap-3">
                                    {answers[idx] && !revealed[idx] ? (
                                        <Button
                                            onClick={revealAnswer}
                                            className="flex-1 rounded-2xl h-16 bg-amber-600 text-white font-black uppercase text-sm tracking-[0.2em] shadow-2xl shadow-amber-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all"
                                        >
                                            Submit Answer
                                        </Button>
                                    ) : revealed[idx] ? (
                                        <>
                                            <Button
                                                variant="outline"
                                                onClick={prev}
                                                disabled={idx === 0}
                                                className="flex-1 rounded-2xl h-16 font-black uppercase text-sm tracking-[0.2em]"
                                            >
                                                Previous
                                            </Button>
                                            {idx < fetchedCount - 1 ? (
                                                <Button
                                                    onClick={next}
                                                    disabled={idx + 1 >= fetchedCount}
                                                    className="flex-1 rounded-2xl h-16 bg-foreground text-background font-black uppercase text-sm tracking-[0.2em] shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all"
                                                >
                                                    {idx + 1 >= fetchedCount - 1 ? 'Last Question' : 'Next Question'}
                                                </Button>
                                            ) : fetchedCount >= totalQ ? (
                                                <Button
                                                    onClick={submit}
                                                    className="flex-1 rounded-2xl h-16 bg-gradient-to-r from-amber-500 to-emerald-500 text-white font-black uppercase text-sm tracking-[0.2em] shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all"
                                                >
                                                    Finish Test
                                                </Button>
                                            ) : (
                                                <Button
                                                    disabled
                                                    className="flex-1 rounded-2xl h-16 bg-muted text-muted-foreground font-black uppercase text-sm tracking-[0.2em]"
                                                >
                                                    Loading...
                                                </Button>
                                            )}
                                        </>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 5: Score */}
                    {hasAccess && currentStep === 5 && (
                        <div>
                            <motion.div
                                initial={{ opacity: 0, y: -20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="text-center mb-4 px-4"
                            >
                                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-500 mb-3 block">Test Completed</span>
                            </motion.div>

                            <div className="sticky top-0 z-50 bg-background/45 dark:bg-background/20 backdrop-blur-xl pt-[env(safe-area-inset-top)] -mx-4 sm:mx-0 px-4 sm:px-0">
                                <div className="max-w-4xl mx-auto">
                                    <div className="pb-3">
                                        <h2 className="px-1 text-3xl sm:text-5xl font-black tracking-normal text-foreground uppercase italic leading-[1.08] text-center">
                                            Your <span className="text-amber-500">Result</span>
                                        </h2>
                                        <p className="text-muted-foreground text-sm font-medium mt-2 max-w-lg mx-auto text-center">
                                            Test completed successfully
                                        </p>
                                    </div>
                                </div>
                                <div className="h-4 bg-gradient-to-b from-background/40 dark:from-background/10 to-transparent pointer-events-none" />
                            </div>

                            <div className="max-w-4xl mx-auto px-4 sm:px-0">
                                <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-amber-500 via-yellow-500 to-amber-600 text-white shadow-2xl p-1 mb-8 mt-4">
                                    <div className="absolute inset-0 opacity-10" style={{ backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 20px, rgba(255,255,255,0.4) 20px, rgba(255,255,255,0.4) 40px)`, maskImage: 'radial-gradient(circle at center, black 30%, transparent 80%)' }} />
                                    <div className="relative z-10 bg-white/10 backdrop-blur-xl rounded-[1.8rem] p-8 border border-white/10">
                                        <div className="text-center mb-6">
                                            <div className="w-28 h-28 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4">
                                                <span className="text-5xl font-black">{score}</span>
                                            </div>
                                            <p className="text-lg font-bold">out of {totalQ}</p>
                                            <p className="text-sm text-white/70 mt-1">Accuracy: {totalQ > 0 ? Math.round((score / totalQ) * 100) : 0}%</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-col sm:flex-row gap-3 justify-center pb-8 pb-[env(safe-area-inset-bottom)]">
                                    <Button onClick={startNewTest} className="bg-gradient-to-r from-amber-500 to-yellow-500 text-white rounded-2xl h-12 px-8 font-black uppercase text-xs tracking-widest">New Test</Button>
                                    <Link to="/dashboard"><Button variant="outline" className="rounded-2xl h-12 px-8 font-black uppercase text-xs tracking-widest">Dashboard</Button></Link>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Exit Confirmation Bottom Sheet (Forked from MCQs) */}
                    <Sheet open={showExitConfirm} onOpenChange={(open) => { if (!open) setShowExitConfirm(false); }}>
                        <SheetContent side="bottom" className="mx-auto max-h-[88dvh] overflow-y-auto rounded-t-[2rem] border-x border-t border-red-200 dark:border-red-900 bg-background/95 p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] backdrop-blur-2xl max-w-lg w-full z-[300]" overlayClassName="z-[300]">
                            <div className="w-12 h-1.5 bg-muted-foreground/30 rounded-full mx-auto mb-4" aria-hidden="true" />
                            <div className="flex flex-col items-center text-center">
                                <div className="mb-4 w-16 h-16 rounded-full bg-red-100 dark:bg-red-950 flex items-center justify-center shadow-inner">
                                    <AlertTriangle className="w-8 h-8 text-red-500" />
                                </div>
                                <SheetHeader className="text-center sm:text-center">
                                    <SheetTitle className="text-xl font-bold font-syne">Leave Session?</SheetTitle>
                                    <SheetDescription className="text-sm text-zinc-500 dark:text-zinc-400">
                                        Your progress will be lost if you leave this session.
                                    </SheetDescription>
                                </SheetHeader>
                                <div className="flex flex-col-reverse sm:flex-row gap-3 w-full mt-6">
                                    <Button onClick={() => setShowExitConfirm(false)} variant="outline" className="flex-1 rounded-2xl h-12 font-bold uppercase tracking-wider text-xs">Cancel</Button>
                                    <Button onClick={startNewTest} className="flex-1 rounded-2xl h-12 font-black uppercase tracking-wider text-xs bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/20">Leave Test</Button>
                                </div>
                            </div>
                        </SheetContent>
                    </Sheet>
                </div>
            </main>
        </div>
    );
};

export default AITestGenerator;
