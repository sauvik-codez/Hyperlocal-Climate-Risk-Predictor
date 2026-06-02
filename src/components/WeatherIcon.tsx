import { getWeatherCodeInfo } from "@/lib/weatherCodes";

type Props = {
  code: number;
  className?: string;
  title?: string;
};

function IconBase({
  children,
  className,
  title,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      role="img"
      aria-label={title}
      className={className ?? "h-6 w-6"}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

function Sun({ className, title }: { className?: string; title?: string }) {
  return (
    <IconBase className={className} title={title}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="M4.93 4.93l1.41 1.41" />
      <path d="M17.66 17.66l1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="M4.93 19.07l1.41-1.41" />
      <path d="M17.66 6.34l1.41-1.41" />
    </IconBase>
  );
}

function Cloud({ className, title }: { className?: string; title?: string }) {
  return (
    <IconBase className={className} title={title}>
      <path d="M7 18h10a4 4 0 0 0 0-8 6 6 0 0 0-11.5 1.8A3.5 3.5 0 0 0 7 18Z" />
    </IconBase>
  );
}

function CloudRain({ className, title }: { className?: string; title?: string }) {
  return (
    <IconBase className={className} title={title}>
      <path d="M7 16h10a4 4 0 0 0 0-8 6 6 0 0 0-11.5 1.8A3.5 3.5 0 0 0 7 16Z" />
      <path d="M9 19l-1 2" />
      <path d="M13 19l-1 2" />
      <path d="M17 19l-1 2" />
    </IconBase>
  );
}

function CloudSnow({ className, title }: { className?: string; title?: string }) {
  return (
    <IconBase className={className} title={title}>
      <path d="M7 16h10a4 4 0 0 0 0-8 6 6 0 0 0-11.5 1.8A3.5 3.5 0 0 0 7 16Z" />
      <path d="M9 19h0" />
      <path d="M13 19h0" />
      <path d="M17 19h0" />
      <circle cx="9" cy="19" r="0.8" />
      <circle cx="13" cy="19" r="0.8" />
      <circle cx="17" cy="19" r="0.8" />
    </IconBase>
  );
}

function Fog({ className, title }: { className?: string; title?: string }) {
  return (
    <IconBase className={className} title={title}>
      <path d="M4 10h16" />
      <path d="M6 14h12" />
      <path d="M5 18h14" />
    </IconBase>
  );
}

function Thunder({ className, title }: { className?: string; title?: string }) {
  return (
    <IconBase className={className} title={title}>
      <path d="M7 15h9a4 4 0 0 0 0-8 6 6 0 0 0-11.5 1.8A3.5 3.5 0 0 0 7 15Z" />
      <path d="M12 15l-2 4h3l-2 4" />
    </IconBase>
  );
}

export function WeatherIcon({ code, className, title }: Props) {
  const info = getWeatherCodeInfo(code);
  const t = title ?? info.label;

  switch (info.category) {
    case "clear":
      return <Sun className={className} title={t} />;
    case "clouds":
      return <Cloud className={className} title={t} />;
    case "fog":
      return <Fog className={className} title={t} />;
    case "drizzle":
    case "rain":
      return <CloudRain className={className} title={t} />;
    case "snow":
      return <CloudSnow className={className} title={t} />;
    case "thunder":
      return <Thunder className={className} title={t} />;
    default:
      return <Cloud className={className} title={t} />;
  }
}

