import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import {
  ChevronRight, ChevronLeft, HelpCircle, ArrowRight, Stethoscope
} from "lucide-react";
import AppTransitionScreen from "@/components/AppTransitionScreen";

const BOTTOM_SAFE_CLEARANCE = "max(12px, env(safe-area-inset-bottom, 0px))";
const WIZARD_SEEN_KEY = "medmacs.indexWizard.seen.v2";
const LEGACY_WIZARD_SEEN_KEY = "hasSeenWizard";

const STEPS = [
  {
    eyebrow: "",
    title: "Welcome to Medmacs",
    description: "",
    mascot: "",
    action: "intro"
  },
  {
    eyebrow: "Welcome to Medmacs",
    title: "MBBS, FCPS and NRE Library",
    description: "Built for medical students who want focused practice, stronger recall, and better exam performance.",
    mascot: "/mascots/Mascot9.png",
    action: "wave"
  },
  {
    eyebrow: "Study with confidence",
    title: "Live References & Validation",
    description: "Every important MCQ is backed by syllabus books, explanations, and verifiable learning context.",
    mascot: "/mascots/Mascot13.png",
    action: "confused"
  },
  {
    eyebrow: "Your AI study partner",
    title: "Meet Dr Ahroid",
    description: "Pakistan's advanced medical AI, trained to explain concepts with the depth and clarity medical students need.",
    mascot: "/mascots/Mascot6.png",
    action: "phone"
  },
  {
    eyebrow: "Practice smarter",
    title: "Compete. Analyze. Grow.",
    description: "Turn daily practice into measurable progress with battles, smart tests, rankings, and in-depth analytics.",
    mascot: "/mascots/Mascot10.png",
    action: "stethoscope"
  },
  {
    eyebrow: "Your medical success",
    title: "Starts Today",
    description: "Join Medmacs and build a learning experience around your year, goals, and exam journey.",
    mascot: "/mascots/Mascot14.png",
    action: "thumbs"
  }
];

function StepVisual({ action, mascot }: { action: string; mascot: string }) {
  const actionMotion = {
    wave: {
      animate: { rotate: [0, -2.5, 2.5, -1.5, 0], x: [0, -3, 3, -2, 0] },
      transition: { delay: .55, duration: 1.1, ease: "easeInOut" as const },
    },
    book: {
      animate: { rotateY: [18, -5, 0], scale: [.9, 1.035, 1] },
      transition: { delay: .45, duration: .85, ease: "easeOut" as const },
    },
    phone: {
      animate: { scale: [.92, 1.04, 1], rotate: [0, -1.5, 1.5, 0] },
      transition: { delay: .5, duration: .9, ease: "easeOut" as const },
    },
    stethoscope: {
      animate: { y: [-22, 3, 0], scale: [.94, 1.02, 1] },
      transition: { delay: .45, duration: .8, ease: "easeOut" as const },
    },
    thumbs: {
      animate: { y: [18, -8, 0], scale: [.88, 1.06, 1] },
      transition: { delay: .42, duration: .85, ease: "easeOut" as const },
    },
    confused: {
      animate: { rotate: [0, -3, 2, -1, 0], x: [0, -2, 2, 0], scale: [.94, 1.02, 1] },
      transition: { delay: .45, duration: 1, ease: "easeOut" as const },
    },
  }[action] || {
    animate: { y: [12, 0], scale: [.94, 1] },
    transition: { delay: .4, duration: .65, ease: "easeOut" as const },
  };

  return (
    <motion.div
      className="relative h-full w-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: .28 }}
    >
      <div className="absolute inset-0 flex items-center justify-center px-10 pb-1 pt-2">
        <motion.img
          src={mascot}
          alt={`Dr Ahroid ${action}`}
          initial={{ opacity: 0, y: 18, scale: .92 }}
          animate={{ opacity: 1, ...actionMotion.animate }}
          transition={actionMotion.transition}
          className="h-full w-full object-contain"
        />
      </div>
      {action === "stethoscope" && (
        <motion.div
          initial={{ opacity: 0, y: -28, rotate: -12 }}
          animate={{ opacity: [0, 1, 0], y: [-28, 28, 42], rotate: [-12, 4, 0] }}
          transition={{ delay: .35, duration: 1, ease: "easeOut" }}
          className="pointer-events-none absolute left-1/2 top-[22%] -translate-x-1/2 text-teal-600"
        >
          <Stethoscope className="h-10 w-10" strokeWidth={1.5} />
        </motion.div>
      )}
      {action === "confused" && (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: .8 }}
          animate={{ opacity: [0, 1, 1, 0], y: [8, -10, -18, -24], scale: [.8, 1, 1, .9] }}
          transition={{ delay: .55, duration: 1.35, ease: "easeOut" }}
          className="pointer-events-none absolute right-[26%] top-[20%] text-teal-600"
        >
          <HelpCircle className="h-9 w-9" strokeWidth={1.8} />
        </motion.div>
      )}
    </motion.div>
  );
}

