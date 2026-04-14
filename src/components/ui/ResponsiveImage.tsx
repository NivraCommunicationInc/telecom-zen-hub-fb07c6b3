interface ResponsiveImageProps {
  src: string;
  alt: string;
  width: number;
  height: number;
  priority?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export default function ResponsiveImage({
  src, alt, width, height, priority = false, className, style
}: ResponsiveImageProps) {
  const webpSrc = src.replace(/\.(jpg|jpeg|png)$/i, '.webp');
  const isWebpAvailable = /\.(jpg|jpeg|png)$/i.test(src);

  return (
    <picture>
      {isWebpAvailable && (
        <source srcSet={webpSrc} type="image/webp" />
      )}
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        loading={priority ? 'eager' : 'lazy'}
        decoding={priority ? 'sync' : 'async'}
        fetchPriority={priority ? 'high' : 'auto'}
        className={className}
        style={{ maxWidth: '100%', height: 'auto', ...style }}
      />
    </picture>
  );
}
