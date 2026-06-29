import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans selection:bg-blue-200">
      {/* --- NAVIGATION BAR --- */}
      <nav className="fixed w-full bg-white/80 backdrop-blur-md border-b border-gray-200 z-50 transition-all">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-3xl font-black text-blue-600 tracking-tighter cursor-default">
            LogiMatch
          </h1>
          <div className="flex items-center gap-2 sm:gap-4">
            <Link
              href="/login"
              className="px-4 py-2 font-bold text-gray-600 hover:text-blue-600 transition-colors text-sm sm:text-base"
            >
              Log In
            </Link>
            <Link
              href="/register"
              className="px-5 py-2.5 bg-blue-600 text-white font-bold rounded-full hover:bg-blue-700 shadow-md hover:shadow-lg transition-all text-sm sm:text-base transform hover:-translate-y-0.5"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* --- HERO SECTION --- */}
      <main className="pt-32 pb-16 lg:pt-48 lg:pb-24 max-w-7xl mx-auto px-6 lg:px-8 grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
        <div className="max-w-2xl">
          <div className="inline-block px-4 py-1.5 bg-blue-50 border border-blue-100 text-blue-700 font-bold text-xs tracking-widest uppercase rounded-full mb-6">
            The Future of Freight
          </div>
          <h2 className="text-5xl sm:text-6xl lg:text-7xl font-black leading-[1.1] tracking-tight mb-6 text-gray-900">
            Industrial Logistics,
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-500">
              Reinvented.
            </span>
          </h2>
          <p className="text-lg sm:text-xl text-gray-600 mb-10 leading-relaxed font-medium">
            LogiMatch directly connects enterprise cargo seekers with verified,
            top-tier transport fleets through a real-time auction market.
            Eliminate the middleman, ensure fair pricing, and track your freight
            from dock to door.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              href="/register"
              className="inline-flex justify-center items-center px-8 py-4 bg-gray-900 text-white font-bold rounded-xl shadow-xl hover:bg-black transition-all transform hover:-translate-y-1 text-lg"
            >
              Enter the Open Market ➔
            </Link>
            <Link
              href="/login"
              className="inline-flex justify-center items-center px-8 py-4 bg-white text-gray-900 border-2 border-gray-200 font-bold rounded-xl hover:border-gray-300 hover:bg-gray-50 transition-all text-lg"
            >
              Partner Sign In
            </Link>
          </div>
        </div>

        {/* Feature Grid Image Replacement */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:pl-8">
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-2xl mb-6 shadow-inner">
              ⚡
            </div>
            <h3 className="text-xl font-extrabold text-gray-900 mb-3">
              Live Auctions
            </h3>
            <p className="text-sm text-gray-600 font-medium leading-relaxed">
              Our real-time bidding engine guarantees absolute true market value
              for every single shipment, driving down costs.
            </p>
          </div>
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow sm:mt-8">
            <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center text-2xl mb-6 shadow-inner">
              🧮
            </div>
            <h3 className="text-xl font-extrabold text-gray-900 mb-3">
              AI Pricing Model
            </h3>
            <p className="text-sm text-gray-600 font-medium leading-relaxed">
              Instantly calculate fair baseline freight budgets using live
              distance, payload sizing, and dynamic surcharges.
            </p>
          </div>
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center text-2xl mb-6 shadow-inner">
              🛡️
            </div>
            <h3 className="text-xl font-extrabold text-gray-900 mb-3">
              Trust Engine
            </h3>
            <p className="text-sm text-gray-600 font-medium leading-relaxed">
              We mandate verified business document uploads and maintain a
              strict 5-star performance rating system for all drivers.
            </p>
          </div>
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow sm:mt-8">
            <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center text-2xl mb-6 shadow-inner">
              📍
            </div>
            <h3 className="text-xl font-extrabold text-gray-900 mb-3">
              Live Dispatch
            </h3>
            <p className="text-sm text-gray-600 font-medium leading-relaxed">
              Track your valuable freight with end-to-end milestone updates from
              the origin loading dock to final delivery.
            </p>
          </div>
        </div>
      </main>

      {/* --- FOOTER --- */}
      <footer className="border-t border-gray-200 bg-white mt-12">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-gray-500 font-medium text-sm">
            © {new Date().getFullYear()} LogiMatch Enterprise Logistics. All
            rights reserved.
          </p>
          <div className="flex gap-6 text-sm font-bold text-gray-600">
            <a href="#" className="hover:text-blue-600 transition-colors">
              Privacy Policy
            </a>
            <a href="#" className="hover:text-blue-600 transition-colors">
              Terms of Service
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
