import React from "react";
import { cn } from "@/lib/utils";

interface ImageSourcePreviewProps {
  src: string;
  alt: string;
  className?: string;
}

export const ImageSourcePreview: React.FC<ImageSourcePreviewProps> = ({ src, alt, className }) => {
  return (
    <img
      src={src}
      alt={alt}
      className={cn("max-w-full max-h-full object-contain select-none pointer-events-none", className)}
    />
  );
};
