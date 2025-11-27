import React from "react";

const Footer: React.FC = () => {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-gray-100 border-t border-gray-200 py-3">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between text-xs sm:text-sm text-gray-600">
          {/* Left: Brand */}
          <span className="font-semibold text-[#791010] tracking-wide">
            BOTOSAFE
          </span>

          {/* Middle: Rights */}
          <span className="text-gray-500 text-[11px] sm:text-xs">
            &copy; {year} BOTOSAFE. All Rights Reserved.
          </span>

          {/* Right: Tagline */}
          <span className="text-right">
            Your secure student voting platform — smart, safe, and stress-free.
          </span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;