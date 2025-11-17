"use client";

import Image from "next/image";
import Link from "next/link";
import React, { useState, useEffect } from "react";
import { HiMenu, HiX } from "react-icons/hi";
import { FaUserCircle } from "react-icons/fa";
import { useRouter } from "next/navigation";

type User = {
  fullname: string;
  hasVoted?: boolean; // 👈 add this field from your backend
};

const Header = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();

  const toggleMenu = () => setMenuOpen(!menuOpen);

  useEffect(() => {
    const checkAuthStatus = async () => {
      // Check for temporary auth token first
      const tempAuthToken = localStorage.getItem("tempAuthToken");
      if (tempAuthToken) {
        try {
          // Decode the temporary token
          const decodedTempToken = JSON.parse(atob(tempAuthToken));
          const userId = decodedTempToken.userId;
          const exp = decodedTempToken.exp;
          
          // Check if token is still valid
          if (Date.now() < exp && userId) {
            // Use temporary authentication
            const res = await fetch("/api/users/me", {
              method: "GET",
              credentials: "include",
              headers: {
                "Content-Type": "application/json",
                "x-temp-login": "true",
                "x-user-id": userId.toString(),
              },
            });

            if (res.ok) {
              const data = await res.json();
              if (data && data.user) {
                setUser(data.user);
              } else {
                setUser(null);
                // Clear invalid temp token
                localStorage.removeItem("tempAuthToken");
              }
              return;
            } else {
              // Clear invalid temp token
              localStorage.removeItem("tempAuthToken");
            }
          } else {
            // Token expired, clear it
            localStorage.removeItem("tempAuthToken");
          }
        } catch (decodeError) {
          // Invalid token format, clear it
          localStorage.removeItem("tempAuthToken");
        }
      }
      
      // For regular authentication, we don't check the cookie directly since it's HttpOnly
      // Instead, we just try to fetch the user data
      await fetchUser();
    };

    const fetchUser = async () => {
      try {
        const res = await fetch("/api/users/me", {
          method: "GET",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (res.ok) {
          const data = await res.json();
          if (data && data.user) {
            setUser(data.user);
          } else {
            setUser(null);
          }
        } else {
          // Clear user state on 401/404
          if (res.status === 401 || res.status === 404) {
            setUser(null);
          } else {
            console.error("Error fetching user:", res.status, res.statusText);
          }
        }
      } catch (err) {
        // Don't log errors for network issues, this is expected for unauthenticated users
        // console.error("Error fetching user:", err);
        setUser(null);
      }
    };

    checkAuthStatus();
    
    // Listen for storage changes (logout events)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "user" && e.newValue === null) {
        setUser(null);
      }
    };
    
    // Listen for custom logout event
    const handleLogout = () => {
      // Clear local storage items
      localStorage.removeItem("tempLogin");
      localStorage.removeItem("userId");
      localStorage.removeItem("tempAuthToken");
      setUser(null);
    };
    
    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("user-logout", handleLogout);
    
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("user-logout", handleLogout);
    };
  }, []);

  // 👇 Vote click handler
  const handleVoteClick = () => {
    if (!user) {
      showToast("⚠️ You are not logged in. Redirecting to Sign In...", "warning");
      setTimeout(() => {
        window.location.href = "/signin/login";
      }, 2000);
    } else if (user.hasVoted) {
      showToast("✅ You have already voted. Redirecting to Dashboard...", "success");
      setTimeout(() => {
        window.location.href = "/pages/dashboard";
      }, 2000);
    } else {
      window.location.href = "/pages/vote";
    }
  };

  // Toast notification function
  const showToast = (message: string, type: "success" | "warning" | "error" | "info" = "info") => {
    // Remove any existing toast
    const existingToast = document.getElementById('header-toast');
    if (existingToast) {
      document.body.removeChild(existingToast);
    }

    // Create toast element
    const toast = document.createElement('div');
    toast.id = 'header-toast';
    toast.textContent = message;
    
    // Set styles based on type
    const baseClasses = "fixed top-20 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-lg shadow-lg z-50 font-medium text-white transition-all duration-300";
    const typeClasses = {
      success: "bg-green-500",
      warning: "bg-yellow-500",
      error: "bg-red-500",
      info: "bg-blue-500"
    };
    
    toast.className = `${baseClasses} ${typeClasses[type]}`;
    
    // Add to document
    document.body.appendChild(toast);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
      if (document.body.contains(toast)) {
        toast.style.opacity = "0";
        setTimeout(() => {
          if (document.body.contains(toast)) {
            document.body.removeChild(toast);
          }
        }, 300);
      }
    }, 3000);
  };

  return (
    <header className="bg-white shadow-lg px-6 py-4 border-b border-gray-100">
      <div className="flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <Image
            src="/images/botosafe-logo.png"
            alt="BotoSafe Logo"
            width={45}
            height={45}
          />
          <span className="font-bold text-2xl text-[#791010]">BotoSafe</span>
        </div>

        {/* Hamburger */}
        <button
          className="md:hidden text-[#791010] text-2xl focus:outline-none p-2 rounded-lg hover:bg-gray-100 transition-colors"
          onClick={toggleMenu}
        >
          {menuOpen ? <HiX /> : <HiMenu />}
        </button>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex gap-8 text-sm font-semibold uppercase text-[#791010] items-center">
          <Link href="/" className="hover:text-[#5a0c0c] transition-colors py-2 px-3 rounded-lg hover:bg-gray-50">
            Home
          </Link>
          <Link href="/pages/candidates" className="hover:text-[#5a0c0c] transition-colors py-2 px-3 rounded-lg hover:bg-gray-50">
            Candidates
          </Link>
          <Link
            href="#"
            onClick={(e) => {
              e.preventDefault();
              handleVoteClick(); // reuse your function
              toggleMenu();
            }}
            className="hover:text-[#5a0c0c] uppercase py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors"
          >
            VOTE
          </Link>
          <Link href="/pages/dashboard" className="hover:text-[#5a0c0c] transition-colors py-2 px-3 rounded-lg hover:bg-gray-50">
            Dashboard
          </Link>

          {user ? (
            <Link
              href="/pages/profile"
              className="hover:text-[#5a0c0c] flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <FaUserCircle className="text-2xl" />
              <span>{user.fullname}</span>
            </Link>
          ) : (
            <Link href="/signin/login" className="hover:text-[#5a0c0c] py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors">
              Sign In
            </Link>
          )}
        </nav>
      </div>

      {/* Mobile Navigation */}
      {menuOpen && (
        <nav className="mt-4 flex flex-col gap-2 text-sm font-semibold uppercase text-[#791010] md:hidden bg-white rounded-xl shadow-lg p-4 border border-gray-100">
          <Link href="/" className="hover:text-[#5a0c0c] p-3 rounded-lg hover:bg-gray-50 transition-colors" onClick={toggleMenu}>
            Home
          </Link>
          <Link
            href="/pages/candidates"
            className="hover:text-[#5a0c0c] p-3 rounded-lg hover:bg-gray-50 transition-colors"
            onClick={toggleMenu}
          >
            Candidates
          </Link>
          {/* Vote Link with Handler */}
          <Link
            href="#"
            onClick={(e) => {
              e.preventDefault();
              handleVoteClick(); // reuse your function
              toggleMenu();
            }}
            className="hover:text-[#5a0c0c] uppercase p-3 rounded-lg hover:bg-gray-50 transition-colors"
          >
            VOTE
          </Link>
          <Link
            href="/pages/dashboard"
            className="hover:text-[#5a0c0c] p-3 rounded-lg hover:bg-gray-50 transition-colors"
            onClick={toggleMenu}
          >
            Dashboard
          </Link>

          {user ? (
            <Link
              href="/pages/profile"
              className="hover:text-[#5a0c0c] flex items-center gap-2 p-3 rounded-lg hover:bg-gray-50 transition-colors"
              onClick={toggleMenu}
            >
              <FaUserCircle className="text-xl" />
              <span>{user.fullname}</span>
            </Link>
          ) : (
            <Link
              href="/signin/login"
              className="hover:text-[#5a0c0c] p-3 rounded-lg hover:bg-gray-50 transition-colors"
              onClick={toggleMenu}
            >
              Sign In
            </Link>
          )}
        </nav>
      )}
    </header>
  );
};

export default Header;