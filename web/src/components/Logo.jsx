'use client';

export default function Logo({ size = 'md', showText = true, animated = true }) {
  const iconSizes = {
    sm: 'w-8 h-8',
    md: 'w-14 h-14',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24'
  };

  const textSizes = {
    sm: 'text-base',
    md: 'text-lg sm:text-xl',
    lg: 'text-2xl sm:text-3xl',
    xl: 'text-3xl sm:text-4xl'
  };

  return (
    <div className="flex items-center gap-3 group select-none cursor-pointer">
      {/* Official Deploy Doctor Logo Image */}
      <div className={`relative ${iconSizes[size]} flex items-center justify-center flex-shrink-0 bg-transparent`}>
        <img
          src="/logo.webp"
          alt="Deploy Doctor Logo"
          className={`w-full h-full object-contain transform group-hover:scale-105 transition-transform duration-300 drop-shadow-[0_0_12px_rgba(80,227,194,0.4)] ${
            animated ? 'hover:rotate-6' : ''
          }`}
        />
      </div>

      {/* Brand Text */}
      {showText && (
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className={`font-bold tracking-tight text-white ${textSizes[size]}`}>
              Deploy<span className="vercel-gradient-text font-extrabold ml-1">Doctor</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

