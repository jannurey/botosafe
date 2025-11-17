// app/admin/layout.tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FiMenu, FiX, FiHome, FiUsers, FiLogOut, FiUpload } from "react-icons/fi";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const router = useRouter();

  // Check if we're on mobile device
  useEffect(() => {
    const checkIsMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setSidebarOpen(false); // Close sidebar by default on mobile
      } else {
        setSidebarOpen(true); // Open sidebar by default on desktop
      }
    };

    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  const handleLogout = async () => {
    try {
      const res = await fetch("/api/logout", {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        // Clear local storage items
        localStorage.removeItem("user");
        localStorage.removeItem("token");
        localStorage.removeItem("tempLogin");
        localStorage.removeItem("userId");
        localStorage.removeItem("username");
        localStorage.removeItem("userRole");
        localStorage.removeItem("tempAuthToken");
        
        // Dispatch a custom event to notify other components
        window.dispatchEvent(new CustomEvent("user-logout"));
        
        // Redirect to login page
        router.push("/signin/login");
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Mobile menu button */}
      <button 
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="md:hidden fixed top-4 left-4 z-30 p-2 rounded-lg bg-[#791010] text-white shadow-lg"
      >
        {sidebarOpen ? <FiX size={20} /> : <FiMenu size={20} />}
      </button>

      {/* Sidebar - Fixed position with scrollable content */}
      <aside
        className={`bg-white shadow-xl transition-all duration-300 fixed top-0 left-0 h-full z-20
          ${sidebarOpen ? "w-64 translate-x-0" : "-translate-x-full"} 
          md:w-64`}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h1 className={`font-bold text-lg text-[#791010] ${!sidebarOpen && "hidden"} md:block`}>
            Admin Panel
          </h1>
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-[#791010] hover:bg-gray-100 p-2 rounded-full transition-colors md:hidden"
          >
            {sidebarOpen ? <FiX size={20} /> : <FiMenu size={20} />}
          </button>
        </div>

        <nav className="p-4 space-y-2 mt-4 pb-8 overflow-y-auto h-[calc(100vh-80px)]">
          <Link
            href="/admin/dashboard"
            className="flex items-center space-x-3 text-gray-700 hover:bg-[#791010] hover:text-white p-3 rounded-lg transition-all duration-200"
          >
            <FiHome size={20} /> 
            <span className={`${!sidebarOpen && "hidden"} md:block font-medium`}>Dashboard</span>
          </Link>
          <Link
            href="/admin/import-students"
            className="flex items-center space-x-3 text-gray-700 hover:bg-[#791010] hover:text-white p-3 rounded-lg transition-all duration-200"
          >
            <FiUpload size={20} /> 
            <span className={`${!sidebarOpen && "hidden"} md:block font-medium`}>Import Students</span>
          </Link>
          <Link
            href="/admin/voters"
            className="flex items-center space-x-3 text-gray-700 hover:bg-[#791010] hover:text-white p-3 rounded-lg transition-all duration-200"
          >
            <FiUsers size={20} /> 
            <span className={`${!sidebarOpen && "hidden"} md:block font-medium`}>Voters</span>
          </Link>
          <Link
            href="/admin/elections"
            className="flex items-center space-x-3 text-gray-700 hover:bg-[#791010] hover:text-white p-3 rounded-lg transition-all duration-200"
          >
            <FiUsers size={20} /> 
            <span className={`${!sidebarOpen && "hidden"} md:block font-medium`}>Elections</span>
          </Link>
          <Link
            href="/admin/candidates"
            className="flex items-center space-x-3 text-gray-700 hover:bg-[#791010] hover:text-white p-3 rounded-lg transition-all duration-200"
          >
            <FiUsers size={20} /> 
            <span className={`${!sidebarOpen && "hidden"} md:block font-medium`}>Candidates</span>
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center space-x-3 text-gray-700 hover:bg-red-600 hover:text-white p-3 rounded-lg transition-all duration-200 w-full text-left mt-8"
          >
            <FiLogOut size={20} /> 
            <span className={`${!sidebarOpen && "hidden"} md:block font-medium`}>Logout</span>
          </button>
        </nav>
      </aside>

      {/* Overlay for mobile when sidebar is open */}
      {isMobile && sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-10"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      {/* Main Content - Fixed positioning with scrollable content */}
      <main className={`flex-1 transition-all duration-300 ${sidebarOpen ? "md:ml-64" : "md:ml-16"} mt-16 md:mt-0 p-4 md:p-6 min-h-screen w-full`}>
        <div className="pb-6"> {/* Added padding to ensure content doesn't get cut off */}
          {children}
        </div>
      </main>
    </div>
  );
}