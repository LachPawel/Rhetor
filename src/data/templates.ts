export interface PitchTemplate {
  id: string;
  name: string;
  description: string;
  duration: number;
  bullets: string[];
  category: 'pitch' | 'presentation' | 'interview';
}

export const PITCH_TEMPLATES: PitchTemplate[] = [
  {
    id: 'elevator-pitch',
    name: 'Elevator Pitch',
    description: 'A concise 60-second pitch to spark interest and land a follow-up.',
    duration: 60,
    bullets: [
      'Open with a compelling hook',
      'Explain what you do clearly',
      'Identify who you serve',
      'Highlight what makes you different',
      'Close with a clear ask',
    ],
    category: 'pitch',
  },
  {
    id: 'startup-investor-pitch',
    name: 'Startup Investor Pitch',
    description: 'A 3-minute investor pitch covering problem, solution, and traction.',
    duration: 180,
    bullets: [
      'Lead with a memorable hook',
      'Define the problem vividly',
      'Size the market opportunity',
      'Present your unique solution',
      'Show traction and key metrics',
      'Introduce the founding team',
      'State the funding ask clearly',
    ],
    category: 'pitch',
  },
  {
    id: 'conference-talk-intro',
    name: 'Conference Talk Intro',
    description: 'A 2-minute opening to hook your audience and set the stage.',
    duration: 120,
    bullets: [
      'Share a brief personal story',
      'Frame the core problem statement',
      'Preview what the audience will learn',
      'Explain why this topic matters now',
    ],
    category: 'presentation',
  },
  {
    id: 'job-interview-about-yourself',
    name: 'Job Interview "Tell Me About Yourself"',
    description: 'A structured 90-second answer for the classic interview opener.',
    duration: 90,
    bullets: [
      'Summarize your current role briefly',
      'Highlight one key achievement with impact',
      'Explain why this company excites you',
      'Describe what you uniquely bring',
    ],
    category: 'interview',
  },
  {
    id: 'product-demo',
    name: 'Product Demo',
    description: 'A 2-minute demo flow from pain point to next steps.',
    duration: 120,
    bullets: [
      'Describe the customer pain point',
      'Walk through the solution live',
      'Showcase key results and outcomes',
      'Outline clear next steps forward',
    ],
    category: 'presentation',
  },
];
