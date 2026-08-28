/**
 * 🌸 Naura OS Dashboard - Floating Mobile Bottom Navigation
 *
 * Thumb-Zone Ergonomics & UXpeak Masterclass Compliance:
 * - Minimum Container Height: 64px
 * - Minimum Interactive Touch Target: 48px x 48px
 * - Active State: Neon Pill Glow (#FFB6C1)
 * - Spring Micro-Interactions: cubic-bezier(0.34, 1.56, 0.64, 1)
 */

import React, { useState, useEffect } from "react";

export default function BottomNav({
  activeSection = "home",
  onNavigate = () => {},
}) {
  const [currentSection, setCurrentSection] = useState(activeSection);

  useEffect(() => {
    setCurrentSection(activeSection);
  }, [activeSection]);

  const navItems = [
    { id: "home", label: "Beranda", icon: "fa-solid fa-house" },
    { id: "chat", label: "AI Naura", icon: "fa-solid fa-brain" },
    { id: "music", label: "Musik", icon: "fa-solid fa-compact-disc" },
    { id: "profile", label: "Profil", icon: "fa-solid fa-id-card" },
    { id: "settings", label: "Setting", icon: "fa-solid fa-sliders" },
  ];

  const handleItemClick = (id, e) => {
    if (e) e.preventDefault();
    setCurrentSection(id);
    onNavigate(id);
    if (
      typeof window !== "undefined" &&
      typeof window.switchSection === "function"
    ) {
      window.switchSection(id);
    }
  };

  return (
    <nav
      id="mobileBottomNav"
      className="mobile-bottom-nav md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around px-2"
      style={{
        height: "64px",
        background: "rgba(11, 12, 16, 0.88)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderTop: "1px solid rgba(255, 182, 193, 0.15)",
        boxShadow: "0 -4px 20px rgba(0, 0, 0, 0.4)",
      }}
      role="navigation"
      aria-label="Mobile Navigation Dock"
    >
      {navItems.map((item) => {
        const isActive = currentSection === item.id;
        return (
          <a
            key={item.id}
            href={`#${item.id}`}
            onClick={(e) => handleItemClick(item.id, e)}
            data-sec={item.id}
            className={`mobile-nav-item flex flex-col items-center justify-center min-w-[48px] min-h-[48px] px-2 py-1 rounded-xl transition-all duration-300 ${
              isActive
                ? "active text-[#0B0C10] font-semibold scale-105"
                : "text-gray-400 hover:text-pink-300 active:scale-95"
            }`}
            style={
              isActive
                ? {
                    background: "#FFB6C1",
                    boxShadow: "0 0 15px rgba(255, 182, 193, 0.5)",
                    transform: "translateY(-2px)",
                    transition: "all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)",
                  }
                : {
                    transition: "all 0.2s ease-out",
                  }
            }
            aria-current={isActive ? "page" : undefined}
          >
            <i
              className={`${item.icon} text-base mb-0.5 ${
                isActive ? "text-[#0B0C10]" : "text-gray-400"
              }`}
            />
            <span
              className="text-[10px] tracking-tight"
              style={{
                fontFamily: "Outfit, sans-serif",
                fontWeight: isActive ? 600 : 400,
              }}
            >
              {item.label}
            </span>
          </a>
        );
      })}
    </nav>
  );
}
