"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { useState } from "react";

export default function NavBar() {
  const { data: session, status } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/" });
  };

  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex-shrink-0">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">A</span>
              </div>
              <span className="text-xl font-bold text-gray-900">AppName</span>
            </Link>
          </div>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center space-x-8">
            <Link
              href="/"
              className="text-gray-600 hover:text-indigo-600 transition-colors duration-200 text-sm font-medium"
            >
              Home
            </Link>
            <Link
              href="/dashboard"
              className="text-gray-600 hover:text-indigo-600 transition-colors duration-200 text-sm font-medium"
            >
              Dashboard
            </Link>
            <Link
              href="/about"
              className="text-gray-600 hover:text-indigo-600 transition-colors duration-200 text-sm font-medium"
            >
              About
            </Link>
          </div>

          {/* User Session / Auth */}
          <div className="hidden md:flex items-center space-x-4">
            {status === "loading" ? (
              <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />
            ) : session?.user ? (
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2">
                  {session.user.image ? (
                    <img
                      src={session.user.image}
                      alt={session.user.name ?? "User avatar"}
                      className="w-8 h-8 rounded-full object-cover border border-gray-200"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                      <span className="text-indigo-600 font-semibold text-sm">
                        {session.user.name
                          ? session.user.name.charAt(0).toUpperCase()
                          : (session.user.email?.charAt(0).toUpperCase() ??
                            "U")}
                      </span>
                    </div>
                  )}
                  <span className="text-sm font-medium text-gray-700 max-w-[150px] truncate">
                    {session.user.name ?? session.user.email}
                  </span>
                </div>
                <button
                  onClick={handleSignOut}
                  className="text-sm font-medium text-gray-500 hover:text-red-600 transition-colors duration-200 border border-gray-300 hover:border-red-300 rounded-md px-3 py-1.5"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-3">
                <Link
                  href="/auth/signin"
                  className="text-sm font-medium text-gray-600 hover:text-indigo-600 transition-colors duration-200"
                >
                  Sign in
                </Link>
                <Link
                  href="/auth/signup"
                  className="text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors duration-200 rounded-md px-4 py-2"
                >
                  Sign up
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-md p-1"
              aria-label="Toggle menu"
            >
              {menuOpen ? (
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              ) : (
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-gray-200 bg-white">
          <div className="px-4 py-3 space-y-3">
            <Link
              href="/"
              onClick={() => setMenuOpen(false)}
              className="block text-gray-600 hover:text-indigo-600 transition-colors duration-200 text-sm font-medium py-1"
            >
              Home
            </Link>
            <Link
              href="/dashboard"
              onClick={() => setMenuOpen(false)}
              className="block text-gray-600 hover:text-indigo-600 transition-colors duration-200 text-sm font-medium py-1"
            >
              Dashboard
            </Link>
            <Link
              href="/about"
              onClick={() => setMenuOpen(false)}
              className="block text-gray-600 hover:text-indigo-600 transition-colors duration-200 text-sm font-medium py-1"
            >
              About
            </Link>

            <div className="pt-3 border-t border-gray-100">
              {status === "loading" ? (
                <div className="w-full h-8 bg-gray-200 animate-pulse rounded" />
              ) : session?.user ? (
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    {session.user.image ? (
                      <img
                        src={session.user.image}
                        alt={session.user.name ?? "User avatar"}
                        className="w-8 h-8 rounded-full object-cover border border-gray-200"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                        <span className="text-indigo-600 font-semibold text-sm">
                          {session.user.name
                            ? session.user.name.charAt(0).toUpperCase()
                            : (session.user.email?.charAt(0).toUpperCase() ??
                              "U")}
                        </span>
                      </div>
                    )}
                    <span className="text-sm font-medium text-gray-700 truncate">
                      {session.user.name ?? session.user.email}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      handleSignOut();
                    }}
                    className="w-full text-left text-sm font-medium text-red-600 hover:text-red-700 transition-colors duration-200 py-1"
                  >
                    Sign out
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Link
                    href="/auth/signin"
                    onClick={() => setMenuOpen(false)}
                    className="block text-sm font-medium text-gray-600 hover:text-indigo-600 transition-colors duration-200 py-1"
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/auth/signup"
                    onClick={() => setMenuOpen(false)}
                    className="block text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors duration-200 rounded-md px-4 py-2 text-center"
                  >
                    Sign up
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
