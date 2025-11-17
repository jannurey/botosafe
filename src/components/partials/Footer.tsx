import React from "react";
import Link from "next/link";

const Footer: React.FC = () => {
  return (
    <footer className="bg-gray-100 border-t border-gray-200 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand Column */}
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-xl font-bold text-[#791010]">BOTOSAFE</h2>
            </div>
            <p className="text-gray-600 text-sm mb-4">
              Your secure student voting platform - smart, safe, and stress-free.
            </p>
            <p className="text-gray-500 text-xs">
              &copy; {new Date().getFullYear()} BOTOSAFE. All rights reserved.
            </p>
          </div>

          {/* Quick Links Column */}
          <div>
            <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wider mb-4">
              Quick Links
            </h3>
            <ul className="space-y-2">
              <li>
                <Link 
                  href="/" 
                  className="text-gray-600 hover:text-[#791010] text-sm transition-colors"
                >
                  Home
                </Link>
              </li>
              <li>
                <Link 
                  href="/pages/candidates" 
                  className="text-gray-600 hover:text-[#791010] text-sm transition-colors"
                >
                  Candidates
                </Link>
              </li>
              <li>
                <Link 
                  href="/pages/dashboard" 
                  className="text-gray-600 hover:text-[#791010] text-sm transition-colors"
                >
                  Dashboard
                </Link>
              </li>
              <li>
                <Link 
                  href="/signin/login" 
                  className="text-gray-600 hover:text-[#791010] text-sm transition-colors"
                >
                  Sign In
                </Link>
              </li>
            </ul>
          </div>

          {/* Support Column */}
          <div>
            <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wider mb-4">
              Support
            </h3>
            <ul className="space-y-2">
              <li>
                <Link 
                  href="#" 
                  className="text-gray-600 hover:text-[#791010] text-sm transition-colors"
                >
                  Help Center
                </Link>
              </li>
              <li>
                <Link 
                  href="#" 
                  className="text-gray-600 hover:text-[#791010] text-sm transition-colors"
                >
                  Contact Us
                </Link>
              </li>
              <li>
                <Link 
                  href="#" 
                  className="text-gray-600 hover:text-[#791010] text-sm transition-colors"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link 
                  href="#" 
                  className="text-gray-600 hover:text-[#791010] text-sm transition-colors"
                >
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;