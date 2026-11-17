import React from 'react';
import { LOGO_URL } from '../data/portalData';

export const BrandMark: React.FC = () => {
  return (
    <div className="flex min-w-0 flex-col items-center gap-0 leading-none">
      <img
        src={LOGO_URL}
        alt="WORKCRAFT logo"
        className="block size-[92px] max-w-full object-contain"
      />
    </div>
  );
};
