import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Crown,
  X,
  Instagram,
  Linkedin,
  Sparkles,
  UserRound,
  Users,
  Zap,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import Seo from '@/components/Seo';
import { supabase } from '@/integrations/supabase/client';

type TeamMember = {
  id?: string;
  name?: string | null;
  role?: string | null;
  institute?: string | null;
  description?: string | null;
  biography?: string | null;
  category?: string | null;
  image_url?: string | null;
  order_index?: number | null;
  instagram_url?: string | null;
  instagram?: string | null;
  icon?: string | null;
  category_icon?: string | null;
  react_icon?: string | null;
};

type TeamCategory = string;

type TeamCategoryMeta = {
  id: TeamCategory;
  label: string;
  title: string;
  description: string;
  icon: typeof Crown;
};

type TeamPageContent = {
  founder_biography?: string;
  founder_linkedin?: string;
  founder_instagram?: string;
};

const defaultCategories: TeamCategoryMeta[] = [
  {
    id: 'core',
    label: 'Core',
    title: 'Core Team',
    description: 'The people responsible for product, platform, and direction.',
    icon: Crown,
  },
  {
    id: 'extended',
    label: 'Extended',
    title: 'Extended Team',
    description: 'Campus, content, and community collaborators expanding Medmacs.',
    icon: Users,
  },
  {
    id: 'campus_representatives',
    label: 'Campus',
    title: 'Campus Representatives',
    description: 'Student representatives helping Medmacs stay connected across medical campuses.',
    icon: Users,
  },
  {
    id: 'contributor',
    label: 'Contributors',
    title: 'Contributors',
    description: 'People helping through feedback, content, testing, and ideas.',
    icon: Sparkles,
  },
  {
    id: 'special_thanks',
    label: 'Thanks',
    title: 'Special Thanks',
    description: 'People we are grateful to have had beside the project.',
    icon: Zap,
  },
];

const iconMap: Record<string, typeof Crown> = {
  bookopen: BookOpen,
  book: BookOpen,
  core: Crown,
  crown: Crown,
  extended: Users,
  campus: Users,
  campusrepresentatives: Users,
  campus_representatives: Users,
  users: Users,
  contributor: Sparkles,
  contributors: Sparkles,
  sparkles: Sparkles,
  special_thanks: Zap,
  thanks: Zap,
  zap: Zap,
};

const titleizeCategory = (value: string) =>
  value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const normalizeIconKey = (value?: string | null) =>
  String(value || '').replace(/[^a-z0-9]/gi, '').toLowerCase();

const fallbackMembers: TeamMember[] = [
  {
    name: 'Dr. Muhammad Ameer Hamza',
    role: 'Founder',
    category: 'core',
    image_url: '/team/founders/hamza.png',
    instagram_url: 'https://instagram.com/ameerhamza.exe',
  },
  {
    name: 'Dua Ahmed',
    role: 'Campus Ambassador - DMC',
    category: 'campus_representatives',
  },
  {
    name: 'Faiqa Ahmed',
    role: 'Campus Ambassador - JSMU',
    category: 'campus_representatives',
  },
];

const medmacsLogo = '/lovable-uploads/bf69a7f7-550a-45a1-8808-a02fb889f8c5.png';

const getProfileImage = (member: TeamMember) => {
  if (member.image_url) return member.image_url;
  return member.name ? '/teampage/user.png' : medmacsLogo;
};

const getInstagramUrl = (member: TeamMember) => {
  const raw = member.instagram_url || member.instagram;
  if (!raw) return null;
  if (raw.startsWith('http')) return raw;
  return `https://instagram.com/${raw.replace('@', '')}`;
};

const isFounder = (member: TeamMember) =>
  /founder|chief executive officer|\bceo\b/i.test(`${member.role || ''} ${member.name || ''}`);

