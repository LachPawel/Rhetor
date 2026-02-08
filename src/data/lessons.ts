// ─── Lesson & Step Types ─────────────────────────────────────────────
export interface LessonStep {
  type: 'explain' | 'demonstrate' | 'practice' | 'quiz';
  instruction: string;
  aiPrompt: string;
  duration: number;
  expectedAction?: 'speak' | 'breathe' | 'listen' | 'choose';
  options?: string[];
  correctAnswer?: number;
}

export interface Lesson {
  id: string;
  title: string;
  category: 'breathing' | 'voice' | 'technique';
  pillar: 'ethos' | 'logos' | 'pathos' | 'kairos' | 'lexis';
  duration: number;
  drachmas: number;
  description: string;
  prerequisite?: string;
  steps: LessonStep[];
}

// ─── Lesson Catalogue ────────────────────────────────────────────────
export const lessons: Lesson[] = [
  // ── 1. Box Breathing ───────────────────────────────────────────────
  {
    id: 'box-breathing',
    title: 'Box Breathing',
    category: 'breathing',
    pillar: 'lexis',
    duration: 120,
    drachmas: 15,
    description:
      'Master the Navy-SEAL technique of equal-ratio breathing to calm nerves and steady your voice before any speech.',
    steps: [
      {
        type: 'explain',
        instruction:
          'Box breathing is a 4-phase cycle: inhale for 4 seconds, hold for 4, exhale for 4, hold for 4. It activates your parasympathetic nervous system, lowering heart rate and quieting pre-speech jitters.',
        aiPrompt:
          'Explain box breathing to the student in a calm, encouraging tone. Describe the four equal phases — inhale, hold, exhale, hold — each lasting four seconds. Mention that Navy SEALs use this to stay composed under extreme pressure, and that speakers can use it to settle nerves before going on stage.',
        duration: 25,
        expectedAction: 'listen',
      },
      {
        type: 'practice',
        instruction:
          'Follow my voice through 4 complete box-breathing cycles. Breathe in… hold… breathe out… hold. Try to keep each phase exactly 4 seconds.',
        aiPrompt:
          'Guide the student through exactly 4 box-breathing cycles. Count each phase aloud — "Inhale, 2, 3, 4… Hold, 2, 3, 4… Exhale, 2, 3, 4… Hold, 2, 3, 4." Keep your voice slow and rhythmic. After each cycle, give a brief word of encouragement like "Good" or "Steady." Pause naturally between cycles.',
        duration: 70,
        expectedAction: 'breathe',
      },
      {
        type: 'practice',
        instruction:
          'Now do one final cycle on your own while I listen. I'll score how even and rhythmic your breathing is.',
        aiPrompt:
          'Tell the student to perform one box-breathing cycle independently while you listen. After they finish, evaluate the rhythm and evenness of their breathing. Score them out of 10 and offer one concrete tip for improvement, such as "Try relaxing your shoulders on the exhale."',
        duration: 25,
        expectedAction: 'breathe',
      },
    ],
  },

  // ── 2. Belly Breathing ─────────────────────────────────────────────
  {
    id: 'belly-breathing',
    title: 'Belly Breathing',
    category: 'breathing',
    pillar: 'lexis',
    duration: 120,
    drachmas: 15,
    description:
      'Learn diaphragmatic breathing — the foundation of vocal projection and endurance for any public speaker.',
    steps: [
      {
        type: 'explain',
        instruction:
          'Place one hand on your chest and the other on your belly. When you breathe correctly with your diaphragm, only the belly hand should rise — your chest stays still.',
        aiPrompt:
          'Explain diaphragmatic (belly) breathing to the student. Describe how the diaphragm is a dome-shaped muscle below the lungs that, when engaged, pulls air deep into the lower lobes. Instruct them to place one hand on the chest and one on the belly to feel the difference. Emphasize that chest breathing is shallow and tiring, while belly breathing gives speakers power and stamina.',
        duration: 30,
        expectedAction: 'listen',
      },
      {
        type: 'practice',
        instruction:
          'Breathe in slowly through your nose for 4 seconds, letting your belly push outward. Exhale through your mouth for 6 seconds. Repeat 5 times.',
        aiPrompt:
          'Guide the student through 5 belly-breathing repetitions. Count "In — 2, 3, 4" and "Out — 2, 3, 4, 5, 6." Remind them after the second rep that only the belly hand should be moving. Keep a calm, steady cadence.',
        duration: 55,
        expectedAction: 'breathe',
      },
      {
        type: 'practice',
        instruction:
          'Take one deep belly breath, then sustain a long "ahhh" sound. I'll time how long you can hold it — aim for at least 10 seconds.',
        aiPrompt:
          'Instruct the student to take one deep diaphragmatic inhale and then sustain a steady "ahhh" sound for as long as possible. Time them and report the duration. If they reach 10+ seconds, congratulate them. If under 10, encourage them and explain that regular practice will build capacity. Give a score out of 10.',
        duration: 35,
        expectedAction: 'speak',
      },
    ],
  },

  // ── 3. The Warm Voice ──────────────────────────────────────────────
  {
    id: 'the-warm-voice',
    title: 'The Warm Voice',
    category: 'voice',
    pillar: 'lexis',
    duration: 120,
    drachmas: 20,
    description:
      'Warm up your vocal cords with humming and lip trills so your voice sounds rich and resonant from the first word.',
    prerequisite: 'belly-breathing',
    steps: [
      {
        type: 'explain',
        instruction:
          'Just like athletes stretch before a game, speakers must warm up their voice. Cold vocal cords produce a thin, strained sound. We'll use humming and lip trills to get you stage-ready.',
        aiPrompt:
          'Explain why vocal warm-ups matter. Compare vocal cords to muscles that need stretching. Mention that professional singers and actors never skip warm-ups. Tell the student that humming gently vibrates the cords without strain, and lip trills add airflow control. This combination produces a warm, resonant speaking voice.',
        duration: 25,
        expectedAction: 'listen',
      },
      {
        type: 'practice',
        instruction:
          'Hum a comfortable note — feel the vibration in your nose and lips. Slide the pitch gently up and down like a siren. Do this for 30 seconds.',
        aiPrompt:
          'Guide the student through a 30-second humming exercise. Tell them to start on a comfortable mid-range note, feel the buzz in their nose and lips, then slowly slide up and down in pitch like a gentle siren. Encourage them to keep their jaw relaxed and shoulders down. Give feedback on whether you can hear steady, resonant humming.',
        duration: 40,
        expectedAction: 'speak',
      },
      {
        type: 'practice',
        instruction:
          'Now try lip trills: blow air through loosely closed lips (like a motorboat). Keep a steady pitch for 10 seconds, then slide up and down.',
        aiPrompt:
          'Guide the student through lip trills. Instruct them to press their lips gently together and blow air to create a "brrr" motorboat vibration. First hold a steady pitch for 10 seconds, then slide up and down for another 15 seconds. If they struggle, suggest placing fingers lightly on their cheeks to support the lips. Evaluate their steadiness and give a score out of 10.',
        duration: 55,
        expectedAction: 'speak',
      },
    ],
  },

  // ── 4. Tongue Twisters ─────────────────────────────────────────────
  {
    id: 'tongue-twisters',
    title: 'Tongue Twisters',
    category: 'voice',
    pillar: 'lexis',
    duration: 150,
    drachmas: 20,
    description:
      'Sharpen articulation and diction by racing through progressively harder tongue twisters while AI checks your clarity.',
    prerequisite: 'the-warm-voice',
    steps: [
      {
        type: 'explain',
        instruction:
          'Crisp articulation is what separates a mumbler from a magnetic speaker. Tongue twisters train the tiny muscles of your lips, tongue, and jaw to hit every consonant cleanly.',
        aiPrompt:
          'Explain why articulation matters for public speaking. Describe how tongue twisters work the articulators — lips, tongue, jaw, and soft palate — at high speed, forcing precision. Mention that news anchors and actors use these daily. Tell the student you will give three twisters of increasing difficulty and evaluate their clarity.',
        duration: 25,
        expectedAction: 'listen',
      },
      {
        type: 'practice',
        instruction:
          'Level 1 — Say clearly: "Red lorry, yellow lorry" three times fast.',
        aiPrompt:
          'Present the first tongue twister: "Red lorry, yellow lorry." Ask the student to say it three times as quickly as they can while staying clear. Listen carefully for slurred consonants or swapped sounds. Give specific feedback — e.g., "Your 'l' and 'r' sounds blurred on the second repeat." Rate clarity out of 10.',
        duration: 30,
        expectedAction: 'speak',
      },
      {
        type: 'practice',
        instruction:
          'Level 2 — "Unique New York, you know you need unique New York" — three times fast.',
        aiPrompt:
          'Present the second tongue twister: "Unique New York, you know you need unique New York." Ask the student to say it three times quickly. Listen for dropped syllables and mushy vowels, especially the "yoo-neek" vs "yoo-nork" trap. Give targeted feedback and a clarity score out of 10.',
        duration: 35,
        expectedAction: 'speak',
      },
      {
        type: 'practice',
        instruction:
          'Level 3 — "The sixth sick sheik\'s sixth sheep\'s sick" — say it clearly three times. This is one of the hardest twisters in English!',
        aiPrompt:
          'Present the final and hardest tongue twister: "The sixth sick sheik\'s sixth sheep\'s sick." Acknowledge it is famously difficult. Ask the student to say it three times. Evaluate their performance, noting any "s" / "sh" / "th" mix-ups. Give a final clarity score out of 10 and an overall articulation grade for the lesson.',
        duration: 60,
        expectedAction: 'speak',
      },
    ],
  },

  // ── 5. Kill the Fillers ────────────────────────────────────────────
  {
    id: 'kill-the-fillers',
    title: 'Kill the Fillers',
    category: 'voice',
    pillar: 'kairos',
    duration: 180,
    drachmas: 25,
    description:
      'Train yourself to replace "um," "uh," "like," and "you know" with confident silence.',
    prerequisite: 'tongue-twisters',
    steps: [
      {
        type: 'explain',
        instruction:
          'Filler words — "um," "uh," "like," "you know," "so," "basically" — erode your credibility. A brief pause is always more powerful than a filler.',
        aiPrompt:
          'Explain filler words to the student. List the most common ones: um, uh, like, you know, so, basically, actually, right, I mean. Explain that fillers signal uncertainty and break the speaker\'s rhythm. Contrast them with "the power of the pause" — a silent beat that creates anticipation and conveys confidence. Tell the student you will now test them with rapid-fire questions they must answer without any fillers.',
        duration: 30,
        expectedAction: 'listen',
      },
      {
        type: 'practice',
        instruction:
          'I'll ask you a random question. Answer in 15–20 seconds WITHOUT using any filler words. If you need to think, just pause silently.',
        aiPrompt:
          'Ask the student a simple but open-ended question — for example "What did you have for breakfast and why?" or "Describe your favourite room in your house." Give them 15–20 seconds to respond. Count every filler word ("um," "uh," "like," "you know," "so," "basically") and report the total. Encourage silent pauses instead.',
        duration: 40,
        expectedAction: 'speak',
      },
      {
        type: 'practice',
        instruction:
          'Round 2 — a slightly harder question. Remember: silence beats fillers every time.',
        aiPrompt:
          'Ask a moderately harder open-ended question — for example "Explain why your favourite hobby is interesting to someone who has never tried it." Give them 20 seconds. Count fillers meticulously. Compare the count to Round 1. Praise improvement or encourage them to consciously pause when they feel a filler coming.',
        duration: 45,
        expectedAction: 'speak',
      },
      {
        type: 'practice',
        instruction:
          'Final round — the hardest question. Try for zero fillers. I'll give you a final score.',
        aiPrompt:
          'Ask a challenging, opinion-based question — for example "If you could change one thing about the education system, what would it be and why?" Give them 25 seconds. Count every filler. Provide a final scorecard: total fillers across all three rounds, improvement trend, and an overall filler-free score out of 10. End with one actionable tip they can use in daily conversation.',
        duration: 65,
        expectedAction: 'speak',
      },
    ],
  },

  // ── 6. The Hook ────────────────────────────────────────────────────
  {
    id: 'the-hook',
    title: 'The Hook',
    category: 'technique',
    pillar: 'ethos',
    duration: 120,
    drachmas: 20,
    description:
      'Learn four opening-hook archetypes — question, statistic, story, and bold claim — and craft one that grabs attention in seconds.',
    steps: [
      {
        type: 'explain',
        instruction:
          'The first 10 seconds of any speech decide whether the audience stays or mentally checks out. There are 4 proven hook types: a provocative question, a surprising statistic, a short vivid story, or a bold contrarian claim.',
        aiPrompt:
          'Teach the student the four classic speech-opening hooks: (1) Provocative Question — e.g., "What if everything you know about motivation is wrong?" (2) Surprising Statistic — e.g., "Every 40 seconds, someone in the world takes their own life." (3) Short Vivid Story — a 2-sentence personal or historical anecdote. (4) Bold Contrarian Claim — e.g., "Talent is irrelevant." Briefly explain why each one works psychologically: curiosity, shock, empathy, and dissonance.',
        duration: 35,
        expectedAction: 'listen',
      },
      {
        type: 'quiz',
        instruction:
          'Quick check — which hook type is generally the strongest for an audience of strangers at a conference?',
        aiPrompt:
          'Ask the student: "Which hook type tends to be most universally powerful for a general audience of strangers at a conference?" Present these options: (A) Provocative Question, (B) Surprising Statistic, (C) Short Vivid Story, (D) Bold Contrarian Claim. The best answer is (C) Short Vivid Story because stories trigger empathy and mirror neurons regardless of background. Accept the student\'s answer and explain why story hooks are broadly effective, while acknowledging that context matters.',
        duration: 20,
        expectedAction: 'choose',
        options: [
          'Provocative Question',
          'Surprising Statistic',
          'Short Vivid Story',
          'Bold Contrarian Claim',
        ],
        correctAnswer: 2,
      },
      {
        type: 'practice',
        instruction:
          'Pick any topic you care about and create one hook — using any of the 4 types. Deliver it like you're opening a real speech.',
        aiPrompt:
          'Tell the student to choose any topic and craft one opening hook using any of the four types. Give them a moment to think, then have them deliver it aloud as if they are on stage. Evaluate: (1) Did it grab attention in the first 5 seconds? (2) Was the delivery confident? (3) Which hook type did they use? Give specific praise and one suggestion to make it even punchier.',
        duration: 35,
        expectedAction: 'speak',
      },
      {
        type: 'practice',
        instruction:
          'Now try a different hook type on the same topic. Variety makes you versatile.',
        aiPrompt:
          'Ask the student to open the same topic with a different hook type than the one they just used. After they deliver it, compare the two hooks: which one felt more natural? Which grabbed attention faster? Give a final score out of 10 for hook craft and suggest which type suits their natural style best.',
        duration: 30,
        expectedAction: 'speak',
      },
    ],
  },

  // ── 7. Rule of Three ───────────────────────────────────────────────
  {
    id: 'rule-of-three',
    title: 'Rule of Three',
    category: 'technique',
    pillar: 'logos',
    duration: 120,
    drachmas: 20,
    description:
      'Discover why the human brain loves triads and learn to structure any argument, list, or story in three parts for maximum impact.',
    steps: [
      {
        type: 'explain',
        instruction:
          '"Life, liberty, and the pursuit of happiness." "Blood, sweat, and tears." Three is the magic number in rhetoric — it creates rhythm, completeness, and memorability.',
        aiPrompt:
          'Teach the Rule of Three. Explain that the human brain naturally groups information in threes — it is the smallest number that creates a pattern. Give famous examples: "Veni, vidi, vici," "Life, liberty, and the pursuit of happiness," "Blood, sweat, and tears," "Stop, look, and listen," Steve Jobs\' "thinnest, lightest, and fastest." Explain three uses: tricolon (3 parallel phrases), 3-point argument structure, and 3-act storytelling.',
        duration: 35,
        expectedAction: 'listen',
      },
      {
        type: 'demonstrate',
        instruction:
          'Listen to these two versions of the same idea and notice which sounds more powerful.',
        aiPrompt:
          'Demonstrate the Rule of Three by reading two versions of the same idea. Version A (weak): "We need to be innovative and work harder." Version B (strong): "We need to innovate, collaborate, and execute." Then read another pair — Version A: "This product is good and useful." Version B: "This product is simple, powerful, and beautiful." Ask the student which versions sounded better and why. Confirm that the three-part versions create rhythm and feel complete.',
        duration: 35,
        expectedAction: 'listen',
      },
      {
        type: 'practice',
        instruction:
          'Your turn — take any idea (e.g., "why exercise matters") and structure a 20-second argument in exactly 3 parts. Deliver it aloud.',
        aiPrompt:
          'Ask the student to pick any topic — suggest "why exercise matters" if they need one — and structure a short argument in exactly three parts. Give them a moment, then have them deliver it aloud. Evaluate: (1) Did they clearly use three distinct parts? (2) Was there rhythmic parallel structure? (3) Did the third point land as the strongest? Give specific feedback and a score out of 10. Suggest how to make the triad more parallel or punchy.',
        duration: 50,
        expectedAction: 'speak',
      },
    ],
  },

  // ── 8. The Power Pause ─────────────────────────────────────────────
  {
    id: 'the-power-pause',
    title: 'The Power Pause',
    category: 'technique',
    pillar: 'kairos',
    duration: 120,
    drachmas: 25,
    description:
      'Harness the art of strategic silence — learn when and how to pause so your words land with maximum weight.',
    prerequisite: 'kill-the-fillers',
    steps: [
      {
        type: 'explain',
        instruction:
          'A well-placed pause is louder than any word. It builds anticipation, signals confidence, lets ideas sink in, and gives you time to breathe. Most speakers rush — great speakers pause.',
        aiPrompt:
          'Teach the Power Pause. Explain three strategic pause types: (1) The Anticipation Pause — pause BEFORE a key word to create suspense. (2) The Impact Pause — pause AFTER a key statement to let it land. (3) The Transition Pause — pause between sections to signal a shift. Give a quick example of each. Explain that research shows audiences perceive speakers who pause as more confident and credible. Mention that Barack Obama and Martin Luther King Jr. were master pausers.',
        duration: 35,
        expectedAction: 'listen',
      },
      {
        type: 'demonstrate',
        instruction:
          'Listen to the same sentence read two ways — first with no pauses (rushed), then with strategic pauses. Notice the difference in impact.',
        aiPrompt:
          'Read this sentence two ways. Version A (no pauses, rushed): "The single biggest problem in communication is the illusion that it has taken place." Version B (with pauses): "The single biggest problem… in communication… is the illusion… that it has taken place." [Pause 2 seconds after the final word.] Then do a second example — Version A: "Ask not what your country can do for you ask what you can do for your country." Version B: "Ask not… what your country can do for you. [pause] Ask… what YOU can do… for your country." Ask the student which versions felt more powerful and why.',
        duration: 40,
        expectedAction: 'listen',
      },
      {
        type: 'practice',
        instruction:
          'Read this quote aloud with at least 3 deliberate pauses: "The only thing we have to fear is fear itself." Take your time — silence is your ally.',
        aiPrompt:
          'Give the student the quote: "The only thing we have to fear… is fear itself." Ask them to read it aloud with at least 3 deliberate pauses placed where they think the impact is greatest. After they deliver it, evaluate: (1) Were the pauses long enough (at least 1 second)? (2) Were they placed at impactful moments? (3) Did the delivery feel confident or did they rush? Give a score out of 10 and suggest the optimal pause placement if theirs could improve.',
        duration: 45,
        expectedAction: 'speak',
      },
    ],
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────
export const getLessonById = (id: string): Lesson | undefined =>
  lessons.find((l) => l.id === id);

export const getLessonsByCategory = (
  category: Lesson['category'],
): Lesson[] => lessons.filter((l) => l.category === category);

export const getLessonsByPillar = (pillar: Lesson['pillar']): Lesson[] =>
  lessons.filter((l) => l.pillar === pillar);

export const getTotalDrachmas = (): number =>
  lessons.reduce((sum, l) => sum + l.drachmas, 0);
