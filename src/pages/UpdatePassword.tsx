import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, CheckCircle, XCircle, ArrowLeft } from 'lucide-react';

const UpdatePassword = () => {
  type PasswordErrors = {
    password?: string;
    confirmPassword?: string;
  };
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation(); // To get URL parameters like access_token

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [validationErrors, setValidationErrors] = useState<PasswordErrors>({});
  const [isTokenValid, setIsTokenValid] = useState(false); // To check if the reset token is valid

  // Validate password and confirm password in real-time
  useEffect(() => {
    const errors: PasswordErrors = {};

    if (password) {
      if (password.length < 8) {
        errors.password = 'Password must be at least 8 characters.';
      } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
        errors.password = 'Password must contain at least one uppercase letter, one lowercase letter, and one number.';
      }
    }

    if (confirmPassword && password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    } else if (confirmPassword && !password) {
      errors.confirmPassword = 'Please enter your new password first.';
    }
    setValidationErrors(errors);
  }, [password, confirmPassword]);

  // Check if access token is present in URL on component mount
  useEffect(() => {
    const checkToken = async () => {
      // Supabase automatically handles session from URL hash if user clicked magic link
      // We can check if a session exists after render.
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setIsTokenValid(true);
      } else {
        // If no session, it means the token might be invalid or expired.
        // Supabase often clears invalid tokens from the URL.
        toast({
          title: "Invalid or Expired Link",
          description: "The password reset link is invalid or has expired. Please request a new one.",
          variant: "destructive",
          duration: 7000,
        });
        // Redirect to forgot password to request new link
        navigate('/forgot-password');
      }
    };
    checkToken();
  }, [navigate, toast]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isTokenValid) {
      toast({
        title: "Error",
        description: "Cannot reset password. Invalid or expired link.",
        variant: "destructive",
      });
      return;
    }

    if (!password || !confirmPassword) {
      toast({
        title: "Missing Information",
        description: "Please fill in both new password fields.",
        variant: "destructive",
      });
      return;
    }

    if (Object.keys(validationErrors).length > 0) {
      toast({
        title: "Validation Error",
        description: "Please fix the password errors before submitting.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Supabase's updateUser function updates the password for the current user session
      const { data, error } = await supabase.auth.updateUser({ password: password });

      if (error) {
        throw error;
      }

      toast({
        title: "Password Updated!",
        description: "Your password has been successfully reset. You can now log in with your new password.",
        duration: 7000,
      });
      navigate('/login'); // Redirect to login page

    } catch (error) {
      console.error("Error updating password:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "An unexpected error occurred while updating password. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getInputIcon = (fieldName) => {
    if (password && !validationErrors.password) {
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    }
    if (validationErrors.password) {
      return <XCircle className="w-4 h-4 text-red-500" />;
    }
    return null;
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_12%_12%,#f0abfc_0%,transparent_32%),radial-gradient(circle_at_90%_85%,#fbcfe8_0%,transparent_35%),linear-gradient(135deg,#faf5ff_0%,#fff_50%,#fdf2f8_100%)] px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-[max(16px,env(safe-area-inset-top))]">
      <Link to="/login" className="absolute left-5 top-[max(16px,env(safe-area-inset-top))] flex items-center gap-2 text-sm font-semibold text-purple-700/70 transition-colors hover:text-purple-900"><ArrowLeft className="h-4 w-4" /> Back to login</Link>
      <div className="w-full max-w-md space-y-6 animate-fade-in">
        <div className="text-center">
          <img src="/assets/brand/medmacs-logo.png" alt="Medmacs" className="mx-auto mb-6 h-14 w-14 object-contain" onError={(event) => { event.currentTarget.src = "/lovable-uploads/bf69a7f7-550a-45a1-8808-a02fb889f8c5.png"; }} />
          <h1 className="font-['Bricolage_Grotesque'] text-3xl font-extrabold tracking-tight text-gray-900">Set New Password</h1>
          <p className="mt-2 text-gray-600">Enter and confirm your new password below.</p>
        </div>

        <Card className="rounded-[2rem] border-purple-200/80 bg-white/80 shadow-[0_24px_70px_rgba(168,85,247,.16)] backdrop-blur-xl">
          <CardHeader>
            <CardTitle>Update Your Password</CardTitle>
            <CardDescription>
              Please enter your new password. Make sure it's strong and unique.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter new password"
                    className={validationErrors.password ? "border-red-500" : ""}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide new password" : "Show new password"}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <div className="absolute right-8 top-1/2 transform -translate-y-1/2">
                    {getInputIcon('password')}
                  </div>
                </div>
                {validationErrors.password && (
                  <p className="text-red-500 text-sm">{validationErrors.password}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className={validationErrors.confirmPassword ? "border-red-500" : ""}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    aria-label={showConfirmPassword ? "Hide password confirmation" : "Show password confirmation"}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {validationErrors.confirmPassword && (
                  <p className="text-red-500 text-sm">{validationErrors.confirmPassword}</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                disabled={loading || !isTokenValid || Object.keys(validationErrors).length > 0 || !password || !confirmPassword}
              >
                {loading ? 'Updating Password...' : 'Update Password'}
              </Button>
            </form>

            <div className="text-center mt-4">
              <p className="text-gray-600 dark:text-gray-300">
                <Link to="/login" className="text-purple-600 hover:text-purple-700 font-medium">
                  Go to Login
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default UpdatePassword;
