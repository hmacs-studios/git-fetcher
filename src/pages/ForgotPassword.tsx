import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Mail, ShieldCheck } from 'lucide-react';

import Seo from '@/components/Seo'; // Import the Seo component

const ForgotPassword = () => {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [validationError, setValidationError] = useState('');

  const handleEmailChange = (e) => {
    const value = e.target.value;
    setEmail(value);
    // Basic email validation
    if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setValidationError('Please enter a valid email address.');
    } else {
      setValidationError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email) {
      setValidationError('Email address is required.');
      return;
    }

    if (validationError) {
      toast({
        title: "Validation Error",
        description: "Please fix the email address.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setEmailSent(false); // Reset emailSent state before new attempt

    try {
      // Supabase's password reset function
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/update-password`, // This should be the URL where user can update password after clicking link
      });

      if (error) {
        throw error;
      }

      setEmailSent(true);
      toast({
        title: "Password Reset Email Sent",
        description: "Please check your inbox (and spam folder) for instructions to reset your password.",
        duration: 7000,
      });

    } catch (error) {
      console.error("Error sending password reset email:", error);
      toast({
        title: "Error",
        description: error.message || "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden overscroll-none bg-gradient-to-br from-[#0a2e2e] via-[#0f172a] to-[#020617]">
      <Seo
        title="Forgot Password"
        description="Reset your password for Medmacs. Enter your email to receive instructions on how to regain access to your account."
        canonical="https://medmacs.app/forgot-password"
      />

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-[#2dd4bf]/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-1/2 -right-32 w-80 h-80 bg-[#0ea5e9]/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute -bottom-24 left-1/3 w-72 h-72 bg-[#67e8f9]/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 20px, rgba(255,255,255,0.5) 20px, rgba(255,255,255,0.5) 21px)`
        }} />
      </div>

      <div className="pt-[env(safe-area-inset-top)]" />

      <div className="relative z-10 flex items-center justify-between px-5 py-4">
        <Link to="/login" className="flex items-center space-x-2 text-white/70 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Back</span>
        </Link>
         <div className="flex items-center space-x-2">
           <img src="/assets/brand/medmacs-logo.png" alt="Medmacs" className="h-9 w-9 object-contain" onError={(event) => { event.currentTarget.src = "/lovable-uploads/bf69a7f7-550a-45a1-8808-a02fb889f8c5.png"; }} />
          <span className="brand-wordmark text-xl text-white">Medmacs</span>
        </div>
      </div>

      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-5 pb-[env(safe-area-inset-bottom)]">
        <div className="w-full max-w-md animate-fade-in">
          <div className="text-center mb-8">
            <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-md rounded-full px-4 py-1.5 mb-4 border border-white/10">
              <ShieldCheck className="w-3.5 h-3.5 text-[#2dd4bf]" />
              <span className="text-[#2dd4bf] text-xs font-semibold uppercase tracking-widest">Account recovery</span>
            </div>
            <h1 className="text-white text-3xl font-black tracking-tight">Forgot Password?</h1>
            <p className="text-white/50 text-sm mt-2">Enter your email to receive a password reset link.</p>
          </div>

           <Card className="rounded-[2rem] border border-white/15 bg-white/[0.08] text-white shadow-[0_24px_90px_rgba(0,0,0,.35)] backdrop-blur-2xl">
            <CardHeader>
              <CardTitle className="text-white">Reset Your Password</CardTitle>
              <CardDescription className="text-white/50">
              {emailSent ? (
                <p className="text-[#67e8f9]">
                  If an account exists with that email, a password reset link has been sent to your inbox.
                </p>
              ) : (
                <p>Don't worry, it happens! Just enter your email below.</p>
              )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-white/80 text-xs font-semibold uppercase tracking-wider">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-white/30" />
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={email}
                      onChange={handleEmailChange}
                      placeholder="your@example.com"
                      className={`pl-10 bg-white/[0.08] border-white/10 text-white placeholder:text-white/25 focus:border-[#2dd4bf]/50 focus:ring-[#2dd4bf]/20 h-12 rounded-xl ${validationError ? "border-red-400" : ""}`}
                      required
                    />
                  </div>
                  {validationError && (
                    <p className="text-red-300 text-xs font-medium">{validationError}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-[#2dd4bf] to-[#0ea5e9] hover:from-[#2dd4bf]/90 hover:to-[#0ea5e9]/90 text-white rounded-xl h-12 font-bold text-sm tracking-wide shadow-lg shadow-[#0ea5e9]/20"
                  disabled={loading || !!validationError || !email}
                >
                  {loading ? 'Sending Link...' : 'Send Reset Link'}
                </Button>
              </form>

              <div className="text-center mt-5">
                <p className="text-white/40 text-sm">
                  Remember your password?{' '}
                  <Link to="/login" className="text-[#2dd4bf] hover:text-[#2dd4bf]/80 font-medium">
                    Sign in
                  </Link>
                </p>
              </div>
            </CardContent>
           </Card>
         </div>
       </main>
       <p className="relative z-10 border-t border-white/10 pb-[max(10px,env(safe-area-inset-bottom))] pt-3 text-center text-xs text-white/35">A project by <span className="font-semibold text-white/60">HMACS Studios</span></p>
     </div>
  );
};

export default ForgotPassword;
