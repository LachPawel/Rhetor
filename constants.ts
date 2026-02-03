
import { PitchOption } from './types.ts';

export const PITCH_OPTIONS: PitchOption[] = [
  {
    id: 'elevator',
    label: 'Elevator',
    durationLabel: '60 seconds',
    durationSeconds: 60
  },
  {
    id: 'investor',
    label: 'Investor',
    durationLabel: '3 minutes',
    durationSeconds: 180
  },
  {
    id: 'interview',
    label: 'Interview',
    durationLabel: '2 minutes',
    durationSeconds: 120
  }
];
