import React from 'react';
import { motion } from 'framer-motion';
import { AppView } from '../types';
import { FadeTransition } from './FadeTransition';

interface ViewLandingProps {
  onChangeView: (view: AppView) => void;
}

export const ViewLanding: React.FC<ViewLandingProps> = ({ onChangeView }) => {
  return (
    <FadeTransition className="flex flex-col items-center justify-center min-h-screen bg-stone-50 text-stone-900 relative overflow-hidden">
        {/* Background texture or subtle element could go here */}
        
        <div className="z-10 text-center flex flex-col items-center gap-8">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
            >
                <h1 className="text-6xl md:text-8xl font-serif tracking-tight mb-2">Rhetor</h1>
                <p className="text-sm md:text-base uppercase tracking-[0.2em] text-stone-500 font-medium">
                    The art of speaking well.
                </p>
            </motion.div>

            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5, duration: 1 }}
                className="w-px h-16 bg-gradient-to-b from-stone-300 to-transparent"
            />

            <motion.button
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 1, duration: 0.5 }}
                onClick={() => onChangeView(AppView.HOME)}
                className="group relative px-12 py-4 overflow-hidden rounded-full transition-all hover:shadow-lg"
            >
               <span className="relative z-10 font-serif text-lg italic text-stone-900 group-hover:text-white transition-colors duration-500">
                    Enter Academy
               </span>
               <div className="absolute inset-0 border border-stone-300 rounded-full group-hover:border-stone-900 transition-colors duration-300" />
               <div className="absolute inset-0 bg-stone-900 scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
            </motion.button>
        </div>

        {/* Footer quote - purely decorative */}
        <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            transition={{ delay: 1.5, duration: 1 }}
            className="absolute bottom-12 text-[10px] md:text-xs text-stone-400 font-serif italic"
        >
            "We have two ears and one mouth so that we can listen twice as much as we speak."
        </motion.p>
    </FadeTransition>
  );
};
