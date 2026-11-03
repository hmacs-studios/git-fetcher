import { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bot, Zap, Brain, FileText, MessageSquare, User, Mail, Phone, GraduationCap, University, Image, IdCard, FileCheck, CheckCircle, XCircle } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ReCAPTCHA from 'react-google-recaptcha';

import Seo from '@/components/Seo'; // Import the Seo component

const CareerAmbassador = () => {
    const { theme, setTheme } = useTheme();
    const { user } = useAuth(); // Still use useAuth to get user if they are logged in

    // Form state
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [contactNumber, setContactNumber] = useState('');
    const [education, setEducation] = useState('');
    const [collegeName, setCollegeName] = useState('');
    const [profilePicture, setProfilePicture] = useState(null);
    const [collegeIdCard, setCollegeIdCard] = useState(null);
    const [recentMarksheet, setRecentMarksheet] = useState(null);
    const [captchaVerified, setCaptchaVerified] = useState(false);
    const [submissionStatus, setSubmissionStatus] = useState(null); // 'success', 'error', 'loading'
    const [errorMessage, setErrorMessage] = useState('');

    const recaptchaRef = useRef(null);

    // Get user profile data (for header badge)
    // This query is still useful for displaying user info in the header if they are logged in.
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
        formData.append('upload_preset', 'Ambassador');
        formData.append('folder', folder);

        try {
            const response = await fetch('https://api.cloudinary.com/v1_1/dabgjalqp/image/upload', {
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

        if (!name || !email || !contactNumber || !education || !collegeName || !profilePicture || !collegeIdCard || !recentMarksheet) {
            setErrorMessage('Please fill in all required fields and upload all documents.');
            setSubmissionStatus('error');
            return;
        }

        try {
            // 1. Upload files to Cloudinary
            const profilePictureUrl = await uploadFileToCloudinary(profilePicture, 'medistics-ambassador/profile-pictures');
            const collegeIdCardUrl = await uploadFileToCloudinary(collegeIdCard, 'medistics-ambassador/college-ids');
            const recentMarksheetUrl = await uploadFileToCloudinary(recentMarksheet, 'medistics-ambassador/marksheet');

            // 2. Save application data to Supabase
            // user_id will be user?.id if logged in, otherwise null.
            const { data, error } = await supabase
                .from('ambassador_applications')
                .insert([
                    {
                        name,
                        email,
                        contact_number: contactNumber,
                        education,
                        college_name: collegeName,
                        profile_picture_url: profilePictureUrl,
                        college_id_card_url: collegeIdCardUrl,
                        recent_marksheet_url: recentMarksheetUrl,
                        user_id: user?.id || null, // Key change: Pass user?.id or null
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
            setEducation('');
            setCollegeName('');
            setProfilePicture(null);
            setCollegeIdCard(null);
            setRecentMarksheet(null);
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
        <div className="min-h-screen w-full bg-white dark:bg-gray-900">
            <Seo
            title="Career Opportunities"
            description="Explore exciting career opportunities at Medmacs. Join our team and contribute to revolutionizing medical education."
            canonical="https://medmacs.app/career"
            />

            <div className="container mx-auto px-4 lg:px-8 py-8 max-w-7xl pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
                {/* Hero Section */}
                <div className="text-center mb-8 animate-fade-in">
                    <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4 pt-[calc(45px+env(safe-area-inset-top))] overscroll-y-contain">
                        🌍 Join Our Medmacs Ambassador Program!
                    </h1>
                    <p className="text-lg md:text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
                        Be a part of our mission to revolutionize medical education. Empower your peers and gain exclusive benefits!
                    </p>
                </div>

                {/* Ambassador Application Form */}
                <Card className="max-w-3xl mx-auto p-6 bg-white dark:bg-gray-800 border border-purple-200 dark:border-purple-800 shadow-lg animate-fade-in">
                    <CardHeader className="text-center pb-6">
                        <CardTitle className="text-gray-900 dark:text-white text-2xl mb-2">Apply Now</CardTitle>
                        <CardDescription className="text-gray-600 dark:text-gray-400">
                            Fill out the form below to become a Medmacs Campus Ambassador.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="name" className="text-gray-700 dark:text-gray-300 flex items-center mb-1">
                                        <User className="h-4 w-4 mr-2 text-purple-500" /> Full Name
                                    </Label>
                                    <Input id="name" type="text" placeholder="Your Full Name" value={name} onChange={(e) => setName(e.target.value)} required />
                                </div>
                                <div>
                                    <Label htmlFor="email" className="text-gray-700 dark:text-gray-300 flex items-center mb-1">
                                        <Mail className="h-4 w-4 mr-2 text-blue-500" /> Email
                                    </Label>
                                    <Input id="email" type="email" placeholder="your@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="contactNumber" className="text-gray-700 dark:text-gray-300 flex items-center mb-1">
                                        <Phone className="h-4 w-4 mr-2 text-green-500" /> Contact Number
                                    </Label>
                                    <Input id="contactNumber" type="tel" placeholder="e.g., +923001234567" value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} required />
                                </div>
                                <div>
                                    <Label htmlFor="education" className="text-gray-700 dark:text-gray-300 flex items-center mb-1">
                                        <GraduationCap className="h-4 w-4 mr-2 text-orange-500" /> Education Level
                                    </Label>
                                    <Select value={education} onValueChange={setEducation} required>
                                        <SelectTrigger id="education">
                                            <SelectValue placeholder="Select your education level" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="post_intermediate">Post Intermediate</SelectItem>
                                            <SelectItem value="undergraduate">Undergraduate</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div>
                                <Label htmlFor="collegeName" className="text-gray-700 dark:text-gray-300 flex items-center mb-1">
                                    <University className="h-4 w-4 mr-2 text-red-500" /> College Name
                                </Label>
                                <Input id="collegeName" type="text" placeholder="Your College/University Name" value={collegeName} onChange={(e) => setCollegeName(e.target.value)} required />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <Label htmlFor="profilePicture" className="text-gray-700 dark:text-gray-300 flex items-center mb-1">
                                        <Image className="h-4 w-4 mr-2 text-purple-500" /> Profile Picture
                                    </Label>
                                    <Input id="profilePicture" type="file" accept="image/*" onChange={(e) => handleFileChange(e, setProfilePicture)} required />
                                    {profilePicture && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{profilePicture.name}</p>}
                                </div>
                                <div>
                                    <Label htmlFor="collegeIdCard" className="text-gray-700 dark:text-gray-300 flex items-center mb-1">
                                        <IdCard className="h-4 w-4 mr-2 text-teal-500" /> College ID Card
                                    </Label>
                                    <Input id="collegeIdCard" type="file" accept="image/*" onChange={(e) => handleFileChange(e, setCollegeIdCard)} required />
                                    {collegeIdCard && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{collegeIdCard.name}</p>}
                                </div>
                                <div>
                                    <Label htmlFor="recentMarksheet" className="text-gray-700 dark:text-gray-300 flex items-center mb-1">
                                        <FileCheck className="h-4 w-4 mr-2 text-indigo-500" /> Recent Marksheet
                                    </Label>
                                    <Input id="recentMarksheet" type="file" accept="image/*,application/pdf" onChange={(e) => handleFileChange(e, setRecentMarksheet)} required />
                                    {recentMarksheet && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{recentMarksheet.name}</p>}
                                </div>
                            </div>

                            <div className="flex justify-center">
                                {/* Replace YOUR_RECAPTCHA_SITE_KEY with your actual reCAPTCHA site key */}
                                <ReCAPTCHA
                                    ref={recaptchaRef}
                                    sitekey="6LeIhW0rAAAAAL2oxCpELWA74Cb93-x9utqxBAdZ"
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

                            <Button type="submit" className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2" disabled={submissionStatus === 'loading'}>
                                Submit Application
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                {/* Perks of Being an Ambassador */}
                <div className="mt-12 text-center animate-fade-in">
                    <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-6">
                        🌟 Perks of Being a Medmacs Ambassador
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

                        <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 hover:scale-105 transition-transform duration-300">
                            <CardHeader className="text-center">
                                <FileText className="h-8 w-8 mx-auto mb-2 text-blue-600 dark:text-blue-400" />
                                <CardTitle className="text-gray-900 dark:text-white">Official Certificates</CardTitle>
                                <CardDescription className="text-gray-600 dark:text-gray-400">
                                    Receive a certificate of ambassadorship from Medmscs.
                                </CardDescription>
                            </CardHeader>
                        </Card>

                        <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 hover:scale-105 transition-transform duration-300">
                            <CardHeader className="text-center">
                                <Image className="h-8 w-8 mx-auto mb-2 text-green-600 dark:text-green-400" />
                                <CardTitle className="text-gray-900 dark:text-white">Website Feature</CardTitle>
                                <CardDescription className="text-gray-600 dark:text-gray-400">
                                    Get featured on the official Medmscs website as an ambassador.
                                </CardDescription>
                            </CardHeader>
                        </Card>

                        <Card className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 hover:scale-105 transition-transform duration-300">
                            <CardHeader className="text-center">
                                <Brain className="h-8 w-8 mx-auto mb-2 text-red-600 dark:text-red-400" />
                                <CardTitle className="text-gray-900 dark:text-white">Exclusive Features</CardTitle>
                                <CardDescription className="text-gray-600 dark:text-gray-400">
                                    Gain early access to new Medmacs features and tools.
                                </CardDescription>
                            </CardHeader>
                        </Card>

                        <Card className="bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800 hover:scale-105 transition-transform duration-300">
                            <CardHeader className="text-center">
                                <Bot className="h-8 w-8 mx-auto mb-2 text-purple-600 dark:text-purple-400" />
                                <CardTitle className="text-gray-900 dark:text-white">Learning Seminars</CardTitle>
                                <CardDescription className="text-gray-600 dark:text-gray-400">
                                    Participate in exclusive learning seminars and webinars.
                                </CardDescription>
                            </CardHeader>
                        </Card>

                        <Card className="bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-800 hover:scale-105 transition-transform duration-300">
                            <CardHeader className="text-center">
                                <MessageSquare className="h-8 w-8 mx-auto mb-2 text-teal-600 dark:text-teal-400" />
                                <CardTitle className="text-gray-900 dark:text-white">Performance Bonuses</CardTitle>
                                <CardDescription className="text-gray-600 dark:text-gray-400">
                                    Earn bonuses based on your ambassadorial performance.
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
                            <p className="font-medium mb-2">Medmacs Ambassador Program Details:</p>
                            <ul className="space-y-1 text-xs">
                                <li>• <strong>Promote Medmacs:</strong> Help us spread the word about our platform on your campus.</li>
                                <li>• <strong>Gather Feedback:</strong> Be our eyes and ears, collecting valuable student insights.</li>
                                <li>• <strong>Organize Events:</strong> Host Medmacs-related events and workshops at your college.</li>
                                <li>• <strong>Build Your Network:</strong> Connect with a community of like-minded students and professionals.</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        
        </div>
    );
};

export default CareerAmbassador;