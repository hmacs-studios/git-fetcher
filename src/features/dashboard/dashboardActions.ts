import {
  BookOpen,
  Bookmark,
  FileText,
  FlaskConical,
  Microscope,
  ScrollText,
  Swords,
  Target,
} from 'lucide-react';
import { CardsIcon, DrAhroidIcon, TestGeneratorIcon } from '@/components/ui/TabIcons';
import type { DashboardAction, DashboardComponents } from './types';

export const getQuickActions = (): DashboardAction[] => [
  { title: 'Practice MCQs', description: 'Test your knowledge', icon: BookOpen, link: '/mcqs', gradient: 'from-blue-500 to-indigo-600', iconColor: 'text-blue-200', flatIconColor: 'text-blue-500' },
  { title: 'Saved MCQs', description: 'Review bookmarks', icon: Bookmark, link: '/saved-mcqs', gradient: 'from-teal-500 to-emerald-600', iconColor: 'text-teal-100', flatIconColor: 'text-teal-500' },
  { title: 'Battle Arena', description: 'Compete with friends', icon: Swords, link: '/battle', gradient: 'from-orange-500 to-red-500', iconColor: 'text-orange-100', flatIconColor: 'text-orange-500' },
  { title: 'Full-Length Paper', description: 'Timed mixed exams', icon: ScrollText, link: '/flp', gradient: 'from-fuchsia-600 to-rose-600', iconColor: 'text-fuchsia-100', flatIconColor: 'text-fuchsia-500' },
];

export const getPersonalizationActions = (): DashboardAction[] => [
  { title: 'Mistake Book', description: 'Review wrong MCQs', icon: Target, link: '/mistake-book', gradient: 'from-rose-500 to-red-600', iconColor: 'text-rose-100', flatIconColor: 'text-rose-500', tag: 'New!', tagColor: 'bg-red-500 text-white animate-pulse' },
  { title: 'Smart Deck', description: 'Repair weakest chapter', icon: FlaskConical, link: '/smart-deck', gradient: 'from-violet-500 to-fuchsia-600', iconColor: 'text-violet-100', flatIconColor: 'text-violet-500' },
];

export const getPremiumActions = (): DashboardAction[] => [
  { title: 'Ask Dr Ahroid', description: 'Instant AI tutor', icon: DrAhroidIcon, link: '/ai/chatbot', gradient: 'from-amber-400 to-orange-500', iconColor: 'text-yellow-100' },
  { title: 'AI Test Attempt', description: 'Custom tests with AI', icon: TestGeneratorIcon, link: '/ai/test-generator', gradient: 'from-cyan-500 to-blue-600', iconColor: 'text-cyan-100' },
  { title: 'AI Flashcards', description: 'AI flashcards by chapter', icon: CardsIcon, link: '/learn-with-ai', gradient: 'from-violet-500 to-fuchsia-600', iconColor: 'text-violet-100' },
];

export const getInstituteActions = (components: DashboardComponents, isSpecializedTest = false): DashboardAction[] => [
  { title: 'Practice SEQs', description: 'Subjective questions', icon: FileText, link: '/seqs', gradient: 'from-orange-500 to-red-600', iconColor: 'text-orange-200', enabled: components.seqs },
  { title: 'Viva & Practicals', description: 'Ace your practicals', icon: Microscope, link: '/practicals', gradient: 'from-red-600 to-rose-700', iconColor: 'text-red-100', flatIconColor: 'text-red-500', enabled: !isSpecializedTest },
].filter((action) => action.enabled);
