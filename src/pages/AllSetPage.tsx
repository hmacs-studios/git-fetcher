// src/pages/AllSetPage.jsx
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Sparkles } from 'lucide-react'; // Icons for visual appeal
import { Link } from 'react-router-dom';

const AllSetPage = () => {
  const navigate = useNavigate();

  // Handler for the "Go to Dashboard" button
  const handleGoToDashboard = () => {
    navigate('/dashboard'); // Direct navigation to the dashboard
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_18%_18%,#99f6e4_0%,transparent_28%),radial-gradient(circle_at_85%_78%,#f0abfc_0%,transparent_30%),linear-gradient(135deg,#ecfeff,#f5f3ff_48%,#fdf2f8)] px-5 text-center">
      <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:radial-gradient(#0f766e_1px,transparent_1px)] [background-size:24px_24px]" />
      <div className="relative mb-6">
        <div className="flex h-28 w-28 items-center justify-center rounded-full bg-white/70 shadow-[0_20px_55px_rgba(20,184,166,.22)] backdrop-blur-xl"><CheckCircle className="h-20 w-20 text-teal-500 animate-scale-in" /></div>
        <Sparkles className="absolute top-0 right-0 w-8 h-8 text-yellow-400 animate-pulse" style={{ transform: 'rotate(20deg)' }} />
        <Sparkles className="absolute bottom-0 left-0 w-6 h-6 text-blue-400 animate-pulse-slow" style={{ transform: 'rotate(-30deg)' }} />
      </div>
      <h1 className="font-['Bricolage_Grotesque'] text-5xl font-extrabold leading-tight tracking-[-.06em] text-slate-950 md:text-6xl">
        You're All <span className="text-teal-600">Set!</span>
      </h1>
      <p className="mx-auto mb-8 max-w-2xl text-lg text-slate-600 md:text-xl">
        Your profile is complete, and you're ready to dive into Medmacs.
      </p>
      <Button
        onClick={handleGoToDashboard}
        className="rounded-2xl bg-gradient-to-r from-teal-500 via-cyan-500 to-sky-500 px-8 py-4 text-lg font-bold text-white shadow-lg shadow-cyan-500/25 transition-all duration-300 hover:scale-105 hover:from-teal-600 hover:to-sky-600"
      >
        Go to Dashboard
      </Button>
      <p className="relative mt-7 text-sm text-slate-500">Ready when you are. <Link to="/dashboard" className="font-bold text-teal-600">Open dashboard</Link></p>
    </div>
  );
};

export default AllSetPage;
