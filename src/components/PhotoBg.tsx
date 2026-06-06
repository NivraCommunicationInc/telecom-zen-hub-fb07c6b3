import { useEffect } from "react";
import { motion, useMotionValue, useTransform, useSpring } from "framer-motion";

interface PhotoBgProps {
  url: string;
  opacity?: number;
  filter?: string;
  position?: string;
}

export function PhotoBg({
  url,
  opacity = 0.12,
  filter = "saturate(0.5) brightness(0.65)",
  position = "center",
}: PhotoBgProps) {
  const rawX = useMotionValue(0.5);
  const rawY = useMotionValue(0.5);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      rawX.set(e.clientX / window.innerWidth);
      rawY.set(e.clientY / window.innerHeight);
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, [rawX, rawY]);

  const spring = { stiffness: 22, damping: 18, mass: 3 };
  const px = useSpring(useTransform(rawX, [0, 1], ["-4%", "4%"]), spring);
  const py = useSpring(useTransform(rawY, [0, 1], ["-3%", "3%"]), spring);

  return (
    <div aria-hidden style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}>
      {/* Ken Burns — slow zoom + drift */}
      <motion.div
        style={{ position: "absolute", inset: "-10%" }}
        animate={{
          scale: [1.0, 1.07, 1.04, 1.10, 1.02, 1.0],
          x:     ["0%", "-1.8%", "0.8%", "-1.2%", "0.5%", "0%"],
          y:     ["0%", "-1.0%", "0.6%", "-0.8%", "0.3%", "0%"],
        }}
        transition={{ duration: 38, repeat: Infinity, ease: "easeInOut", times: [0, 0.2, 0.4, 0.6, 0.8, 1] }}
      >
        {/* Mouse parallax depth layer */}
        <motion.div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `url('${url}')`,
            backgroundSize: "cover",
            backgroundPosition: position,
            opacity,
            filter,
            x: px,
            y: py,
          }}
        />
      </motion.div>
    </div>
  );
}