export default function Welcome() {
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const navigate = useNavigate();

  const welcomeMascot = useMemo(() => {
    const avatars = ["Mascot2", "Mascot9", "Mascot10", "Mascot13", "Mascot14"];
    return `/mascots/${avatars[Math.floor(Math.random() * avatars.length)]}.png`;
  }, []);

  useEffect(() => {
    async function checkState() {
      const hasSeenWizard = localStorage.getItem(WIZARD_SEEN_KEY);
      const { data } = await supabase.auth.getSession();
      const userExists = !!data?.session;
      setIsLoggedIn(userExists);

      if (!hasSeenWizard) {
        setShowWizard(true);
      } else if (userExists) {
        navigate("/dashboard", { replace: true });
      }
      setLoading(false);
    }
    checkState();
  }, [navigate]);

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) setCurrentStep((prev) => prev + 1);
    else completeSetup();
  };

  const handleBack = () => {
    if (currentStep > 0) setCurrentStep((prev) => prev - 1);
  };

  const completeSetup = () => {
    localStorage.setItem(WIZARD_SEEN_KEY, "true");
    localStorage.setItem(LEGACY_WIZARD_SEEN_KEY, "true");
    if (isLoggedIn) navigate("/dashboard", { replace: true });
    else setShowWizard(false);
  };

  const restartWizard = () => {
    setCurrentStep(0);
    setShowWizard(true);
  };

  if (loading) return <AppTransitionScreen />;

  return (
    <AnimatePresence mode="wait">
      {showWizard ? (
        /* ─── WIZARD VIEW ─── */
        <motion.div
          key="wizard"
          initial={{ opacity: 1 }} exit={{ opacity: 0, scale: .97 }}
          className="fixed inset-0 overflow-hidden overscroll-none bg-white text-slate-950"
        >
          <main
            className="relative z-10 mx-auto flex h-full w-full max-w-md flex-col px-5 pt-[max(18px,env(safe-area-inset-top))]"
            style={{ paddingBottom: BOTTOM_SAFE_CLEARANCE }}
          >
            {STEPS[currentStep].action !== "intro" && <motion.header
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: .45, ease: "easeOut" }}
              className="flex items-center justify-between"
            >
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: .12, duration: .4 }}
                className="flex items-center gap-2.5"
              >
                <span className="font-['Syne'] text-lg font-extrabold tracking-[-.045em]">
                  <span className="bg-gradient-to-r from-[#2dd4bf] to-[#0ea5e9] bg-clip-text text-transparent">Medmacs</span>
                  <span className="text-slate-950">.app</span>
                </span>
              </motion.div>
              <motion.button
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: .18, duration: .4 }}
                onClick={completeSetup}
                className="cursor-pointer rounded-full px-3 py-2 text-xs font-bold text-slate-400 transition-colors hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
              >
                Skip
              </motion.button>
            </motion.header>}

            <AnimatePresence mode="wait">
              <motion.section key={currentStep} initial={{ opacity: 0, x: 28 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -28 }} transition={{ duration: .38, ease: [0.22, 1, 0.36, 1] }} className="relative flex min-h-0 flex-1 flex-col">
                {STEPS[currentStep].action === "intro" ? (
                  <div className="relative flex min-w-0 flex-1 flex-col items-center text-center">
                    <motion.img
                      src="/lovable-uploads/bf69a7f7-550a-45a1-8808-a02fb889f8c5.png"
                      alt="Medmacs"
                      initial={{ opacity: 0, y: -8, scale: .92 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ delay: .12, duration: .42, ease: "easeOut" }}
                      className="fixed left-5 top-[max(18px,env(safe-area-inset-top))] z-20 h-12 w-12 object-contain"
                    />
                    <motion.h1
                      initial={{ opacity: 0, y: 18, filter: "blur(8px)" }}
                      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                      transition={{ duration: .6, ease: [0.22, 1, 0.36, 1] }}
                      className="mx-auto mt-auto w-full max-w-[min(360px,calc(100vw-48px))] text-center font-['Syne'] font-extrabold leading-[1.02]"
                    >
                      <span className="mx-auto block w-fit text-[clamp(1.9rem,8vw,2.65rem)] tracking-[-.045em] text-slate-950">Welcome to</span>
                      <span className="mx-auto mt-2 block w-fit max-w-full whitespace-nowrap text-[clamp(1.65rem,7.2vw,2.2rem)] tracking-[-.065em]">
                        <motion.span
                          className="inline-block bg-[linear-gradient(90deg,#2dd4bf,#0ea5e9,#22d3ee,#2dd4bf)] bg-[length:220%_100%] bg-clip-text text-transparent"
                          animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
                          transition={{ duration: 3.8, repeat: Infinity, ease: "easeInOut" }}
                        >
                          Medmacs
                        </motion.span>
                        <span className="text-slate-950">.app</span>
                      </span>
                    </motion.h1>
                    <motion.button
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: .25, duration: .45, ease: "easeOut" }}
                      onClick={handleNext}
                      className="mt-auto w-full cursor-pointer rounded-2xl bg-gradient-to-r from-[#2dd4bf] to-[#0ea5e9] px-10 py-4 text-base font-extrabold text-white shadow-[0_12px_32px_rgba(14,165,233,.25)] transition-transform hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0ea5e9] focus-visible:ring-offset-2 active:scale-95"
                    >
                      Onboard
                    </motion.button>
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: .55, duration: .45 }}
                      className="mt-4 shrink-0 text-center text-xs text-slate-400"
                    >
                      A project by <span className="font-semibold text-slate-600">HMACS Studios</span>
                    </motion.p>
                  </div>
                ) : (
                  <>
                <div className="mx-auto max-w-sm px-2 pt-7 text-center">
                  <motion.h1
                    initial={{ opacity: 0, y: 18, scale: .94, filter: "blur(8px)" }}
                    animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                    transition={{ delay: .16, duration: .5, ease: "easeOut" }}
                    className="font-['Syne'] text-[clamp(1.7rem,6.4vw,2.2rem)] font-extrabold leading-[1.02] tracking-[-.05em] text-slate-950"
                  >
                    {STEPS[currentStep].title}
                  </motion.h1>
                  <motion.p
                    initial={{ opacity: 0, y: 14, filter: "blur(6px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    transition={{ delay: .32, duration: .5, ease: [0.22, 1, 0.36, 1] }}
                    className="mx-auto mt-3 max-w-xs text-sm leading-6 text-slate-500"
                  >
                    {STEPS[currentStep].description}
                  </motion.p>
                </div>

                <div className="relative mx-auto mt-2 min-h-0 w-full max-w-sm flex-1 overflow-hidden">
                  <StepVisual action={STEPS[currentStep].action} mascot={STEPS[currentStep].mascot} />
                </div>
                  </>
                )}
              </motion.section>
            </AnimatePresence>

            {STEPS[currentStep].action !== "intro" && <footer className="mt-2">
              <motion.div
                key={`controls-${currentStep}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: .5, duration: .4, ease: "easeOut" }}
                className="mx-auto flex max-w-[320px] items-center justify-between px-1 py-1.5"
              >
                <button onClick={handleBack} disabled={currentStep === 0} aria-label="Previous step" className="grid h-10 w-10 cursor-pointer place-items-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:invisible">
                  <ChevronLeft className="h-5 w-5"/>
                </button>
                <div className="flex h-8 items-center gap-2.5" aria-label={`Step ${currentStep + 1} of ${STEPS.length}`}>
                  {STEPS.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentStep(idx)}
                      aria-label={`Go to step ${idx + 1}`}
                      aria-current={idx === currentStep ? "step" : undefined}
                      className={`cursor-pointer rounded-full transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white ${
                        idx === currentStep
                          ? "h-4 w-4 bg-teal-500"
                          : idx < currentStep
                            ? "h-2.5 w-2.5 bg-teal-300 hover:bg-teal-400"
                            : "h-2.5 w-2.5 bg-slate-200 hover:bg-slate-300"
                      }`}
                    />
                  ))}
                </div>
                <button onClick={handleNext} aria-label={currentStep === STEPS.length - 1 ? "Get started" : "Next step"} className="grid h-10 w-10 cursor-pointer place-items-center rounded-full bg-slate-950 text-white transition-colors hover:bg-teal-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white">
                  {currentStep === STEPS.length - 1 ? <ArrowRight className="h-5 w-5"/> : <ChevronRight className="h-5 w-5"/>}
                </button>
              </motion.div>
            </footer>}
          </main>
        </motion.div>
      ) : (
        /* ─── LOGIN SCREEN VIEW ─── */
        <motion.div
          key="login"
          initial={{ opacity: 0, scale: 1.1, y: 20 }}
          animate={{
            opacity: 1,
            scale: 1,
            y: 0,
            transition: {
              type: "spring",
              damping: 20,
              stiffness: 100,
              delay: 0.1
            }
          }}
          className="fixed inset-0 flex flex-col items-center justify-center overflow-hidden overscroll-none bg-white text-slate-950"
        >
          {/* Help/Revisit Button */}
          <button
            onClick={restartWizard}
            className="absolute right-8 top-8 z-50 p-2 text-slate-300 transition-colors hover:text-teal-500"
            title="Revisit App Tour"
          >
            <HelpCircle className="w-7 h-7" />
          </button>

          <div
            className="relative z-10 flex min-h-0 w-full max-w-md flex-1 flex-col items-center px-5 pt-[max(18px,env(safe-area-inset-top))]"
            style={{ paddingBottom: BOTTOM_SAFE_CLEARANCE }}
          >
            <motion.img
              initial={{ y: 20 }} animate={{ y: 0 }}
              src={welcomeMascot} alt="Mascot" className="mt-auto w-40 h-auto drop-shadow-2xl animate-[float_4s_ease-in-out_infinite]"
            />
            <div className="text-center mt-8">
              <h1 className="whitespace-nowrap font-['Syne'] text-[clamp(2rem,8vw,2.55rem)] font-extrabold tracking-[-.055em]">
                <motion.span
                  className="inline-block bg-[linear-gradient(90deg,#2dd4bf,#0ea5e9,#22d3ee,#2dd4bf)] bg-[length:220%_100%] bg-clip-text text-transparent"
                  animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
                  transition={{ duration: 3.8, repeat: Infinity, ease: "easeInOut" }}
                >
                  Medmacs
                </motion.span>
                <span className="text-slate-950">.app</span>
              </h1>
              <p className="mt-2 text-sm font-bold uppercase tracking-widest text-slate-400">Master the Medical Journey</p>
            </div>
            <div className="mt-auto w-full flex flex-col gap-4">
              <button onClick={() => navigate("/signup")} className="w-full py-4 bg-gradient-to-r from-[#2dd4bf] to-[#0ea5e9] text-white font-bold rounded-2xl shadow-lg active:scale-95 transition-transform">Create Account</button>
              <button onClick={() => navigate("/login")} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-4 text-sm font-semibold text-slate-950 shadow-sm transition-transform active:scale-95 sm:text-base">Already have a Medmacs.app account? Login</button>
            </div>
            <p className="mt-4 shrink-0 text-center text-xs text-slate-400">
              A project by <span className="font-semibold text-slate-600">HMACS Studios</span>
            </p>
          </div>
          <style>{`@keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-15px); } }`}</style>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
