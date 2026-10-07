import type { ComponentType } from 'react';
import type { Institute } from '@/utils/institutes';

export type DashboardTabId = 'announcements' | 'leaderboard' | 'home' | 'analytics' | 'profile' | 'discover';

export type DashboardProfile = {
  avatar_url: string | null;
  full_name: string | null;
  id: string;
  updated_at: string;
  username: string | null;
  plan?: string | null;
  year?: string | null;
  email?: string | null;
  plan_expiry_date?: string | null;
  role?: string | null;
  institute?: string | null;
  daily_mcq_submissions?: number | null;
  heard_about_us?: string | null;
};

export type UserStats = {
  totalQuestions: number;
  correctAnswers: number;
  accuracy: number;
  currentStreak: number;
  rankPoints: number;
  battlesWon: number;
  totalBattles: number;
  savedQuestions: number;
};

export type Announcement = {
  id: string;
  title: string;
  content: string;
  media_url?: string | null;
  created_at: string;
};

export type WhatsNewItem = {
  version: string;
  title: string;
  desc?: string;
  description?: string;
};

export type TermOfDay = {
  id: string;
  term: string;
  definition: string;
  created_at: string;
};

export type CaseOfDay = {
  id: string;
  case_name?: string;
  headline: string;
  details: string;
  answer: string;
  explanation: string;
  created_at: string;
};

export type DashboardAnnouncement = {
  id: string;
  card_heading: string;
  card_subheading: string;
  card_background_image_url?: string | null;
  card_secondary_image_url?: string | null;
  modal_heading: string;
  modal_subheading: string;
  modal_background_image_url?: string | null;
  modal_image_urls?: string[] | null;
  cta_text?: string | null;
  cta_url?: string | null;
  institutes?: string[] | null;
  years?: string[] | null;
};

export type HmacsProductButton = {
  label: string;
  link: string;
};

export type HmacsProduct = {
  id: string;
  sr_no: number;
  icon?: string | null;
  project_name: string;
  description: string;
  long_description?: string | null;
  status: 'In-development' | 'In-Beta Stage' | 'Coming Soon' | 'Available';
  link?: string | null;
  buttons?: HmacsProductButton[] | string | null;
  cta_buttons?: HmacsProductButton[] | string | null;
  is_published?: boolean;
};

export type DashboardPromotion = {
  id: string;
  title: string;
  subtitle: string;
  image_url?: string | null;
  target_url?: string | null;
  action_type: 'url' | 'collaborate';
  display_order: number;
};

export type DashboardAction = {
  title: string;
  description: string;
  icon: ComponentType<any>;
  link?: string;
  onClick?: () => void;
  gradient: string;
  iconColor: string;
  flatIconColor?: string;
  tag?: string;
  tagColor?: string;
  disabled?: boolean;
  enabled?: boolean;
};

export type DashboardComponents = NonNullable<Institute['dashboard_components']>;

export type AiUsageSummary = {
  kind: 'disabled' | 'unknown' | 'unlimited' | 'limited';
  label: string;
};

export type AnalyticsPlan = {
  headline?: string;
  focusSubject?: string;
  focusReason?: string;
  strategy?: string[];
  nextSession?: string;
  generatedAt?: string;
};

export type DashboardInstitute = Institute | null | undefined;
