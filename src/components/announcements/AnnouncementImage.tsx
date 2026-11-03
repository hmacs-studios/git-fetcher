import React, { useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

interface AnnouncementImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  wrapperClassName?: string;
}

export const AnnouncementImage: React.FC<AnnouncementImageProps> = ({
  src,
  alt = 'Announcement media',
  className = '',
  wrapperClassName = '',
  onError,
  ...props
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  return (
    <div className={`relative overflow-hidden rounded-xl ${wrapperClassName}`}>
      {!isLoaded && !hasError && (
        <Skeleton className="absolute inset-0 h-full w-full min-h-[180px] rounded-xl bg-muted/70 animate-pulse" />
      )}
      <img
        src={hasError ? 'https://placehold.co/600x400/cccccc/333333?text=Image+Not+Available' : src}
        alt={alt}
        loading="lazy"
        onLoad={() => setIsLoaded(true)}
        onError={(e) => {
          setHasError(true);
          setIsLoaded(true);
          if (onError) onError(e);
        }}
        className={`transition-opacity duration-300 ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        } ${className}`}
        {...props}
      />
    </div>
  );
};
