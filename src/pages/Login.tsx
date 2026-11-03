import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import Seo from "@/components/Seo";
import { motion } from "framer-motion";
import GoogleSignin from "@/components/GoogleSignin";
import AppTransitionScreen from "@/components/AppTransitionScreen";
import { AuthDnaWave } from "@/components/auth/AuthDnaWave";

const Login = () => {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  const { signIn, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!authLoading && user) navigate("/dashboard", { replace: true });
  }, [authLoading, user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    const { data, error } = await signIn(formData.email, formData.password);
    if (data && !error) {
      navigate("/dashboard", { replace: true });
      return;
    }
    setIsLoading(false);
  };

  if (!mounted || authLoading || user) {
    return <AppTransitionScreen />;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
         className="fixed inset-0 flex flex-col overflow-hidden overscroll-none bg-[radial-gradient(circle_at_50%_-20%,#d9fbf7_0%,transparent_42%),linear-gradient(180deg,#ffffff_0%,#f8fbfc_100%)] text-slate-950"
    >
      <Seo
        title="Login"
        description="Log in to your Medmacs account to access personalized Medical preparation tools, MCQs, AI study assistant, and more."
        canonical="https://medmacs.app/login"
      />

      {/* Safe area top spacing */}
      <div className="pt-[env(safe-area-inset-top)]" />

      {/* Top bar - just back button + logo, no full header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative z-10 flex items-center justify-between px-5 py-4"
      >
        <Link to="/" className="flex items-center space-x-2 text-slate-400 transition-colors hover:text-slate-950">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
          <span className="text-sm font-medium">Back</span>
        </Link>
         <img src="/assets/brand/medmacs-logo.png" alt="Medmacs" className="h-10 w-10 object-contain" onError={(event) => { event.currentTarget.src = "/lovable-uploads/bf69a7f7-550a-45a1-8808-a02fb889f8c5.png"; }} />
      </motion.div>

      {/* Main content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-5 pb-[env(safe-area-inset-bottom)]">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
           className="w-full max-w-md rounded-[2rem] border border-white/80 bg-white/75 px-5 py-7 shadow-[0_24px_80px_rgba(14,165,233,.09)] backdrop-blur-xl sm:px-8"
        >
          {/* Welcome text */}
          <div className="text-center mb-8 flex flex-col items-center justify-center">
            <h1 className="whitespace-nowrap font-['Bricolage_Grotesque'] text-[clamp(2rem,8vw,2.55rem)] font-extrabold tracking-[-.055em] flex items-center justify-center">
              <motion.span
                className="brand-wordmark inline-block text-slate-950"
                animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
                transition={{ duration: 3.8, repeat: Infinity, ease: "easeInOut" }}
              >
                Medmacs
              </motion.span>
            </h1>
            <p className="mt-2 font-['Plus_Jakarta_Sans'] text-sm font-bold uppercase tracking-[.22em] text-slate-400 text-center">Welcome back</p>
          </div>

          <div className="px-1">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-slate-500">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-300" />
                  <Input
                    id="email" type="email" placeholder="Enter your email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="h-12 rounded-none border-0 border-b border-slate-200 bg-transparent pl-10 text-slate-950 shadow-none placeholder:text-slate-300 focus:border-[#2dd4bf] focus-visible:ring-0 focus-visible:ring-offset-0"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-slate-500">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-300" />
                  <Input
                    id="password" type={showPassword ? "text" : "password"} placeholder="Enter your password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="h-12 rounded-none border-0 border-b border-slate-200 bg-transparent pl-10 pr-10 text-slate-950 shadow-none placeholder:text-slate-300 focus:border-[#2dd4bf] focus-visible:ring-0 focus-visible:ring-offset-0"
                    required
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-3.5 text-slate-300 transition-colors hover:text-slate-600">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end">
                <Link to="/forgot-password" className="text-xs text-[#2dd4bf] hover:text-[#2dd4bf]/80 transition-colors font-medium">
                  Forgot password?
                </Link>
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-[#2dd4bf] to-[#0ea5e9] hover:from-[#2dd4bf]/90 hover:to-[#0ea5e9]/90 text-white rounded-xl h-12 font-bold text-sm tracking-wide shadow-lg shadow-[#0ea5e9]/20 transition-all duration-300 hover:shadow-xl hover:shadow-[#0ea5e9]/30"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Signing in...</span>
                  </div>
                ) : "Sign In"}
              </Button>

              <div className="relative my-2">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-200" /></div>
                <div className="relative flex justify-center text-xs"><span className="bg-white px-3 text-[10px] uppercase tracking-widest text-slate-400">or continue with</span></div>
              </div>

              <div className="space-y-3">
                <GoogleSignin buttonText="Continue with Google" />
              </div>
            </form>

            <p className="text-center text-sm mt-5 text-slate-500">
              Don't have an account?{" "}
              <Link to="/signup" className="text-[#0ea5e9] font-semibold transition-colors hover:text-[#0284c7]">Create account</Link>
            </p>
          </div>
        </motion.div>
      </div>
      <AuthDnaWave />
       <p className="relative z-10 border-t border-slate-200/60 bg-white/30 pb-[max(8px,env(safe-area-inset-bottom))] pt-3 text-center text-xs text-slate-400">
        A project by <span className="font-semibold text-slate-600">HMACS Studios</span>
      </p>
    </motion.div>
  );
};

export default Login;
