import React from 'react';

interface HeartIconProps {
  size?: number;
  className?: string;
}

export const HeartIcon: React.FC<HeartIconProps> = ({ size = 24, className = '' }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Corazón Principal (Grande) */}
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
      {/* Corazón Secundario Interno (Latido en segundo tamaño) */}
      <path
        d="M12 15.5l-.8-.73C8.4 12.3 6.5 10.5 6.5 8.2c0-1.8 1.4-3.2 3.2-3.2 1 0 2 .5 2.6 1.3.6-.8 1.6-1.3 2.6-1.3 1.8 0 3.2 1.4 3.2 3.2 0 2.3-1.9 4.1-4.7 6.57L12 15.5z"
        fill="currentColor"
        opacity="0.3"
      />
    </svg>
  );
};
