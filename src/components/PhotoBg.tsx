interface PhotoBgProps {
  url: string;
  opacity?: number;
  filter?: string;
  position?: string;
}

export function PhotoBg({
  url,
  opacity = 0.12,
  filter = "saturate(0.5) brightness(0.65)",
  position = "center",
}: PhotoBgProps) {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        backgroundImage: `url('${url}')`,
        backgroundSize: "cover",
        backgroundPosition: position,
        opacity,
        filter,
        zIndex: 0,
        pointerEvents: "none",
      }}
    />
  );
}
