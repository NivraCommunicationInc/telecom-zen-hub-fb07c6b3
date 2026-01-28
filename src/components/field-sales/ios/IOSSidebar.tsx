/**
 * IOSSidebar - iOS-style sliding sidebar for field sales portal
 */
import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, Home, ShoppingBag, Trophy, DollarSign, User, 
  LogOut, Settings, HelpCircle, Bell, Wallet, Target,
  ChevronRight, Briefcase, List
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface IOSSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  userName: string;
  userEmail: string;
  avatarUrl?: string;
}

const menuItems = [
  { 
    section: "Navigation",
    items: [
      { path: "/field-sales/dashboard", label: "Tableau de bord", icon: Home },
      { path: "/field-sales/pos", label: "Point de vente", icon: ShoppingBag },
      { path: "/field-sales/sales", label: "Mes ventes", icon: List },
    ]
  },
  {
    section: "Performance",
    items: [
      { path: "/field-sales/leaderboard", label: "Classement", icon: Trophy },
      { path: "/field-sales/commissions", label: "Commissions", icon: DollarSign },
      { path: "/field-sales/objectives", label: "Objectifs & Bonus", icon: Target },
    ]
  },
  {
    section: "Compte",
    items: [
      { path: "/field-sales/cashout", label: "Demande de retrait", icon: Wallet },
      { path: "/field-sales/notifications", label: "Notifications", icon: Bell },
      { path: "/field-sales/account", label: "Mon profil", icon: User },
    ]
  }
];

export function IOSSidebar({ isOpen, onClose, userName, userEmail, avatarUrl }: IOSSidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Déconnexion réussie");
    navigate("/field-sales");
    onClose();
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    onClose();
  };

  const initials = userName
    .split(" ")
    .map(n => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
          />
          
          {/* Sidebar */}
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed left-0 top-0 bottom-0 z-[101] w-80 bg-slate-950 border-r border-slate-800/60 flex flex-col"
          >
            {/* Header */}
            <div className="p-4 border-b border-slate-800/60">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500">
                    <Briefcase className="h-5 w-5 text-white" />
                  </div>
                  <span className="text-white font-semibold">Nivra Terrain</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
              
              {/* User Profile */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/60 border border-slate-800/60">
                <Avatar className="h-12 w-12 border-2 border-orange-500/30">
                  <AvatarFallback className="bg-gradient-to-br from-orange-500 to-amber-500 text-white font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{userName}</p>
                  <p className="text-xs text-slate-500 truncate">{userEmail}</p>
                </div>
              </div>
            </div>

            {/* Menu */}
            <div className="flex-1 overflow-y-auto py-4">
              {menuItems.map((section, sectionIdx) => (
                <div key={sectionIdx} className="mb-6">
                  <p className="px-4 mb-2 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    {section.section}
                  </p>
                  <div className="space-y-1 px-2">
                    {section.items.map((item) => {
                      const isActive = location.pathname === item.path;
                      const Icon = item.icon;
                      
                      return (
                        <button
                          key={item.path}
                          onClick={() => handleNavigation(item.path)}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all",
                            isActive 
                              ? "bg-orange-500/15 text-orange-400" 
                              : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
                          )}
                        >
                          <Icon className="h-5 w-5 shrink-0" />
                          <span className="font-medium">{item.label}</span>
                          <ChevronRight className={cn(
                            "h-4 w-4 ml-auto transition-transform",
                            isActive && "text-orange-400"
                          )} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-800/60">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-400 hover:bg-red-500/10 transition-all"
              >
                <LogOut className="h-5 w-5" />
                <span className="font-medium">Déconnexion</span>
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
