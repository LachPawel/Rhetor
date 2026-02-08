
import React from 'react';
import { motion } from 'framer-motion';
import { AppView } from '../types';
import { ChevronRight } from 'lucide-react';

interface ViewLandingProps {
  onChangeView: (view: AppView) => void;
}

export const ViewLanding: React.FC<ViewLandingProps> = ({ onChangeView }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-stone-50 text-stone-900 p-6 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-stone-100 rounded-full blur-3xl opacity-50 pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center text-center">
            <motion.h1 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, ease: 'easeOut' }}
                className="text-6xl md:text-8xl font-serif tracking-tight mb-6"
            >
                Rhetor
            </motion.h1>
            
            <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5, duration: 1 }}
                className="text-stone-500 font-serif italic text-lg mb-12"
            >
                The art of speaking well.
            </motion.p>

            <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 1, duration: 0.5 }}
                onClick={() => onChangeView(AppView.HOME)}
                className="group flex items-center gap-2 px-8 py-3 bg-stone-900 text-stone-50 rounded-full hover:bg-stone-800 transition-all shadow-lg hover:shadow-xl hover:scale-105"
            >
                <span className="font-medium tracking-wide uppercase text-xs">Enter Academy</span>
                <ChevronRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
            </motion.button>
        </div>

        <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5, duration: 1 }}
            className="absolute bottom-8 text-[10px] uppercase tracking-widest text-stone-400"
        >
            MCMXXIV
        </motion.div>
    </div>
  );
};
