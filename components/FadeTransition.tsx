import React from 'react';
import { motion } from 'framer-motion';

interface FadeTransitionProps {
  children: React.ReactNode;
  className?: string;
}

export const FadeTransition: React.FC<FadeTransitionProps> = ({ children, className }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
};