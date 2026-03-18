import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
      {/* Navigation */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center">
            <svg
              className="w-5 h-5 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </div>
          <span className="text-xl font-bold">Lumina AI</span>
        </div>
        <div className="flex items-center gap-6">
          <a
            href="#features"
            className="text-slate-300 hover:text-white transition-colors text-sm"
          >
            Features
          </a>
          <a
            href="#how-it-works"
            className="text-slate-300 hover:text-white transition-colors text-sm"
          >
            How it works
          </a>
          <Link
            href="/api/auth/signin"
            className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Sign In
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 pt-20 pb-32 text-center">
        <div className="inline-flex items-center gap-2 bg-purple-500/20 border border-purple-500/30 rounded-full px-4 py-1.5 text-sm text-purple-300 mb-8">
          <span className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></span>
          Powered by Claude AI
        </div>

        <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
          Intelligence that{" "}
          <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            understands you
          </span>
        </h1>

        <p className="text-xl text-slate-300 max-w-2xl mx-auto mb-10 leading-relaxed">
          Experience the next generation of AI assistance. Lumina AI combines
          cutting-edge language models with an intuitive interface to help you
          think, create, and accomplish more.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/api/auth/signin"
            className="bg-purple-600 hover:bg-purple-500 text-white px-8 py-4 rounded-xl text-lg font-semibold transition-all hover:scale-105 hover:shadow-lg hover:shadow-purple-500/25"
          >
            Get Started Free
          </Link>
          <a
            href="#features"
            className="border border-slate-600 hover:border-slate-400 text-slate-300 hover:text-white px-8 py-4 rounded-xl text-lg font-semibold transition-all"
          >
            Learn More
          </a>
        </div>

        {/* Hero Visual */}
        <div className="mt-20 relative">
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent z-10 pointer-events-none rounded-2xl" />
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 max-w-3xl mx-auto backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="ml-2 text-slate-400 text-sm">
                Lumina AI Chat
              </span>
            </div>
            <div className="space-y-4 text-left">
              <div className="flex gap-3">
                <div className="w-8 h-8 bg-slate-600 rounded-full flex-shrink-0 flex items-center justify-center text-xs">
                  U
                </div>
                <div className="bg-slate-700/50 rounded-2xl rounded-tl-sm px-4 py-3 text-slate-300 text-sm max-w-sm">
                  Can you help me write a compelling product description?
                </div>
              </div>
              <div className="flex gap-3 justify-end">
                <div className="bg-purple-600/30 border border-purple-500/20 rounded-2xl rounded-tr-sm px-4 py-3 text-slate-200 text-sm max-w-sm">
                  Absolutely! I&apos;d love to help craft a compelling product
                  description. Tell me about your product — what makes it
                  unique, who&apos;s your target audience, and what problem does
                  it solve?
                </div>
                <div className="w-8 h-8 bg-purple-600 rounded-full flex-shrink-0 flex items-center justify-center">
                  <svg
                    className="w-4 h-4 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="max-w-7xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">
            Everything you need to{" "}
            <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              work smarter
            </span>
          </h2>
          <p className="text-slate-400 text-lg max-w-xl mx-auto">
            Lumina AI is packed with features designed to supercharge your
            productivity and creativity.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              icon: (
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
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
              ),
              title: "Natural Conversations",
              description:
                "Engage in fluid, context-aware conversations that feel natural and productive. Our AI remembers context throughout your session.",
              color: "purple",
            },
            {
              icon: (
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
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                  />
                </svg>
              ),
              title: "Creative Assistance",
              description:
                "From writing and brainstorming to code and analysis — Lumina AI adapts to your creative needs and helps you produce your best work.",
              color: "pink",
            },
            {
              icon: (
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
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              ),
              title: "Secure & Private",
              description:
                "Your conversations are encrypted and private. We never use your data to train models or share it with third parties.",
              color: "blue",
            },
            {
              icon: (
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
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              ),
              title: "Lightning Fast",
              description:
                "Get responses in milliseconds. Our optimized infrastructure ensures you never wait long for the insights you need.",
              color: "yellow",
            },
            {
              icon: (
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
                    d="M4 6h16M4 10h16M4 14h16M4 18h16"
                  />
                </svg>
              ),
              title: "Conversation History",
              description:
                "Access all your past conversations anytime. Search, revisit, and build upon previous discussions seamlessly.",
              color: "green",
            },
            {
              icon: (
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
                    d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                  />
                </svg>
              ),
              title: "Code Intelligence",
              description:
                "Write, debug, and understand code across dozens of programming languages with expert-level AI assistance.",
              color: "orange",
            },
          ].map((feature, index) => (
            <div
              key={index}
              className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6 hover:border-purple-500/30 transition-all hover:bg-slate-800/60 group"
            >
              <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center text-purple-400 mb-4 group-hover:bg-purple-500/30 transition-colors">
                {feature.icon}
              </div>
              <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works Section */}
      <section
        id="how-it-works"
        className="max-w-7xl mx-auto px-6 py-24 border-t border-slate-800"
      >
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">
            Get started in{" "}
            <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              minutes
            </span>
          </h2>
          <p className="text-slate-400 text-lg max-w-xl mx-auto">
            No complex setup required. Sign in and start having intelligent
            conversations right away.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 relative">
          <div className="hidden md:block absolute top-8 left-1/3 right-1/3 h-0.5 bg-gradient-to-r from-purple-500/50 to-purple-500/50" />

          {[
            {
              step: "01",
              title: "Create your account",
              description:
                "Sign in with your existing account or create a new one in seconds. No credit card required to get started.",
            },
            {
              step: "02",
              title: "Start a conversation",
              description:
                "Type your first message and experience the power of Claude AI. Ask anything — from simple questions to complex tasks.",
            },
            {
              step: "03",
              title: "Accomplish more",
              description:
                "Use Lumina AI daily to boost your productivity, creativity, and decision-making across all areas of your work.",
            },
          ].map((item, index) => (
            <div key={index} className="text-center relative">
              <div className="w-16 h-16 bg-purple-600 rounded-2xl flex items-center justify-center text-2xl font-bold mx-auto mb-6 relative z-10">
                {item.step}
              </div>
              <h3 className="text-xl font-semibold mb-3">{item.title}</h3>
              <p className="text-slate-400 leading-relaxed">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-7xl mx-auto px-6 py-24">
        <div className="bg-gradient-to-r from-purple-900/50 to-pink-900/50 border border-purple-500/20 rounded-3xl p-12 text-center">
          <h2 className="text-4xl font-bold mb-4">
            Ready to experience the future?
          </h2>
          <p className="text-slate-300 text-lg mb-8 max-w-xl mx-auto">
            Join thousands of users who are already using Lumina AI to work
            smarter and achieve more every day.
          </p>
          <Link
            href="/api/auth/signin"
            className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-8 py-4 rounded-xl text-lg font-semibold transition-all hover:scale-105 hover:shadow-lg hover:shadow-purple-500/25"
          >
            Start for Free
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7l5 5m0 0l-5 5m5-5H6"
              />
            </svg>
          </Link>
          <p className="text-slate-500 text-sm mt-4">
            No credit card required · Free to get started
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 px-6 py-8 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-purple-500 rounded-md flex items-center justify-center">
              <svg
                className="w-4 h-4 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <span className="font-semibold">Lumina AI</span>
          </div>
          <p className="text-slate-500 text-sm">
            © {new Date().getFullYear()} Lumina AI. All rights reserved.
          </p>
          <div className="flex gap-6 text-sm text-slate-500">
            <a href="#" className="hover:text-slate-300 transition-colors">
              Privacy
            </a>
            <a href="#" className="hover:text-slate-300 transition-colors">
              Terms
            </a>
            <a href="#" className="hover:text-slate-300 transition-colors">
              Contact
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
