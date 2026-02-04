// Type augmentation for framer-motion with React 19
// This fixes the className type issue

import 'framer-motion';

declare module 'framer-motion' {
  export interface MotionProps {
    className?: string;
  }
}
