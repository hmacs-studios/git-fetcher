import { useState, useEffect, type ChangeEvent, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CONTACT_DETAILS } from '@/constants/contact';
import {
    Mail, Phone, Instagram, Facebook, Linkedin,
    Loader2, CheckCircle, Send, ArrowLeft, FlaskConical
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { fetchInstitutes, getInstituteByCode, getInstituteDisplayName, isSpecializedTestInstitute } from '@/utils/institutes';
import Seo from '@/components/Seo';

const ContactUsPage = () => {
    type ContactFormData = {
        fullName: string;
        email: string;
        message: string;
    };
    type ContactFormErrors = Partial<Record<keyof ContactFormData, string>>;

    const { user } = useAuth();
    const [searchParams] = useSearchParams();
    const isCampusCollaboration = searchParams.get('subject') === 'campus-collaboration';
    const isSeqBetaFeedback = searchParams.get('subject') === 'seq-beta-feedback';
    const [formData, setFormData] = useState({ fullName: '', email: '', message: '' });
    const [formErrors, setFormErrors] = useState<ContactFormErrors>({});
    const [showSuccessMessage, setShowSuccessMessage] = useState(false);

    const { data: institutes } = useQuery({
        queryKey: ['institutesForContact'],
        queryFn: () => fetchInstitutes(),
        staleTime: 5 * 60 * 1000,
    });

    const { data: profile } = useQuery({
        queryKey: ['profileForContact', user?.id],
        queryFn: async () => {
            if (!user?.id) return null;
            const { data, error } = await supabase.from('profiles').select('full_name, email, avatar_url, plan, institute').eq('id', user.id).maybeSingle();
            if (error) return null;
            return data;
        },
        enabled: !!user?.id,
        staleTime: Infinity,
    });

    const userInstituteCode = (profile as any)?.institute || '';
    const userInstituteName = getInstituteDisplayName(userInstituteCode, institutes || []);
    const selectedInstitute = getInstituteByCode(userInstituteCode, institutes || []);
    const selectedSpecializedTest = isSpecializedTestInstitute(selectedInstitute);
    const campusCollaborationMessage = selectedSpecializedTest
        ? `Hi Medmacs team, I'm preparing for ${userInstituteName}. Please share how Post Graduate Exam content can be added or improved.`
        : userInstituteName
            ? `Hi Medmacs team, I'm interested in bringing Medmacs to my campus/institute (${userInstituteName}). Please share more details about campus collaboration.`
            : "Hi Medmacs team, I'm interested in bringing Medmacs to my campus/institute. Please share more details about campus collaboration.";
    const seqBetaFeedbackMessage = "Hi Medmacs team, I'd like to report an issue with Short Questions (beta).\n\nWhat happened:\n\nWhat I expected to happen:\n\nQuestion/chapter (if applicable):";
    const contextualMessage = isCampusCollaboration
        ? campusCollaborationMessage
        : isSeqBetaFeedback
            ? seqBetaFeedbackMessage
            : '';

    useEffect(() => {
        if (user) {
            setFormData(prev => ({
                ...prev,
                email: user.email || '',
                fullName: profile?.full_name || user.user_metadata?.full_name || '',
                message: contextualMessage && !prev.message
                    ? contextualMessage
                    : prev.message,
            }));
        } else if (contextualMessage) {
            setFormData(prev => ({
                ...prev,
                message: prev.message || contextualMessage,
            }));
        }
    }, [user, profile, contextualMessage]);

    const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { id, value } = e.target;
        setFormData(prev => ({ ...prev, [id]: value }));
        setFormErrors(prev => ({ ...prev, [id]: undefined }));
        setShowSuccessMessage(false);
    };

    const validateForm = () => {
        const errors: ContactFormErrors = {};
        if (!formData.fullName.trim()) errors.fullName = 'Full Name is required.';
        if (!formData.email.trim()) errors.email = 'Email is required.';
        else if (!/\S+@\S+\.\S+/.test(formData.email)) errors.email = 'Email address is invalid.';
        if (!formData.message.trim()) errors.message = 'Message is required.';
        else if (formData.message.trim().length < 10) errors.message = 'Message must be at least 10 characters.';
        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const submitMessageMutation = useMutation<unknown, Error, ContactFormData>({
        mutationFn: async (messageData) => {
            const { data, error } = await supabase.from('contact_messages').insert([{
                full_name: messageData.fullName, email: messageData.email,
                message: messageData.message, user_id: user?.id || null,
            }]);
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            toast.success('Your message has been sent successfully!');
            setFormData({ fullName: user?.user_metadata?.full_name || profile?.full_name || '', email: user?.email || '', message: '' });
            setFormErrors({});
            setShowSuccessMessage(true);
        },
        onError: (error) => {
            toast.error(`Failed to send message: ${error.message}`);
            setShowSuccessMessage(false);
        },
    });

    const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setShowSuccessMessage(false);
        if (validateForm()) submitMessageMutation.mutate(formData);
        else toast.error('Please correct the errors in the form.');
    };

    const contactLinks = [
        { icon: Mail, label: 'Email', value: CONTACT_DETAILS.email, href: `mailto:${CONTACT_DETAILS.email}` },
        { icon: Phone, label: 'WhatsApp', value: CONTACT_DETAILS.whatsappDisplay, href: CONTACT_DETAILS.whatsappUrl },
        { icon: Instagram, label: 'Instagram', value: `@${CONTACT_DETAILS.instagramHandle}`, href: CONTACT_DETAILS.instagramUrl },
        { icon: Facebook, label: 'Facebook', value: CONTACT_DETAILS.facebookHandle, href: CONTACT_DETAILS.facebookUrl },
        { icon: Linkedin, label: 'LinkedIn', value: CONTACT_DETAILS.linkedinHandle, href: CONTACT_DETAILS.linkedinUrl },
    ];

    return (
        <div className="min-h-screen w-full bg-background text-foreground">
            <Seo title="Contact Us" description="Get in touch with Medmacs" canonical="https://medmacs.app/contact-us" />

            <header className="fixed inset-x-0 top-0 z-50 border-b border-border/40 bg-background/95 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur-xl sm:px-6">
                <div className="relative mx-auto grid w-full max-w-4xl grid-cols-[1fr_auto_1fr] items-center">
                    <Link to="/dashboard" aria-label="Back to dashboard" className="flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                    <h1 className="brand-wordmark text-xl text-foreground">Contact Us</h1>
                    <div aria-hidden="true" />
                </div>
            </header>

            <main className="mx-auto w-full max-w-4xl px-5 pb-12 pt-[calc(var(--header-height)+1.5rem)] sm:px-8">
                {isSeqBetaFeedback && (
                    <section className="mb-8 flex items-start gap-3 border-y border-primary/20 bg-primary/[0.06] px-4 py-3 text-sm leading-relaxed" aria-label="Short Questions beta feedback">
                        <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                        <div>
                            <p className="font-bold text-foreground">Short Questions beta feedback</p>
                            <p className="mt-0.5 text-muted-foreground">Tell us what happened and what you expected. We will use it to improve the beta experience.</p>
                        </div>
                    </section>
                )}

                <section className="mb-9">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-primary">Support</p>
                    <h1 className="mt-2 text-3xl font-black tracking-tight text-foreground sm:text-4xl">How can we help?</h1>
                    <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">Send us feedback, report an issue, or reach out through any of the channels below.</p>
                </section>

                <section className="mb-10 grid grid-cols-1 border-y border-border/60 sm:grid-cols-2 lg:grid-cols-3" aria-label="Contact channels">
                    {contactLinks.map((item, i) => (
                        <a key={i} href={item.href} target="_blank" rel="noopener noreferrer" className="group flex min-h-20 items-center gap-3 border-b border-border/60 px-3 py-3 transition-colors hover:bg-accent/60 sm:[&:nth-last-child(-n+2)]:border-b-0 lg:[&:nth-last-child(-n+3)]:border-b-0">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                                <item.icon className="h-4 w-4" />
                            </span>
                            <span className="min-w-0">
                                <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">{item.label}</span>
                                <span className="mt-0.5 block truncate text-sm font-semibold text-foreground">{item.value}</span>
                            </span>
                        </a>
                    ))}
                </section>

                <section>
                    <div className="mb-6 border-b border-border/60 pb-4">
                        <h2 className="text-xl font-black tracking-tight text-foreground">Send a message</h2>
                        <p className="mt-1 text-sm text-muted-foreground">Questions, feedback, or support requests—we read every message.</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <Label htmlFor="fullName" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Full Name</Label>
                            <Input id="fullName" value={formData.fullName} onChange={handleInputChange} required readOnly={!!user && !!profile?.full_name} className="mt-2 h-11 rounded-xl border-border bg-background text-foreground" />
                            {formErrors.fullName && <p className="mt-1 text-xs text-destructive">{formErrors.fullName}</p>}
                        </div>
                        <div>
                            <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Email</Label>
                            <Input id="email" type="email" value={formData.email} onChange={handleInputChange} required readOnly={!!user && !!user.email} className="mt-2 h-11 rounded-xl border-border bg-background text-foreground" />
                            {formErrors.email && <p className="mt-1 text-xs text-destructive">{formErrors.email}</p>}
                        </div>
                        <div>
                            <Label htmlFor="message" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Message</Label>
                            <Textarea id="message" value={formData.message} onChange={handleInputChange} rows={5} placeholder="Type your message..." className="mt-2 min-h-40 resize-y rounded-xl border-border bg-background text-foreground placeholder:text-muted-foreground" />
                            {formErrors.message && <p className="mt-1 text-xs text-destructive">{formErrors.message}</p>}
                        </div>
                        <Button type="submit" disabled={submitMessageMutation.isPending} className="h-12 w-full rounded-xl bg-primary font-black uppercase tracking-widest text-primary-foreground shadow-md shadow-primary/20 hover:bg-primary/90">
                            {submitMessageMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                            {submitMessageMutation.isPending ? 'Sending...' : 'Send Message'}
                        </Button>
                        {showSuccessMessage && (
                            <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/10 p-3 text-sm text-foreground">
                                <CheckCircle className="h-4 w-4 shrink-0 text-primary" />
                                <span>Message received! We'll get back to you soon.</span>
                            </div>
                        )}
                    </form>
                </section>
            </main>
        </div>
    );
};

export default ContactUsPage;
