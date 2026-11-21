import { motion } from 'framer-motion'
import { design } from '../design-system.js'

export default function MotionCard({ children, className = '', delay = 0 }) {
  return (
    <motion.div
      className={`card ${className}`}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      whileHover={{ y: -4 }}
      transition={{
        duration: design.motion.durations.reveal,
        delay,
        ease: design.motion.easings.smooth,
      }}
    >
      {children}
    </motion.div>
  )
}
