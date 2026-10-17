import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/components/ui/use-toast'; // Assuming you have a toast system
import { ArrowLeft, Upload, User, Mail, Phone, Briefcase, Lightbulb, FileImage, CreditCard, Loader2, RefreshCw, CheckCircle, Sparkles } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

import { ProfileDropdown } from '@/components/ProfileDropdown'; // NEW: Import ProfileDropdown
import Seo from '@/components/Seo'; // Import the Seo component
import PlanBadge from '@/components/PlanBadge';


// Cloudinary configuration
const CLOUDINARY_CLOUD_NAME = 'dsrzawwej';
const CLOUDINARY_UPLOAD_PRESET = 'internship_applications';
const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

// Constants for file validation
const MAX_FILE_SIZE_MB = 2;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

const InternshipApplication = () => {
  const { toast } = useToast();
  const { user } = useAuth();

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [gender, setGender] = useState('');
  const [skillExperience, setSkillExperience] = useState('');
  const [whyJoinMedmacs, setWhyJoinMedmacs] = useState('');
  const [otherSkills, setOtherSkills] = useState('');
  const [skillsToApply, setSkillsToApply] = useState<string[]>([]);
  const [profilePictureFile, setProfilePictureFile] = useState<File | null>(null);
  const [cnicStudentCardFile, setCnicStudentCardFile] = useState<File | null>(null);

  // Local CAPTCHA states
  const [captchaValue, setCaptchaValue] = useState('');
  const [userCaptchaInput, setUserCaptchaInput] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [profilePictureUploading, setProfilePictureUploading] = useState(false);
  const [cnicStudentCardUploading, setCnicStudentCardUploading] = useState(false);

  // Function to generate a random CAPTCHA string
  const generateCaptcha = () => {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setCaptchaValue(result);
    setUserCaptchaInput(''); // Clear user input on refresh
  };

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Prefill name and email from logged-in user and generate CAPTCHA on mount if not logged in
  useEffect(() => {
    if (user) {
      setName(user.user_metadata?.full_name || user.email?.split('@')[0] || '');
      setEmail(user.email || '');
    } else {
      generateCaptcha(); // Generate CAPTCHA if user is not logged in
    }
  }, [user]);


  // Get user profile data for the badge (same as MCQs.tsx)
  const { data: profile } = useQuery({
    queryKey: ['profile-plan', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('plan')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching profile:', error);
        return null;
      }
      return data;
    },
    enabled: !!user?.id
  });
  // File validation helper function
  const validateFile = (file: File | null, fieldName: string): boolean => {
    if (!file) {
      toast({
        title: "File Missing",
        description: `Please upload a ${fieldName}.`,
        variant: "destructive",
      });
      return false;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast({
        title: "File Too Large",
        description: `${fieldName} must be less than ${MAX_FILE_SIZE_MB}MB.`,
        variant: "destructive",
      });
      return false;
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toast({
        title: "Invalid File Type",
        description: `Please upload a valid image file for ${fieldName} (JPEG, PNG, GIF, WEBP).`,
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  // Handle file uploads to Cloudinary
  const uploadFileToCloudinary = async (file: File, fileType: 'profile_picture' | 'cnic_student_card') => {
    // Validation is now done in handleChange functions, but a final check here is good
    if (!file || !validateFile(file, fileType.replace(/_/g, ' '))) {
      return null;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

    try {
      if (fileType === 'profile_picture') setProfilePictureUploading(true);
      else setCnicStudentCardUploading(true);

      const response = await fetch(CLOUDINARY_UPLOAD_URL, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (response.ok && data.secure_url) {
        return data.secure_url;
      } else {
        throw new Error(data.error?.message || 'Cloudinary upload failed');
      }
    } catch (error) {
      console.error(`Error uploading ${fileType} to Cloudinary:`, error);
      toast({
        title: "Upload Error",
        description: `Failed to upload ${fileType.replace(/_/g, ' ')}. Please try again.`,
        variant: "destructive",
      });
      return null;
    } finally {
      if (fileType === 'profile_picture') setProfilePictureUploading(false);
      else setCnicStudentCardUploading(false);
    }
  };

  // Handle checkbox changes for skills to apply
  const handleSkillsToApplyChange = (skill: string, checked: boolean) => {
    setSkillsToApply(prev =>
      checked ? [...prev, skill] : prev.filter(s => s !== skill)
    );
  };

  // Handle file input change with validation
  const handleProfilePictureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files ? e.target.files[0] : null;
    if (file && validateFile(file, 'Profile Picture')) {
      setProfilePictureFile(file);
    } else {
      setProfilePictureFile(null); // Clear selected file if invalid
      e.target.value = ''; // Clear the input field
    }
  };

  const handleCnicStudentCardChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files ? e.target.files[0] : null;
    if (file && validateFile(file, 'CNIC/Student Card')) {
      setCnicStudentCardFile(file);
    } else {
      setCnicStudentCardFile(null); // Clear selected file if invalid
      e.target.value = ''; // Clear the input field
    }
  };


  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Basic validation
    if (!name || !email || !contactNumber || !gender || !skillExperience || !whyJoinMedmacs || skillsToApply.length === 0 || !profilePictureFile || !cnicStudentCardFile) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields and upload both pictures.",
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    // CAPTCHA validation for non-logged-in users
    if (!user) {
      if (userCaptchaInput.toLowerCase() !== captchaValue.toLowerCase()) {
        toast({
          title: "CAPTCHA Mismatch",
          description: "The CAPTCHA you entered is incorrect. Please try again.",
          variant: "destructive",
        });
        generateCaptcha(); // Generate new CAPTCHA on failure
        setIsSubmitting(false);
        return;
      }
    }

    // Re-validate files just before submission to be safe
    if (!validateFile(profilePictureFile, 'Profile Picture') || !validateFile(cnicStudentCardFile, 'CNIC/Student Card')) {
      setIsSubmitting(false);
      return;
    }

    if (skillExperience.length < 70 || skillExperience.length > 500) {
      toast({
        title: "Validation Error",
        description: "Skill & Experience must be between 70 and 500 characters.",
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    if (whyJoinMedmacs.length < 70 || whyJoinMedmacs.length > 500) {
      toast({
        title: "Validation Error",
        description: "Why join Medmacs? must be between 70 and 500 characters.",
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    // New validation for otherSkills (optional but with max length)
    if (otherSkills.length > 500) {
      toast({
        title: "Validation Error",
        description: "Other Relevant Skills must be maximum 500 characters.",
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    try {
      // Upload files to Cloudinary
      const profilePicUrl = await uploadFileToCloudinary(profilePictureFile, 'profile_picture');
      const cnicStudentUrl = await uploadFileToCloudinary(cnicStudentCardFile, 'cnic_student_card');

      if (!profilePicUrl || !cnicStudentUrl) {
        setIsSubmitting(false);
        return; // Stop if any upload fails (error toast already shown by uploadFileToCloudinary)
      }

      // Insert data into Supabase
      const { data, error } = await supabase
        .from('internship_applications')
        .insert({
          user_id: user?.id,
          name,
          email,
          contact_number: contactNumber,
          gender,
          skill_experience: skillExperience,
          why_join_medistics: whyJoinMedmacs,
          user_skills: otherSkills,
          skills_to_apply: skillsToApply, // Stored as JSONB array
          profile_picture_url: profilePicUrl,
          cnic_student_card_url: cnicStudentUrl,
          application_status: 'Pending', // Default status
        });

      if (error) {
        throw error;
      }

      toast({
        title: "Application Submitted!",
        description: "Your internship application has been successfully submitted.",
        variant: "default",
      });

      // Optionally clear form or redirect
      setName(user?.user_metadata?.full_name || user?.email?.split('@')[0] || '');
      setEmail(user?.email || '');
      setContactNumber('');
      setGender('');
      setSkillExperience('');
      setWhyJoinMedmacs('');
      setOtherSkills('');
      setSkillsToApply([]);
      setProfilePictureFile(null);
      setCnicStudentCardFile(null);
      // Generate new CAPTCHA after successful submission if not logged in
      if (!user) {
        generateCaptcha();
      }

    } catch (error: any) {
      console.error('Error submitting application:', error);
      toast({
        title: "Submission Error",
        description: `Failed to submit application: ${error.message || 'Please try again.'}`,
        variant: "destructive",
      });
      // Generate new CAPTCHA on error if not logged in
      if (!user) {
        generateCaptcha();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-background relative overflow-x-hidden">
      <Seo
        title="Join Medmacs Program"
        description="Apply for the Medmacs App Summer Internship Program 2025. Gain hands-on experience in a dynamic EdTech environment."
        canonical="https://medmacs.app/summerinternship2025"
      />

      {/* Modern Live Background */}
      <div className="fixed inset-0 z-0 bg-[#020617]">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#2dd4bf]/20 rounded-full blur-[120px] animate-pulse pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#0ea5e9]/15 rounded-full blur-[120px] animate-pulse pointer-events-none" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-[0.03] pointer-events-none" style={{
          backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 40px, rgba(255,255,255,0.2) 40px, rgba(255,255,255,0.2) 41px)`
        }} />
      </div>

      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-[#020617]/40 backdrop-blur-2xl border-b border-white/5 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
        <div className="container mx-auto px-4 lg:px-8 py-3 flex justify-between items-center max-w-7xl">
          <Link to="/dashboard" className="flex items-center space-x-2 text-white/50 hover:text-[#2dd4bf] transition-colors group">
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span className="hidden sm:inline font-bold text-sm">Dashboard</span>
          </Link>

          <div className="flex items-center space-x-3">
            <img src="/lovable-uploads/bf69a7f7-550a-45a1-8808-a02fb889f8c5.png" alt="Logo" className="w-8 h-8 object-contain animate-float" />
            <span className="text-xl font-black tracking-tight text-white hidden sm:inline uppercase italic">Collaborate</span>
            <span className="text-sm font-black text-white sm:hidden italic">Collaborate</span>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-4">
            <PlanBadge plan={profile?.plan} />
            <ProfileDropdown />
          </div>
        </div>
      </div>



      <div className="relative z-10 container mx-auto px-4 lg:px-8 py-12 max-w-3xl pt-[calc(100px+env(safe-area-inset-top))]">
        <Card className="bg-white/[0.03] backdrop-blur-3xl border-white/10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] rounded-[2.5rem] overflow-hidden">
          <CardHeader className="text-center pb-8 border-b border-white/5 bg-gradient-to-b from-white/[0.02] to-transparent pt-10">
            <div className="mx-auto w-20 h-20 bg-gradient-to-br from-[#2dd4bf] to-[#0ea5e9] rounded-3xl flex items-center justify-center mb-6 shadow-2xl shadow-[#2dd4bf]/20 animate-float">
              <Briefcase className="w-10 h-10 text-white" />
            </div>
            <CardTitle className="text-4xl font-black text-white tracking-tight italic">
              Apply for <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#2dd4bf] to-[#67e8f9]">Internship</span>
            </CardTitle>
            <CardDescription className="text-xs font-bold text-white/40 mt-3 uppercase tracking-[0.3em]">
              Summer 2025 Program
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8 sm:p-10">
            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Name */}
                <div className="space-y-2">
                  <Label htmlFor="name" className="flex items-center gap-2 text-white/50 text-[10px] font-black uppercase tracking-widest pl-1">
                    <User className="w-3.5 h-3.5" /> Full Name
                  </Label>
                  <Input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Doe"
                    required
                    className="bg-white/[0.05] border-white/10 text-white focus:border-[#2dd4bf]/50 focus:ring-[#2dd4bf]/20 h-14 rounded-2xl transition-all"
                    disabled={!!user?.user_metadata?.full_name}
                  />
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center gap-2 text-white/50 text-[10px] font-black uppercase tracking-widest pl-1">
                    <Mail className="w-3.5 h-3.5" /> Email Address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="john@example.com"
                    required
                    className="bg-white/[0.05] border-white/10 text-white focus:border-[#2dd4bf]/50 focus:ring-[#2dd4bf]/20 h-14 rounded-2xl transition-all"
                    disabled={!!user?.email}
                  />
                </div>

                {/* Contact Number */}
                <div className="space-y-2">
                  <Label htmlFor="contact_number" className="flex items-center gap-2 text-white/50 text-[10px] font-black uppercase tracking-widest pl-1">
                    <Phone className="w-3.5 h-3.5" /> Contact Number
                  </Label>
                  <Input
                    id="contact_number"
                    type="tel"
                    value={contactNumber}
                    onChange={(e) => setContactNumber(e.target.value)}
                    placeholder="+92 300 1234567"
                    required
                    className="bg-white/[0.05] border-white/10 text-white focus:border-[#2dd4bf]/50 focus:ring-[#2dd4bf]/20 h-14 rounded-2xl transition-all"
                  />
                </div>

                {/* Gender */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-white/50 text-[10px] font-black uppercase tracking-widest pl-1">
                    <User className="w-3.5 h-3.5" /> Gender Identity
                  </Label>
                  <RadioGroup value={gender} onValueChange={setGender} required className="flex p-1 bg-white/[0.05] border border-white/10 rounded-2xl h-14 items-center px-4">
                    <div className="flex-1 flex items-center justify-center space-x-2">
                      <RadioGroupItem value="Male" id="gender-male" className="border-white/20 text-[#2dd4bf] focus-visible:ring-[#2dd4bf]" />
                      <Label htmlFor="gender-male" className="text-white/70 text-sm font-bold cursor-pointer">Male</Label>
                    </div>
                    <div className="w-[1px] h-6 bg-white/10 mx-2" />
                    <div className="flex-1 flex items-center justify-center space-x-2">
                      <RadioGroupItem value="Female" id="gender-female" className="border-white/20 text-[#2dd4bf] focus-visible:ring-[#2dd4bf]" />
                      <Label htmlFor="gender-female" className="text-white/70 text-sm font-bold cursor-pointer">Female</Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>

              {/* Skills to Apply For */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2 text-white/50 text-[10px] font-black uppercase tracking-widest pl-1">
                  <Briefcase className="w-3.5 h-3.5" /> Expertise Domains
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-white/[0.02] border border-white/10 rounded-3xl">
                  {['Academics & Content', 'Tech & AI', 'Marketing & Social Media', 'Digital Content'].map(skill => (
                    <div key={skill} className={`flex items-center space-x-3 p-3 rounded-2xl transition-all ${skillsToApply.includes(skill) ? 'bg-[#2dd4bf]/10 border-[#2dd4bf]/30' : 'bg-transparent border-transparent'} border`}>
                      <Checkbox
                        id={`skill-${skill.toLowerCase().replace(/[^a-z0-9]/g, '')}`}
                        checked={skillsToApply.includes(skill)}
                        onCheckedChange={(checked) => handleSkillsToApplyChange(skill, checked as boolean)}
                        className="border-white/20 data-[state=checked]:bg-[#2dd4bf] data-[state=checked]:border-[#2dd4bf]"
                      />
                      <Label htmlFor={`skill-${skill.toLowerCase().replace(/[^a-z0-9]/g, '')}`} className="text-white/80 text-xs font-bold cursor-pointer select-none">{skill}</Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Why join Medmacs? */}
              <div className="space-y-3">
                <Label htmlFor="why_join_medistics" className="flex items-center gap-2 text-white/50 text-[10px] font-black uppercase tracking-widest pl-1">
                  <Lightbulb className="w-3.5 h-3.5" /> Why join Medmacs?
                </Label>
                <div className="relative">
                  <Textarea
                    id="why_join_medistics"
                    value={whyJoinMedmacs}
                    onChange={(e) => setWhyJoinMedmacs(e.target.value)}
                    placeholder="Tell us what excites you about our mission..."
                    rows={4}
                    minLength={70}
                    maxLength={500}
                    required
                    className="bg-white/[0.05] border-white/10 text-white focus:border-[#2dd4bf]/50 focus:ring-[#2dd4bf]/20 rounded-2xl p-4 transition-all resize-none leading-relaxed text-sm"
                  />
                  <div className={`absolute bottom-3 right-3 text-[10px] font-bold px-2 py-1 rounded-md ${whyJoinMedmacs.length < 70 ? 'bg-orange-500/20 text-orange-400' : 'bg-[#2dd4bf]/20 text-[#2dd4bf]'}`}>
                    {whyJoinMedmacs.length}/500
                  </div>
                </div>
              </div>

              {/* Skill & Experience */}
              <div className="space-y-3">
                <Label htmlFor="skill_experience" className="flex items-center gap-2 text-white/50 text-[10px] font-black uppercase tracking-widest pl-1">
                  <Briefcase className="w-3.5 h-3.5" /> Relevant Background
                </Label>
                <div className="relative">
                  <Textarea
                    id="skill_experience"
                    value={skillExperience}
                    onChange={(e) => setSkillExperience(e.target.value)}
                    placeholder="Describe your previous roles, projects or skills..."
                    rows={4}
                    minLength={70}
                    maxLength={500}
                    required
                    className="bg-white/[0.05] border-white/10 text-white focus:border-[#2dd4bf]/50 focus:ring-[#2dd4bf]/20 rounded-2xl p-4 transition-all resize-none leading-relaxed text-sm"
                  />
                  <div className={`absolute bottom-3 right-3 text-[10px] font-bold px-2 py-1 rounded-md ${skillExperience.length < 70 ? 'bg-orange-500/20 text-orange-400' : 'bg-[#2dd4bf]/20 text-[#2dd4bf]'}`}>
                    {skillExperience.length}/500
                  </div>
                </div>
              </div>

              {/* Other Skills */}
              <div className="space-y-2">
                <Label htmlFor="user_skills" className="flex items-center gap-2 text-white/50 text-[10px] font-black uppercase tracking-widest pl-1">
                  <Sparkles className="w-3.5 h-3.5" /> Additional Skills
                </Label>
                <Input
                  id="user_skills"
                  value={otherSkills}
                  onChange={(e) => setOtherSkills(e.target.value)}
                  placeholder="Programming, Design, Languages, etc."
                  maxLength={500}
                  className="bg-white/[0.05] border-white/10 text-white focus:border-[#2dd4bf]/50 focus:ring-[#2dd4bf]/20 h-14 rounded-2xl transition-all"
                />
              </div>

              {/* Uploads Container */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-6 bg-white/[0.03] border border-white/10 rounded-[2rem]">
                {/* Profile Picture */}
                <div className="space-y-4">
                  <Label className="text-white/50 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 pl-1">
                    <FileImage className="w-3.5 h-3.5" /> Profile Image
                  </Label>
                  <label className="group relative flex flex-col items-center justify-center h-48 border-2 border-dashed border-white/10 hover:border-[#2dd4bf]/30 rounded-[1.5rem] bg-white/[0.02] cursor-pointer transition-all overflow-hidden text-center p-4">
                    <input type="file" className="hidden" accept="image/*" onChange={handleProfilePictureChange} required />
                    {profilePictureFile ? (
                      <div className="relative w-full h-full">
                        <img src={URL.createObjectURL(profilePictureFile)} alt="Preview" className="w-full h-full object-cover rounded-[1rem] opacity-40" />
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
                          <CheckCircle className="w-8 h-8 text-[#2dd4bf] mb-2" />
                          <p className="text-white text-[10px] font-black truncate w-full px-2">{profilePictureFile.name}</p>
                          <p className="text-[#2dd4bf] text-[9px] font-bold mt-1 uppercase">Replace Image</p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center mb-3 group-hover:scale-110 group-hover:bg-[#2dd4bf]/10 transition-all">
                          <Upload className="w-5 h-5 text-white/30 group-hover:text-[#2dd4bf]" />
                        </div>
                        <p className="text-white/60 text-xs font-bold leading-tight">Click to upload<br /><span className="text-white/20 text-[10px]">JPG, PNG or WebP</span></p>
                      </>
                    )}
                    {profilePictureUploading && (
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                        <Loader2 className="w-6 h-6 text-[#2dd4bf] animate-spin" />
                      </div>
                    )}
                  </label>
                </div>

                {/* Identity Doc */}
                <div className="space-y-4">
                  <Label className="text-white/50 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 pl-1">
                    <CreditCard className="w-3.5 h-3.5" /> Student Identity
                  </Label>
                  <label className="group relative flex flex-col items-center justify-center h-48 border-2 border-dashed border-white/10 hover:border-[#2dd4bf]/30 rounded-[1.5rem] bg-white/[0.02] cursor-pointer transition-all overflow-hidden text-center p-4">
                    <input type="file" className="hidden" accept="image/*" onChange={handleCnicStudentCardChange} required />
                    {cnicStudentCardFile ? (
                      <div className="relative w-full h-full">
                        <img src={URL.createObjectURL(cnicStudentCardFile)} alt="Preview" className="w-full h-full object-cover rounded-[1rem] opacity-40" />
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
                          <CheckCircle className="w-8 h-8 text-[#2dd4bf] mb-2" />
                          <p className="text-white text-[10px] font-black truncate w-full px-2">{cnicStudentCardFile.name}</p>
                          <p className="text-[#2dd4bf] text-[9px] font-bold mt-1 uppercase">Replace Doc</p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center mb-3 group-hover:scale-110 group-hover:bg-[#2dd4bf]/10 transition-all">
                          <FileImage className="w-5 h-5 text-white/30 group-hover:text-[#2dd4bf]" />
                        </div>
                        <p className="text-white/60 text-xs font-bold leading-tight">Identity/CNIC<br /><span className="text-white/20 text-[10px]">JPG, PNG or WebP</span></p>
                      </>
                    )}
                    {cnicStudentCardUploading && (
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                        <Loader2 className="w-6 h-6 text-[#2dd4bf] animate-spin" />
                      </div>
                    )}
                  </label>
                </div>
              </div>

              {/* CAPTCHA */}
              {!user && (
                <div className="flex flex-col items-center justify-center py-8 p-6 bg-[#2dd4bf]/5 border border-[#2dd4bf]/10 rounded-[2rem] gap-4">
                  <p className="text-[10px] font-black text-[#2dd4bf] uppercase tracking-[0.2em] mb-1">Human Verification</p>
                  <div className="flex items-center gap-4">
                    <div className="text-3xl font-black italic tracking-[0.3em] text-white bg-white/5 px-8 py-4 rounded-2xl border border-white/10 shadow-inner select-none">
                      {captchaValue}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={generateCaptcha}
                      className="w-12 h-12 rounded-xl border-white/10 bg-white/5 text-[#2dd4bf] hover:bg-[#2dd4bf]/10 hover:border-[#2dd4bf]/30 transition-all"
                    >
                      <RefreshCw className="w-5 h-5" />
                    </Button>
                  </div>
                  <Input
                    type="text"
                    value={userCaptchaInput}
                    onChange={(e) => setUserCaptchaInput(e.target.value)}
                    placeholder="Type the characters above"
                    className="w-full max-w-xs text-center rounded-2xl border-white/10 bg-white/5 text-white focus:border-[#2dd4bf]/50 focus:ring-[#2dd4bf]/20 h-12 font-bold tracking-widest placeholder:text-white/20 placeholder:font-normal placeholder:tracking-normal"
                  />
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-16 bg-gradient-to-r from-[#2dd4bf] to-[#0ea5e9] hover:from-[#2dd4bf]/90 hover:to-[#0ea5e9]/90 text-white font-black text-sm uppercase tracking-[0.2em] rounded-2.5xl shadow-2xl shadow-[#2dd4bf]/20 transition-all duration-500 transform hover:scale-[1.01] active:scale-[0.98] disabled:opacity-50 group overflow-hidden relative"
                disabled={isSubmitting || profilePictureUploading || cnicStudentCardUploading || (!user && userCaptchaInput.toLowerCase() !== captchaValue.toLowerCase())}
              >
                <div className="absolute inset-0 bg-white/10 group-hover:translate-x-full transition-transform duration-1000 ease-in-out -translate-x-full" />
                <div className="relative flex items-center justify-center">
                  {isSubmitting ? (
                    <Loader2 className="w-6 h-6 mr-3 animate-spin" />
                  ) : (
                    <Sparkles className="w-5 h-5 mr-3 animate-pulse" />
                  )}
                  {isSubmitting ? 'Processing Application...' : 'Send Application'}
                </div>
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <footer className="py-12 border-t border-white/5 mt-12 bg-white/[0.01] relative z-10">
        <div className="container mx-auto px-4 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.5em] text-white/5 mb-3">A Project by Hmacs Studios</p>
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/10">© 2026 Medmacs App all rights reserved</p>
        </div>
      </footer>

      <style>{`
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .rounded-2.5xl {
          border-radius: 1.25rem;
        }
      `}</style>
    </div>
  );
};

export default InternshipApplication;
