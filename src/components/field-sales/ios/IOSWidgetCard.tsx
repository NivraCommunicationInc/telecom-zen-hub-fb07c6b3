/**
 * IOSWidgetCard - iOS-style widget card with blur and gradient
 */
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface IOSWidgetCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  variant?: "default" | "gradient" | "glass" | "outline";
  gradientFrom?: string;
  gradientTo?: string;
}

export function IOSWidgetCard({ 
  children, 
  className,
  onClick,
  variant = "default",
  gradientFrom = "from-slate-900",
  gradientTo = "to-slate-900/60",
}: IOSWidgetCardProps) {
  const baseClasses = "rounded-2xl backdrop-blur-xl transition-all";
  
  const variantClasses = {
    default: "bg-slate-900/80 border border-slate-800/60",
    gradient: cn("bg-gradient-to-br", gradientFrom, gradientTo, "border border-white/5"),
    glass: "bg-white/5 border border-white/10",
    outline: "bg-transparent border border-slate-700/50",
  };

  const Component = onClick ? motion.button : motion.div;

  return (
    <Component
      onClick={onClick}
      whileTap={onClick ? { scale: 0.98 } : undefined}
      className={cn(baseClasses, variantClasses[variant], className)}
    >
      {children}
    </Component>
  );
}

// Stat Widget
interface IOSStatWidgetProps {
  label: string;
  value: string | number;
  subValue?: string;
  icon: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  color?: "orange" | "cyan" | "emerald" | "purple" | "amber" | "blue";
  onClick?: () => void;
}

export function IOSStatWidget({
  label,
  value,
  subValue,
  icon,
  trend,
  trendValue,
  color = "orange",
  onClick,
}: IOSStatWidgetProps) {
  const colorClasses = {
    orange: {
      bg: "from-orange-500/20 to-orange-500/5",
      border: "border-orange-500/20",
      icon: "bg-orange-500/20 text-orange-400",
      text: "text-orange-400",
    },
    cyan: {
      bg: "from-cyan-500/20 to-cyan-500/5",
      border: "border-cyan-500/20",
      icon: "bg-cyan-500/20 text-cyan-400",
      text: "text-cyan-400",
    },
    emerald: {
      bg: "from-emerald-500/20 to-emerald-500/5",
      border: "border-emerald-500/20",
      icon: "bg-emerald-500/20 text-emerald-400",
      text: "text-emerald-400",
    },
    purple: {
      bg: "from-purple-500/20 to-purple-500/5",
      border: "border-purple-500/20",
      icon: "bg-purple-500/20 text-purple-400",
      text: "text-purple-400",
    },
    amber: {
      bg: "from-amber-500/20 to-amber-500/5",
      border: "border-amber-500/20",
      icon: "bg-amber-500/20 text-amber-400",
      text: "text-amber-400",
    },
    blue: {
      bg: "from-blue-500/20 to-blue-500/5",
      border: "border-blue-500/20",
      icon: "bg-blue-500/20 text-blue-400",
      text: "text-blue-400",
    },
  };

  const colors = colorClasses[color];

  return (
    <IOSWidgetCard
      onClick={onClick}
      variant="gradient"
      gradientFrom={colors.bg.split(" ")[0]}
      gradientTo={colors.bg.split(" ")[1]}
      className={cn("p-4", colors.border, onClick && "cursor-pointer active:scale-[0.98]")}
    >
      <div className="flex items-start justify-between mb-2">
        <div className={cn("p-2 rounded-xl", colors.icon)}>
          {icon}
        </div>
        {trend && trendValue && (
          <span className={cn(
            "text-xs font-semibold px-2 py-0.5 rounded-full",
            trend === "up" && "bg-emerald-500/20 text-emerald-400",
            trend === "down" && "bg-red-500/20 text-red-400",
            trend === "neutral" && "bg-slate-500/20 text-slate-400"
          )}>
            {trend === "up" && "↑"}{trend === "down" && "↓"} {trendValue}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-white mb-0.5">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
      {subValue && (
        <p className={cn("text-sm font-semibold mt-1", colors.text)}>{subValue}</p>
      )}
    </IOSWidgetCard>
  );
}

// Progress Widget
interface IOSProgressWidgetProps {
  label: string;
  current: number;
  target: number;
  unit?: string;
  icon: React.ReactNode;
  color?: "orange" | "purple" | "emerald" | "cyan";
}

export function IOSProgressWidget({
  label,
  current,
  target,
  unit = "",
  icon,
  color = "purple",
}: IOSProgressWidgetProps) {
  const progress = Math.min(100, Math.round((current / target) * 100));
  
  const colorClasses = {
    orange: "from-orange-500 to-amber-500",
    purple: "from-purple-500 to-pink-500",
    emerald: "from-emerald-500 to-teal-500",
    cyan: "from-cyan-500 to-blue-500",
  };

  return (
    <IOSWidgetCard className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-slate-800/80 text-slate-400">
            {icon}
          </div>
          <span className="text-sm text-white font-medium">{label}</span>
        </div>
        <span className={cn(
          "text-xs font-bold px-2 py-1 rounded-lg",
          progress >= 100 
            ? "bg-emerald-500/20 text-emerald-400" 
            : "bg-slate-800/80 text-slate-400"
        )}>
          {progress}%
        </span>
      </div>
      <div className="h-2.5 bg-slate-800/80 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className={cn(
            "h-full rounded-full bg-gradient-to-r",
            colorClasses[color]
          )}
        />
      </div>
      <p className="text-xs text-slate-500 mt-2 text-center">
        {current}{unit} / {target}{unit}
      </p>
    </IOSWidgetCard>
  );
}
