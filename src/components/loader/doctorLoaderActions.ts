export interface DoctorLoaderAction {
  id: string;
  name: string;
  webm: string;
  mp4: string;
  tagline: string;
  subtext: string;
}

export const DOCTOR_LOADER_ACTIONS: DoctorLoaderAction[] = [
  {
    id: 'clean_glasses',
    name: 'Sharpening Focus',
    webm: '/animations/doctor/clean_glasses.webm',
    mp4: '/animations/doctor/clean_glasses.mp4',
    tagline: 'Cleaning lenses for razor-sharp clarity...',
    subtext: 'Dr. Ahroid is preparing high-yield concepts',
  },
  {
    id: 'drinking_coffee',
    name: 'Coffee Break',
    webm: '/animations/doctor/drinking_coffee.webm',
    mp4: '/animations/doctor/drinking_coffee.mp4',
    tagline: 'Fueling up with clinical energy...',
    subtext: 'A quick sip before your study round',
  },
  {
    id: 'coffee_smile',
    name: 'Clinical Ready',
    webm: '/animations/doctor/coffee_smile.webm',
    mp4: '/animations/doctor/coffee_smile.mp4',
    tagline: 'Ready to ace this round!',
    subtext: 'Dr. Ahroid is with you every step',
  },
  {
    id: 'check_wristwatch',
    name: 'Checking Vitals',
    webm: '/animations/doctor/check_wristwatch.webm',
    mp4: '/animations/doctor/check_wristwatch.mp4',
    tagline: 'Timing your clinical mastery...',
    subtext: 'Precision & speed make top ranks',
  },
  {
    id: 'ball_toss',
    name: 'Active Juggling',
    webm: '/animations/doctor/ball_toss.webm',
    mp4: '/animations/doctor/ball_toss.mp4',
    tagline: 'Juggling multiple-choice diagnostics...',
    subtext: 'Connecting dots across pathology & pharmacology',
  },
  {
    id: 'adjust_glasses',
    name: 'Exam Mode',
    webm: '/animations/doctor/adjust_glasses.webm',
    mp4: '/animations/doctor/adjust_glasses.mp4',
    tagline: 'Locking into exam mode...',
    subtext: 'Optimizing high-yield questions for you',
  },
  {
    id: 'take_off_glasses',
    name: 'Deep Analysis',
    webm: '/animations/doctor/take_off_glasses.webm',
    mp4: '/animations/doctor/take_off_glasses.mp4',
    tagline: 'Deep diving into diagnostic clues...',
    subtext: 'Analyzing clinical vignette patterns',
  },
];

export const getRandomDoctorAction = (): DoctorLoaderAction => {
  const index = Math.floor(Math.random() * DOCTOR_LOADER_ACTIONS.length);
  return DOCTOR_LOADER_ACTIONS[index];
};
