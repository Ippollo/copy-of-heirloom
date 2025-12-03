
import React, { useState } from 'react';
import { TreeDeciduous } from 'lucide-react';

export const HeirloomLogo: React.FC<{ className?: string }> = ({ className }) => {
  const [imgError, setImgError] = useState(false);

  // Attempt to use the user's provided file
  if (!imgError) {
    return (
      <img 
        src="/tree_logo.png" 
        alt="Heirloom Logo"
        className={`${className} object-contain`}
        onError={() => setImgError(true)}
      />
    );
  }

  // Fallback: Round Tree Icon
  return (
    <TreeDeciduous className={className} strokeWidth={1.5} />
  );
};
