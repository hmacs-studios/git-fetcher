import { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bot, Zap, Brain, FileText, MessageSquare, User, Mail, Phone, BookOpen, UserCheck, Shield, ClipboardList, PenTool, Image as ImageIcon, CheckCircle, XCircle } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea'; // Assuming you have this
import ReCAPTCHA from 'react-google-recaptcha';
import Seo from '@/components/Seo'; // Import the Seo component

const TeachingAmbassadors = () => {
    const { theme } = useTheme();
    const { user } = useAuth(); // Still use useAuth to get user if they are logged in

    // Form state
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [contactNumber, setContactNumber] = useState('');
    const [gender, setGender] = useState('');
    const [teachingExperience, setTeachingExperience] = useState('');
    const [whyJoinMedistics, setWhyJoinMedistics] = useState('');
    const [selectedSubjects, setSelectedSubjects] = useState([]);
    const [profilePicture, setProfilePicture] = useState(null);
    const [cnicUpload, setCnicUpload] = useState(null);
    const [captchaVerified, setCaptchaVerified] = useState(false);
    const [submissionStatus, setSubmissionStatus] = useState(null); // 'success', 'error', 'loading'
    const [errorMessage, setErrorMessage] = useState('');

    const recaptchaRef = useRef(null);

    // List of subjects for the checklist
    const subjects = ['Biology', 'Chemistry', 'Physics', 'English', 'Logical Reasoning'];

    // Handle subject checkbox changes
    const handleSubjectChange = (subject) => {
        setSelectedSubjects(prev =>
            prev.includes(subject)
                ? prev.filter(s => s !== subject)
                : [...prev, subject]
        );
    };

    // Get user profile data (for header badge)
    const { data: profile } = useQuery({
        queryKey: ['profile', user?.id],
        queryFn: async () => {
            if (!user?.id) return null;
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .maybeSingle();

            if (error) {
                console.error('Error fetching profile:', error);
                return null;
            }
            return data;
        },
        enabled: !!user?.id // Only run if user is logged in
    });

    // Define plan color schemes (reused from AI.jsx)
    const planColors = {
        'free': {
            light: 'bg-purple-100 text-purple-800 border-purple-300',
            dark: 'dark:bg-purple-900/30 dark:text-purple-200 dark:border-purple-700'
        },
        'premium': {
            light: 'bg-yellow-100 text-yellow-800 border-yellow-300',
            dark: 'dark:bg-yellow-900/30 dark:text-yellow-200 dark:border-yellow-700'
        },
        'pro': {
            light: 'bg-green-100 text-green-800 border-green-300',
            dark: 'dark:bg-green-900/30 dark:text-green-200 dark:border-green-700'
        },
        'default': {
            light: 'bg-gray-100 text-gray-800 border-gray-300',
            dark: 'dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600'
        }
    };

    const rawUserPlan = profile?.plan?.toLowerCase() || 'free';
    const userPlanDisplayName = rawUserPlan.charAt(0).toUpperCase() + rawUserPlan.slice(1) + ' Plan';
    const currentPlanColorClasses = planColors[rawUserPlan] || planColors['default'];

    const handleFileChange = (e, setter) => {
        if (e.target.files.length > 0) {
            setter(e.target.files[0]);
        }
    };

    const handleCaptchaChange = (value) => {
        setCaptchaVerified(!!value);
    };

    const uploadFileToCloudinary = async (file, folder) => {
        const formData = new FormData();
        formData.append('file', file);
        // IMPORTANT: Ensure 'teaching_ambassador_preset' exists in your Cloudinary settings
        // and is configured for 'Unsigned' uploads.
        formData.append('upload_preset', 'TeachingAmbassadors');
        formData.append('folder', folder);

        try {
            const response = await fetch('https://api.cloudinary.com/v1_1/dabgjalqp/image/upload', { // Replace 'dabgjalqp' with your Cloudinary cloud name
                method: 'POST',
                body: formData,
            });
            const data = await response.json();
            if (response.ok) {
                return data.secure_url;
            } else {
                throw new Error(data.error?.message || 'Cloudinary upload failed');
            }
        } catch (error) {
            console.error(`Error uploading file to Cloudinary (${folder}):`, error);
            throw error;
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmissionStatus('loading');
        setErrorMessage('');

        if (!captchaVerified) {
            setErrorMessage('Please complete the CAPTCHA verification.');
            setSubmissionStatus('error');
            return;
        }

        if (!name || !email || !contactNumber || !gender || !teachingExperience || !whyJoinMedistics || selectedSubjects.length === 0 || !profilePicture || !cnicUpload) {
            setErrorMessage('Please fill in all required fields and upload all documents.');
            setSubmissionStatus('error');
            return;
        }

        try {
            // 1. Upload files to Cloudinary
            const profilePictureUrl = await uploadFileToCloudinary(profilePicture, 'medistics-teaching-ambassador/profile-pictures');
            const cnicUploadUrl = await uploadFileToCloudinary(cnicUpload, 'medistics-teaching-ambassador/cnic');

            // 2. Save application data to Supabase
            const { data, error } = await supabase
                .from('teaching_ambassador_applications') // NEW: Dedicated Supabase table
                .insert([
                    {
                        name,
                        email,
                        contact_number: contactNumber,
                        gender,
                        teaching_experience: teachingExperience,
                        why_join_medistics: whyJoinMedistics,
                        subjects: selectedSubjects, // Store as JSONB in Supabase
                        profile_picture_url: profilePictureUrl,
                        cnic_url: cnicUploadUrl,
                        user_id: user?.id || null,
                    },
                ]);

            if (error) {
                throw error;
            }

            setSubmissionStatus('success');
            // Optionally clear form fields after successful submission
            setName('');
            setEmail('');
            setContactNumber('');
            setGender('');
            setTeachingExperience('');
            setWhyJoinMedistics('');
            setSelectedSubjects([]);
            setProfilePicture(null);
            setCnicUpload(null);
            setCaptchaVerified(false);
            if (recaptchaRef.current) {
                recaptchaRef.current.reset();
            }

        } catch (error) {
            console.error('Submission error:', error);
            setErrorMessage(`Failed to submit application: ${error.message || 'An unknown error occurred.'}`);
            setSubmissionStatus('error');
        }
    };

    return (
        <div className="min-h-screen w-full bg-white dark:bg-gray-900 mb-[calc(45px+env(safe-area-inset-top))] overscroll-y-contain">
            <Seo
                title="Teaching Ambassadors"
                description="Become a Teaching Ambassador at Medmacs. Inspire and educate the next generation of medical professionals."
                canonical="https://medmacs.app/teaching-career"
                />

            <div className="container mx-auto px-4 lg:px-8 py-8 max-w-7xl pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
                {/* Hero Section */}
                <div className="text-center mb-8 animate-fade-in">
                    <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
                        🧑‍🏫 Join Our Medmacs Teaching Intership Program!
                    </h1>
                    <p className="text-lg md:text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
                        Share your expertise, mentor students, and gain incredible opportunities with Medmacs.
                    </p>
                </div>

                {/* Ambassador Application Form */}
                <Card className="max-w-3xl mx-auto p-6 bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-800 shadow-lg animate-fade-in">
                    <CardHeader className="text-center pb-6">
                        <CardTitle className="text-gray-900 dark:text-white text-2xl mb-2">Apply Now</CardTitle>
                        <CardDescription className="text-gray-600 dark:text-gray-400">
                            Fill out the form below to apply.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="name" className="text-gray-700 dark:text-gray-300 flex items-center mb-1">
                                        <User className="h-4 w-4 mr-2 text-blue-500" /> Full Name
                                    </Label>
                                    <Input id="name" type="text" placeholder="Your Full Name" value={name} onChange={(e) => setName(e.target.value)} required />
                                </div>
                                <div>
                                    <Label htmlFor="email" className="text-gray-700 dark:text-gray-300 flex items-center mb-1">
                                        <Mail className="h-4 w-4 mr-2 text-green-500" /> Email
                                    </Label>
                                    <Input id="email" type="email" placeholder="your@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="contactNumber" className="text-gray-700 dark:text-gray-300 flex items-center mb-1">
                                        <Phone className="h-4 w-4 mr-2 text-orange-500" /> Contact Number
                                    </Label>
                                    <Input id="contactNumber" type="tel" placeholder="e.g., +923001234567" value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} required />
                                </div>
                                <div>
                                    <Label htmlFor="gender" className="text-gray-700 dark:text-gray-300 flex items-center mb-1">
                                        <UserCheck className="h-4 w-4 mr-2 text-purple-500" /> Gender
                                    </Label>
                                    <Select value={gender} onValueChange={setGender} required>
                                        <SelectTrigger id="gender">
                                            <SelectValue placeholder="Select your gender" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="male">Male</SelectItem>
                                            <SelectItem value="female">Female</SelectItem>
                                            <SelectItem value="other">Other/Prefer not to say</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div>
                                <Label htmlFor="teachingExperience" className="text-gray-700 dark:text-gray-300 flex items-center mb-1">
                                    <BookOpen className="h-4 w-4 mr-2 text-red-500" /> Teaching Experience
                                </Label>
                                <Select value={teachingExperience} onValueChange={setTeachingExperience} required>
                                    <SelectTrigger id="teachingExperience">
                                        <SelectValue placeholder="Years of experience" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="less_than_1_year">Less than 1 year</SelectItem>
                                        <SelectItem value="2-3_years">2-3 years</SelectItem>
                                        <SelectItem value="4-5_years">4-5 years</SelectItem>
                                        <SelectItem value="5_plus_years">5+ years</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label className="text-gray-700 dark:text-gray-300 flex items-center mb-2">
                                    <ClipboardList className="h-4 w-4 mr-2 text-teal-500" /> Subjects You Can Teach:
                                </Label>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {subjects.map((subject) => (
                                        <div key={subject} className="flex items-center space-x-2">
                                            <input
                                                type="checkbox"
                                                id={subject}
                                                checked={selectedSubjects.includes(subject)}
                                                onChange={() => handleSubjectChange(subject)}
                                                className="form-checkbox h-4 w-4 text-blue-600 transition duration-150 ease-in-out dark:bg-gray-700 dark:border-gray-600"
                                            />
                                            <Label htmlFor={subject} className="text-gray-700 dark:text-gray-300 text-sm cursor-pointer">
                                                {subject}
                                            </Label>
                                        </div>
                                    ))}
                                </div>
                                {selectedSubjects.length === 0 && (
                                    <p className="text-red-500 text-xs mt-1">Please select at least one subject.</p>
                                )}
                            </div>

                            <div>
                                <Label htmlFor="whyJoinMedistics" className="text-gray-700 dark:text-gray-300 flex items-center mb-1">
                                    <PenTool className="h-4 w-4 mr-2 text-indigo-500" /> Why do you want to join Medmacs as a Teaching Ambassador?
                                </Label>
                                <Textarea
                                    id="whyJoinMedistics"
                                    placeholder="Write a short answer (max 500 characters)"
                                    value={whyJoinMedistics}
                                    onChange={(e) => setWhyJoinMedistics(e.target.value)}
                                    rows={4}
                                    maxLength={500}
                                    required
                                />
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    {whyJoinMedistics.length} / 500 characters
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="profilePicture" className="text-gray-700 dark:text-gray-300 flex items-center mb-1">
                                        <ImageIcon className="h-4 w-4 mr-2 text-blue-500" /> Profile Picture
                                    </Label>
                                    <Input id="profilePicture" type="file" accept="image/*" onChange={(e) => handleFileChange(e, setProfilePicture)} required />
                                    {profilePicture && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{profilePicture.name}</p>}
                                </div>
                                <div>
                                    <Label htmlFor="cnicUpload" className="text-gray-700 dark:text-gray-300 flex items-center mb-1">
                                        <Shield className="h-4 w-4 mr-2 text-green-500" /> CNIC Upload
                                    </Label>
                                    <Input id="cnicUpload" type="file" accept="image/*,application/pdf" onChange={(e) => handleFileChange(e, setCnicUpload)} required />
                                    {cnicUpload && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{cnicUpload.name}</p>}
                                </div>
                            </div>

                            <div className="flex justify-center">
                                {/* Replace YOUR_RECAPTCHA_SITE_KEY with your actual reCAPTCHA site key */}
                                <ReCAPTCHA
                                    ref={recaptchaRef}
                                    sitekey="6LeIhW0rAAAAAL2oxCpELWA74Cb93-x9utqxBAdZ" // Make sure to replace this
                                    onChange={handleCaptchaChange}
                                    theme={theme}
                                />
                            </div>

                            {submissionStatus === 'loading' && (
                                <p className="text-center text-blue-500 dark:text-blue-400 mt-4">Submitting your application...</p>
                            )}
                            {submissionStatus === 'success' && (
                                <div className="text-center text-green-600 dark:text-green-400 mt-4 flex items-center justify-center">
                                    <CheckCircle className="h-5 w-5 mr-2" /> Application submitted successfully! We'll be in touch soon.
                                </div>
                            )}
                            {submissionStatus === 'error' && (
                                <div className="text-center text-red-600 dark:text-red-400 mt-4 flex items-center justify-center">
                                    <XCircle className="h-5 w-5 mr-2" /> {errorMessage || 'An error occurred during submission. Please try again.'}
                                </div>
                            )}

                            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2" disabled={submissionStatus === 'loading'}>
                                Submit Application
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                {/* Perks of Being a Teaching Ambassador */}
                <div className="mt-12 text-center animate-fade-in">
                    <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-6">
                        🌟 Perks of Being a Medmacs Intern.
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
                        <Card className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 hover:scale-105 transition-transform duration-300">
                            <CardHeader className="text-center">
                                <Zap className="h-8 w-8 mx-auto mb-2 text-yellow-600 dark:text-yellow-400" />
                                <CardTitle className="text-gray-900 dark:text-white">Free Premium Access</CardTitle>
                                <CardDescription className="text-gray-600 dark:text-gray-400">
                                    Enjoy full access to all Medmacs Premium features.
                                </CardDescription>
                            </CardHeader>
                        </Card>

                        <Card className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 hover:scale-105 transition-transform duration-300">
                            <CardHeader className="text-center">
                                <FileText className="h-8 w-8 mx-auto mb-2 text-red-600 dark:text-red-400" />
                                <CardTitle className="text-gray-900 dark:text-white">Official Certificates</CardTitle>
                                <CardDescription className="text-gray-600 dark:text-gray-400">
                                    Receive a certificate of ambassadorship from Medmacs.
                                </CardDescription>
                            </CardHeader>
                        </Card>

                        <Card className="bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800 hover:scale-105 transition-transform duration-300">
                            <CardHeader className="text-center">
                                <ImageIcon className="h-8 w-8 mx-auto mb-2 text-purple-600 dark:text-purple-400" /> {/* Changed to ImageIcon */}
                                <CardTitle className="text-gray-900 dark:text-white">Website Feature</CardTitle>
                                <CardDescription className="text-gray-600 dark:text-gray-400">
                                    Get featured on the official Medmacs website as an ambassador.
                                </CardDescription>
                            </CardHeader>
                        </Card>

                        <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 hover:scale-105 transition-transform duration-300">
                            <CardHeader className="text-center">
                                <MessageSquare className="h-8 w-8 mx-auto mb-2 text-blue-600 dark:text-blue-400" />
                                <CardTitle className="text-gray-900 dark:text-white">Private Teaching Opportunities</CardTitle>
                                <CardDescription className="text-gray-600 dark:text-gray-400">
                                    Connect with students seeking private tutoring through Medmacs.
                                </CardDescription>
                            </CardHeader>
                        </Card>

                        <Card className="bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-800 hover:scale-105 transition-transform duration-300">
                            <CardHeader className="text-center">
                                <Brain className="h-8 w-8 mx-auto mb-2 text-teal-600 dark:text-teal-400" />
                                <CardTitle className="text-gray-900 dark:text-white">Exclusive Features</CardTitle>
                                <CardDescription className="text-gray-600 dark:text-gray-400">
                                    Gain early access to new Medmacs features for educators.
                                </CardDescription>
                            </CardHeader>
                        </Card>

                        <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 hover:scale-105 transition-transform duration-300">
                            <CardHeader className="text-center">
                                <Bot className="h-8 w-8 mx-auto mb-2 text-green-600 dark:text-green-400" />
                                <CardTitle className="text-gray-900 dark:text-white">Learning Seminars & Bonuses</CardTitle>
                                <CardDescription className="text-gray-600 dark:text-gray-400">
                                    Access specialized seminars and earn performance bonuses.
                                </CardDescription>
                            </CardHeader>
                        </Card>
                    </div>
                </div>

                {/* Info Section (reused from AI.jsx for consistent look) */}
                <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg text-sm text-blue-800 dark:text-blue-200 max-w-4xl mx-auto mt-12">
                    <div className="flex items-start space-x-2">
                        <Bot className="h-5 w-5 mt-0.5 flex-shrink-0" />
                        <div>
                            <p className="font-medium mb-2">Medmacs Teaching Intership Program Details:</p>
                            <ul className="space-y-1 text-xs">
                                <li>• <strong>Share Knowledge:</strong> Help students excel in their studies by providing guidance and teaching.</li>
                                <li>• <strong>Content Creation:</strong> Contribute to Medmacs' educational resources.</li>
                                <li>• <strong>Community Building:</strong> Foster a vibrant learning environment among students and peers.</li>
                                <li>• <strong>Professional Growth:</strong> Enhance your teaching skills and build a professional portfolio.</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TeachingAmbassadors;