const TeamMemberRow = ({ member, textOnly = false }: { member: TeamMember; textOnly?: boolean }) => {
  const instagramUrl = getInstagramUrl(member);
  const isVacant = !member.name;

  if (textOnly) {
    return (
      <motion.div
        className="w-full text-center"
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.35 }}
        transition={{ duration: 0.35 }}
      >
        <p className="text-sm font-black text-foreground">{member.name || 'Open Position'}</p>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="group relative flex w-32 shrink-0 snap-start flex-col items-center gap-3 text-center transition-transform duration-200 hover:-translate-y-0.5 sm:w-36"
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.4 }}
    >
      <div className="flex min-w-0 flex-col items-center gap-3">
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full border-2 border-border/50 bg-muted/50 shadow-sm transition-transform duration-300 group-hover:scale-105 sm:h-28 sm:w-28">
          <img
            src={getProfileImage(member)}
            alt={member.name || member.role || 'Open team position'}
            className={`${isVacant ? 'object-contain p-1.5' : 'object-cover'} h-full w-full`}
          />
        </div>

        <div className="min-w-0">
          <h3 className="line-clamp-2 text-sm font-black leading-snug text-foreground transition-colors group-hover:text-primary">
            {member.name || 'Open Position'}
          </h3>
          {(member.institute || member.role) && (
            <p className="mt-1 line-clamp-2 text-xs font-normal leading-relaxed text-muted-foreground">
              {member.institute || member.role}
            </p>
          )}
        </div>
      </div>

      {member.description && (
        <p className="line-clamp-2 min-h-8 text-xs font-normal leading-relaxed text-muted-foreground/80">
          {member.description}
        </p>
      )}

      {instagramUrl ? (
        <a
          href={instagramUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${member.name || 'team member'} on Instagram`}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-muted/55 text-foreground/70 transition-all hover:bg-primary hover:text-white"
        >
          <Instagram className="w-4 h-4" />
        </a>
      ) : isVacant ? (
        <a
          href="https://medmacs.app/collaborate"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Apply for this team position"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-muted/55 text-foreground/70 transition-all hover:bg-primary hover:text-white"
        >
          <ArrowRight className="w-4 h-4" />
        </a>
      ) : null}
    </motion.div>
  );
};

const TeamSkeleton = () => (
  <div className="space-y-6 animate-pulse">
    {Array.from({ length: 2 }).map((_, catIndex) => (
      <div key={catIndex} className="space-y-4">
        <div className="h-6 w-1/4 bg-muted rounded-full" />
        <div className="overflow-hidden rounded-3xl border-2 border-border/40 bg-white/5 dark:bg-white/[0.035] divide-y divide-border/40">
          {Array.from({ length: 3 }).map((_, itemIndex) => (
            <div key={itemIndex} className="flex items-center gap-4 p-4">
              <div className="w-12 h-12 rounded-xl bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-1/3 bg-muted rounded-full" />
                <div className="h-3 w-1/2 bg-muted rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>
);

const Teams = () => {
  const [founderExpanded, setFounderExpanded] = useState(false);
  const { data: teamMembers = [], isLoading } = useQuery<TeamMember[]>({
    queryKey: ['team_members'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_members')
        .select('*')
        .order('order_index', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });
  const { data: pageContent } = useQuery<TeamPageContent>({
    queryKey: ['team_page_content'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('setting_value')
        .eq('setting_name', 'team_page_content')
        .maybeSingle();
      if (error || !data?.setting_value) return {};
      try {
        return JSON.parse(data.setting_value) as TeamPageContent;
      } catch {
        return {};
      }
    },
    staleTime: 1000 * 60 * 10,
  });

  const members = teamMembers.length ? teamMembers : fallbackMembers;
  const categories = useMemo<TeamCategoryMeta[]>(() => {
    const knownCategories = new Map(defaultCategories.map((category) => [category.id, category]));

    members.forEach((member) => {
      const rawCategory = (member.category || 'core') as TeamCategory;
      const iconKey = normalizeIconKey(member.category_icon || member.react_icon || member.icon || rawCategory);
      const Icon = iconMap[iconKey] || iconMap[normalizeIconKey(rawCategory)] || Sparkles;

      if (!knownCategories.has(rawCategory)) {
        knownCategories.set(rawCategory, {
          id: rawCategory,
          label: titleizeCategory(rawCategory).split(' ')[0] || 'Team',
          title: titleizeCategory(rawCategory),
          description: 'A growing Medmacs team section.',
          icon: Icon,
        });
        return;
      }

      const existing = knownCategories.get(rawCategory);
      if (existing && (member.category_icon || member.react_icon || member.icon)) {
        knownCategories.set(rawCategory, { ...existing, icon: Icon });
      }
    });

    return Array.from(knownCategories.values()).filter((category) =>
      members.some((member) => (member.category || 'core') === category.id)
    );
  }, [members]);

  const groupedMembers = useMemo(() => {
    return categories.reduce<Record<string, TeamMember[]>>((acc, category) => {
      acc[category.id] = members.filter((member) => (member.category || 'core') === category.id);
      return acc;
    }, {});
  }, [categories, members]);

  const founder = useMemo(() => members.find(isFounder), [members]);
  const nonFounderMembers = useMemo(
    () => members.filter((member) => !founder || member.id !== founder.id || member.name !== founder.name),
    [members, founder]
  );

  return (
    <div className="fixed inset-0 overflow-hidden bg-background text-foreground">
      <Seo
        title="Our Team - Medmacs"
        description="Meet the people building and supporting Medmacs App."
        canonical="https://www.medmacs.app/teams"
      />

      <div className="pointer-events-none absolute inset-0 bg-mesh opacity-60" />
      <div className="pointer-events-none absolute -left-24 top-16 h-72 w-72 rounded-full bg-primary/15 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 top-80 h-80 w-80 rounded-full bg-violet-500/10 blur-3xl" />

      <header className="absolute inset-x-0 top-0 z-30 border-b border-border/60 bg-background/88 px-4 pb-3 pt-[calc(env(safe-area-inset-top,0px)+10px)] backdrop-blur-2xl">
        <div className="mx-auto flex items-center justify-between gap-3 max-w-4xl">
          <Link
            to="/dashboard"
            aria-label="Back to dashboard"
            className="flex shrink-0 items-center justify-center bg-muted text-foreground transition active:scale-95 active:bg-primary active:text-primary-foreground h-11 w-11 rounded-2xl"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>

          <div className="min-w-0 text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-primary">Medmacs people</p>
            <h1 className="truncate text-lg font-bold tracking-tight">The team behind the work</h1>
          </div>

          <div className="flex shrink-0 items-center justify-center bg-primary/10 text-primary h-11 w-11 rounded-2xl">
            <UserRound className="h-5 w-5" />
          </div>
        </div>
      </header>

      <main className="relative z-10 h-full overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom,0px)+48px)] pt-[calc(env(safe-area-inset-top,0px)+96px)]">
        <div className="mx-auto max-w-4xl">
          <div className="mb-12 px-2 text-center sm:mb-16">
            <span className="mb-4 inline-flex rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-primary">The people behind Medmacs</span>
            <h2 className="mx-auto max-w-2xl text-4xl font-black leading-[1.02] tracking-[-0.04em] text-foreground sm:text-6xl">
              Built by people who care about <span className="live-gradient-text">better learning.</span>
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">
              A growing community of builders, educators, and students shaping a more useful medical learning experience.
            </p>
          </div>

          {isLoading ? (
            <TeamSkeleton />
          ) : (
            <div className="space-y-10">
              {founder && (
                <motion.section
                  className="relative mb-14 min-h-[25rem] overflow-hidden rounded-[2rem] border border-primary/15 bg-card/35 p-5 backdrop-blur-sm sm:min-h-[31rem] sm:p-7"
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.25 }}
                  transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                >
                  <AnimatePresence mode="wait" initial={false}>
                    {!founderExpanded ? (
                      <motion.div
                        key="founder-collapsed"
                        className="absolute inset-0 flex flex-col items-center justify-center p-5 text-center sm:p-7"
                        initial={{ opacity: 0, scale: 0.985 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.985 }}
                        transition={{ duration: 0.4, ease: 'easeInOut' }}
                      >
                        <button
                          type="button"
                          onClick={() => setFounderExpanded(true)}
                          aria-label="View founder biography"
                          className="relative h-48 w-48 overflow-hidden rounded-full border-8 border-background bg-muted shadow-2xl shadow-primary/20 ring-1 ring-primary/25 transition-transform duration-300 hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:h-64 sm:w-64"
                        >
                          <img src={getProfileImage(founder)} alt={founder.name || 'Founder and CEO'} className="h-full w-full object-cover" />
                        </button>
                        <div className="mt-6 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Founder & CEO</div>
                        <h2 className="mt-3 text-3xl font-black tracking-[-0.03em] text-foreground sm:text-4xl">{founder.name}</h2>
                        <p className="mt-2 text-sm text-muted-foreground">{founder.institute || founder.role || 'Medmacs'}</p>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="founder-expanded"
                        className="absolute inset-0 overflow-y-auto p-5 text-left sm:p-7"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                      >
                        <div className="flex items-start gap-4 pr-10 sm:gap-5">
                          <button
                            type="button"
                            onClick={() => setFounderExpanded(false)}
                            aria-label="Collapse founder details"
                            className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full border-4 border-background bg-muted shadow-lg ring-1 ring-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:h-28 sm:w-28"
                          >
                            <img src={getProfileImage(founder)} alt={founder.name || 'Founder and CEO'} className="h-full w-full object-cover" />
                          </button>
                          <div className="min-w-0 pt-1">
                            <div className="inline-flex rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Founder & CEO</div>
                            <h2 className="mt-3 text-2xl font-black tracking-[-0.03em] text-foreground sm:text-3xl">{founder.name}</h2>
                            <p className="mt-1 text-sm text-muted-foreground">{founder.institute || founder.role || 'Medmacs'}</p>
                          </div>
                        </div>
                      <button
                        type="button"
                        onClick={() => setFounderExpanded(false)}
                        aria-label="Close founder details"
                        className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-muted/70 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <X className="h-4 w-4" />
                      </button>
                        <div className="mt-5 w-full border-t border-border/40 pt-5">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Biography</p>
                      <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">
                        {pageContent?.founder_biography || founder.biography || 'I am Dr. Muhammad Ameer Hamza, the founder of Medmacs. I created Medmacs to make medical learning more practical, focused, and accessible for students. I am building it around the way we actually study: with useful tools, clear explanations, and a community that keeps improving the experience together.'}
                      </p>
                      <div className="mt-4 flex items-center gap-2">
                        <a
                          href={pageContent?.founder_linkedin || 'https://www.linkedin.com/in/dr-ameerhamza/'}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="Dr. Ameer Hamza on LinkedIn"
                          className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
                        >
                          <Linkedin className="h-4 w-4" />
                        </a>
                        <a
                          href={pageContent?.founder_instagram || 'https://www.instagram.com/ameerhamza.exe/'}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="Dr. Ameer Hamza on Instagram"
                          className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
                        >
                          <Instagram className="h-4 w-4" />
                        </a>
                      </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.section>
              )}

              {categories.map((category) => {
                const activeMembers = (groupedMembers[category.id] || []).filter((member) =>
                  nonFounderMembers.includes(member)
                );
                if (!activeMembers.length) return null;
                const ActiveIcon = category.icon || Sparkles;
                const isNameOnlyCategory = ['special_thanks', 'contributor', 'contributors'].includes(category.id);

                return (
                  <motion.div
                    key={category.id}
                    className="space-y-4"
                    initial={{ opacity: 0, y: 18 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.2 }}
                    transition={{ duration: 0.45 }}
                  >
                    <div className="flex items-center gap-3 pb-2">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-sm shadow-primary/10">
                        <ActiveIcon className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold tracking-tight text-foreground">{category.title}</h3>
                        <p className="text-xs leading-5 text-muted-foreground">{category.description}</p>
                      </div>
                    </div>

                    <div className={isNameOnlyCategory ? 'px-1' : 'relative -mx-4 px-4'}>
                      {!isNameOnlyCategory && activeMembers.length > 1 && (
                        <>
                          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-14 bg-gradient-to-r from-background via-background/80 to-transparent" aria-hidden="true" />
                          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-14 bg-gradient-to-l from-background via-background/80 to-transparent" aria-hidden="true" />
                        </>
                      )}
                      {isNameOnlyCategory ? (
                        <div className="flex flex-col items-center gap-6">
                          {activeMembers.map((member) => (
                            <TeamMemberRow
                              key={member.id || `${category.id}-${member.name || member.role}`}
                              member={member}
                              textOnly
                            />
                          ))}
                        </div>
                      ) : (
                        <motion.div
                          className="flex gap-6 overflow-x-auto overflow-y-hidden px-1 pb-3 snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                          whileInView={{ x: [0, -42, 0] }}
                          viewport={{ once: true, amount: 0.4 }}
                          transition={{ duration: 1.4, delay: 0.2, ease: 'easeInOut' }}
                        >
                          {activeMembers.map((member) => (
                            <TeamMemberRow
                              key={member.id || `${category.id}-${member.name || member.role}`}
                              member={member}
                            />
                          ))}
                        </motion.div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          <motion.section
            className="relative mx-auto mt-16 max-w-lg overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/15 via-card/80 to-violet-500/10 p-5 text-center shadow-lg shadow-primary/5 backdrop-blur-xl sm:p-6"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.5 }}
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-primary">Collaborate with us</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-foreground">Bring your idea to the table.</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              Apply for campus collaborations, content support, open roles, or student-led initiatives.
            </p>
            <a
              href="https://medmacs.app/collaborate"
              target="_blank"
              rel="noopener noreferrer"
              className="mx-auto mt-4 flex h-11 w-full max-w-xs items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-sm font-bold text-primary-foreground shadow-md shadow-primary/15 transition-all hover:brightness-105 active:scale-[0.98]"
            >
              Apply Now
              <ArrowRight className="h-4 w-4" />
            </a>
          </motion.section>

          <p className="pb-4 pt-12 text-center text-[10px] text-muted-foreground tracking-widest">
            © 2026 Medmacs App • All rights reserved
          </p>
        </div>
      </main>
    </div>
  );
};

export default Teams;
