import { useState, useEffect, useCallback, type ChangeEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Eye, EyeOff, CheckCircle, XCircle,
  Mail, Loader2, User,
} from "lucide-react";
import Seo from "@/components/Seo";
import { motion } from "framer-motion";
import GoogleSignin from "@/components/GoogleSignin";
import type { LucideIcon } from "lucide-react";
import { AuthDnaWave } from "@/components/auth/AuthDnaWave";

type SignupFormData = {
  email: string;
  fullName: string;
  password: string;
  confirmPassword: string;
};

type SignupErrors = Partial<Record<keyof SignupFormData, string>>;

type EmailVerificationModalProps = {
  email: string;
  isOpen: boolean;
  onClose: () => void;
  onResend: () => void;
  resendLoading: boolean;
  resendDelay: number;
};

const EmailVerificationModal = ({ email, isOpen, onClose, onResend, resendLoading, resendDelay }: EmailVerificationModalProps) => {
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(resendDelay);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    if (isOpen) {
      setCountdown(resendDelay);
      timer = setInterval(() => {
        setCountdown((prev: number) => {
          if (prev <= 1) { clearInterval(timer); return 0; }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isOpen, resendDelay]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader className="flex flex-col items-center text-center pt-4">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            className="p-3 bg-primary/10 rounded-full mb-4"
          >
            <Mail className="w-8 h-8 text-primary" />
          </motion.div>

          <DialogTitle className="text-2xl">Verification Email Sent! 🚀</DialogTitle>

          <DialogDescription className="text-muted-foreground mt-2">
            We've sent a verification link to {email}. Please check your inbox and spam folder.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col space-y-3 mt-4">
          <Button
            onClick={() => { onClose(); navigate("/login"); }}
            className="w-full bg-primary hover:bg-primary/90"
          >
            Go to Login Page
          </Button>

          <Button
            variant="outline"
            onClick={onResend}
            disabled={resendLoading || countdown > 0}
            className="w-full"
          >
            {resendLoading
              ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              : countdown > 0
                ? `Resend Email in ${countdown}s`
                : "Resend Verification Email"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

type InputFieldProps = {
  id: keyof SignupFormData;
  label: string;
  type?: string;
  placeholder: string;
  error?: string;
  showToggle?: boolean;
  showState?: boolean;
  onToggle?: () => void;
  icon?: LucideIcon;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  getInputIcon: (fieldName: keyof SignupFormData, hasError: boolean, hasValue: boolean) => React.ReactNode;
};

const InputField = ({
  id,
  label,
  type = "text",
  placeholder,
  error,
  showToggle = false,
  showState,
  onToggle,
  icon: Icon,
  value,
  onChange,
  getInputIcon
}: InputFieldProps) => (
  <div className="space-y-1.5">
    <Label
      htmlFor={id}
      className="text-xs font-semibold uppercase tracking-wider text-slate-500"
    >
      {label}
    </Label>

    <div className="relative">
      {Icon && <Icon className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-300" />}

      <Input
        id={id}
        name={id}
        type={showToggle ? (showState ? "text" : "password") : type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required
        autoComplete={
          id === "password" || id === "confirmPassword"
            ? "off"
            : id === "email"
              ? "email"
              : id === "fullName"
                ? "name"
                : "off"
        }
        className={`${Icon ? "pl-10" : "pl-3.5"} ${showToggle ? "pr-10" : ""}
        h-12 rounded-none border-0 border-b border-slate-200 bg-transparent text-slate-950 shadow-none placeholder:text-slate-300
        focus:border-[#2dd4bf] focus-visible:ring-0 focus-visible:ring-offset-0
        ${error ? "border-red-400/60" : ""}`}
      />

      {showToggle && (
        <button
          type="button"
          onClick={onToggle}
          aria-label={showState ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          className="absolute right-3.5 top-3.5 text-slate-300 transition-colors hover:text-slate-600"
        >
          {showState ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      )}

      {!showToggle && (
        <div className="absolute right-3.5 top-1/2 transform -translate-y-1/2">
          {getInputIcon(id, !!error, !!value)}
        </div>
      )}
    </div>

    {error && <p className="text-red-500 text-[11px]">{error}</p>}
  </div>
);

const Signup = () => {
  const { signUp, user, verifySignupOtp, resendSignupOtp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    email: "",
    fullName: "",
    password: "",
    confirmPassword: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<SignupErrors>({});
  const [mounted, setMounted] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [signupStep, setSignupStep] = useState("form");
  const [otp, setOtp] = useState("");
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const RESEND_DELAY_SECONDS = 60;

  useEffect(() => {
    setMounted(true);
    if (user) navigate("/dashboard");
  }, [user, navigate]);

  const validateForm = useCallback((data: SignupFormData) => {
    const errors: SignupErrors = {};

    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))
      errors.email = "Invalid email";

    if (data.fullName && data.fullName.length < 2)
      errors.fullName = "Too short";

    if (data.password) {
      if (data.password.length < 8)
        errors.password = "Min 8 characters";
      else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(data.password))
        errors.password = "Need upper, lower & number";
    }

    if (data.confirmPassword && data.password !== data.confirmPassword)
      errors.confirmPassword = "Passwords don't match";

    return errors;
  }, []);

  useEffect(() => {
    setValidationErrors(validateForm(formData));
  }, [formData, validateForm]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((current) => Math.max(current - 1, 0)), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleInputChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleResendVerification = useCallback(async () => {
    setResendLoading(true);
    try {
      const { error } = await resendSignupOtp(formData.email);
      if (error) throw error;
      setResendCooldown(RESEND_DELAY_SECONDS);

      toast({
        title: "Code resent!",
        description: "Check your inbox for the new verification code.",
        duration: 5000
      });

    } catch (error) {

      toast({
        title: "Resend Failed",
        description: error.message || "Could not resend.",
        variant: "destructive"
      });

    } finally {
      setResendLoading(false);
    }
  }, [formData.email, resendSignupOtp, toast]);

  const handleVerifyOtp = useCallback(async () => {
    if (otp.trim().length < 6) {
      toast({
        title: "Invalid code",
        description: "Please enter the 6-digit code from your email.",
        variant: "destructive"
      });
      return;
    }

    setVerifyLoading(true);
    try {
      const { error } = await verifySignupOtp(formData.email, otp.trim());
      if (error) throw error;
      toast({
        title: "Email verified!",
        description: "Your account is ready."
      });
      navigate("/dashboard");
    } catch (error) {
      toast({
        title: "Verification failed",
        description: error.message || "Please check the code and try again.",
        variant: "destructive"
      });
    } finally {
      setVerifyLoading(false);
    }
  }, [formData.email, navigate, otp, toast, verifySignupOtp]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();

    if (signupStep === "verify") {
      await handleVerifyOtp();
      return;
    }

    if (Object.keys(validationErrors).length > 0) {
      toast({
        title: "Validation Error",
        description: "Please fix the errors.",
        variant: "destructive"
      });
      return;
    }

    if (!formData.email || !formData.fullName || !formData.password || !formData.confirmPassword) {
      toast({
        title: "Missing Info",
        description: "Please fill in all fields.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await signUp(
        formData.email,
        formData.password,
        { fullName: formData.fullName }
      );

      if (!error && data) {
        setSignupStep("verify");
        setResendCooldown(RESEND_DELAY_SECONDS);
        toast({
          title: "Check your email",
          description: "Enter the verification code below to finish signup."
        });
      } else if (error) {
        if (error.message.includes("already registered")) {
          toast({
            title: "Signup Failed",
            description: "This email is already registered.",
            variant: "destructive"
          });
        } else {
          throw error;
        }
      }

    } catch (error) {

      toast({
        title: "Error",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive"
      });

    } finally {
      setLoading(false);
    }
  }, [formData, validationErrors, signUp, toast, signupStep, handleVerifyOtp]);

  const getInputIcon = useCallback((fieldName, hasError, hasValue) => {
    if (hasValue && !hasError)
      return <CheckCircle className="w-4 h-4 text-emerald-400" />;

    if (hasError)
      return <XCircle className="w-4 h-4 text-red-400" />;

    return null;
  }, []);

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-white text-slate-950">

      <Seo
        title="Sign Up"
        description="Create a free account on Medmacs."
        canonical="https://medmacs.app/signup"
      />

      <EmailVerificationModal
        email={formData.email}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onResend={handleResendVerification}
        resendLoading={resendLoading}
        resendDelay={RESEND_DELAY_SECONDS}
      />

      {signupStep === "verify" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-white/80 px-5 backdrop-blur-xl"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,.14)]"
          >
            <div className="mb-5 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#2dd4bf]/30 bg-[#2dd4bf]/15">
                <Mail className="h-7 w-7 text-[#5eead4]" />
              </div>
              <h2 className="text-2xl font-black text-slate-950">Verify your email</h2>
              <p className="mt-2 text-sm text-slate-500">
                Enter the 6-digit code sent to <span className="font-semibold text-[#0ea5e9]">{formData.email}</span>.
              </p>
            </div>

            <div className="space-y-3">
              <Input
                id="otp"
                name="otp"
                inputMode="numeric"
                maxLength={6}
                placeholder="123456"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="h-14 rounded-2xl border-slate-200 bg-white text-center text-xl font-black tracking-[0.45em] text-slate-950 placeholder:text-slate-300 focus:border-[#2dd4bf]/60"
                autoFocus
              />
              <Button
                type="button"
                onClick={handleVerifyOtp}
                disabled={verifyLoading}
                className="h-12 w-full rounded-2xl bg-gradient-to-r from-[#2dd4bf] to-[#0ea5e9] font-bold text-white hover:from-[#2dd4bf]/90 hover:to-[#0ea5e9]/90"
              >
                {verifyLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : "Verify & Continue"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleResendVerification}
                disabled={resendLoading || resendCooldown > 0}
                className="h-11 w-full rounded-2xl border-slate-200 bg-white text-slate-950 hover:bg-slate-50"
              >
                {resendLoading
                  ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  : resendCooldown > 0
                    ? `Resend Code in ${resendCooldown}s`
                    : "Resend Code"}
              </Button>
              <button
                type="button"
                onClick={() => setSignupStep("form")}
                className="w-full pt-1 text-sm font-semibold text-slate-500 hover:text-slate-800"
              >
                Edit signup details
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}

       <div className="bg-gradient-to-r from-[#2dd4bf]/10 via-transparent to-[#0ea5e9]/10 pt-[env(safe-area-inset-top)]" />

      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative z-10 flex items-center justify-between px-5 py-4"
      >
        <Link to="/" className="flex items-center space-x-2 text-slate-400 transition-colors hover:text-slate-950">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"
            viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
          <span className="text-sm font-medium">Back</span>
        </Link>

        <img
           src="/assets/brand/medmacs-logo.png"
           alt="Medmacs"
           className="h-10 w-10 object-contain"
           onError={(event) => { event.currentTarget.src = "/lovable-uploads/bf69a7f7-550a-45a1-8808-a02fb889f8c5.png"; }}
        />
      </motion.div>

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-5 pb-[env(safe-area-inset-bottom)] overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
           className="w-full max-w-md rounded-[2rem] border border-white/80 bg-white/80 px-5 py-7 shadow-[0_24px_80px_rgba(14,165,233,.09)] backdrop-blur-xl sm:px-8"
        >

          <div className="text-center mb-6 flex flex-col items-center justify-center">
            <h1 className="whitespace-nowrap font-['Bricolage_Grotesque'] text-[clamp(2rem,8vw,2.55rem)] font-extrabold tracking-[-.055em] flex items-center justify-center">
              <motion.span
                className="brand-wordmark inline-block text-slate-950"
                animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
                transition={{ duration: 3.8, repeat: Infinity, ease: "easeInOut" }}
              >
                Medmacs
              </motion.span>
            </h1>

            <p className="mt-2 text-sm font-bold uppercase tracking-widest text-slate-400 text-center">
              Create your account
            </p>
          </div>

          <div className="px-1">
            <form onSubmit={handleSubmit} className="space-y-4">

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                <InputField
                  id="email"
                  label="Email"
                  type="email"
                  placeholder="your@email.com"
                  error={validationErrors.email}
                  icon={Mail}
                  value={formData.email}
                  onChange={handleInputChange}
                  getInputIcon={getInputIcon}
                />

                <InputField
                  id="fullName"
                  label="Full Name"
                  placeholder="Your name"
                  error={validationErrors.fullName}
                  icon={User}
                  value={formData.fullName}
                  onChange={handleInputChange}
                  getInputIcon={getInputIcon}
                />

                <InputField
                  id="password"
                  label="Password"
                  placeholder="Create password"
                  error={validationErrors.password}
                  showToggle
                  showState={showPassword}
                  onToggle={() => setShowPassword(!showPassword)}
                  value={formData.password}
                  onChange={handleInputChange}
                  getInputIcon={getInputIcon}
                />

                <InputField
                  id="confirmPassword"
                  label="Confirm"
                  placeholder="Confirm password"
                  error={validationErrors.confirmPassword}
                  showToggle
                  showState={showConfirmPassword}
                  onToggle={() => setShowConfirmPassword(!showConfirmPassword)}
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  getInputIcon={getInputIcon}
                />

              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-[#2dd4bf] to-[#0ea5e9] hover:from-[#2dd4bf]/90 hover:to-[#0ea5e9]/90 text-white rounded-xl h-12 font-bold text-sm tracking-wide shadow-lg shadow-[#0ea5e9]/20 transition-all duration-300"
                disabled={loading || verifyLoading || (signupStep === "form" && Object.keys(validationErrors).length > 0)}
              >
                {loading
                  ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  : verifyLoading
                    ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    : signupStep === "verify"
                      ? "Verify & Continue"
                      : "Create Account"}
              </Button>

            </form>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-slate-200" />
              </div>

              <div className="relative flex justify-center text-xs">
                <span className="bg-white px-3 text-[10px] uppercase tracking-widest text-slate-400">
                  or continue with
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <GoogleSignin />
            </div>

            <p className="text-center text-sm mt-5 text-slate-500">
              Already have an account?{" "}
              <Link
                to="/login"
                className="font-semibold text-[#0ea5e9] transition-colors hover:text-[#0284c7]"
              >
                Sign in
              </Link>
            </p>

          </div>
        </motion.div>
      </div>
      <AuthDnaWave />
       <p className="relative z-10 border-t border-slate-200/60 bg-white/30 pb-[max(8px,env(safe-area-inset-bottom))] pt-3 text-center text-xs text-slate-400">
        A project by <span className="font-semibold text-slate-600">HMACS Studios</span>
      </p>
    </div>
  );
};

export default Signup;
