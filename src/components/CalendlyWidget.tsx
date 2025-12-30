import { useEffect } from "react";

declare global {
  interface Window {
    Calendly: any;
  }
}

interface CalendlyWidgetProps {
  url: string;
  prefillName?: string;
  prefillEmail?: string;
  className?: string;
  minHeight?: string;
}

const CalendlyWidget = ({ 
  url, 
  prefillName, 
  prefillEmail, 
  className = "",
  minHeight = "650px"
}: CalendlyWidgetProps) => {
  useEffect(() => {
    // Check if script already exists
    const existingScript = document.querySelector('script[src="https://assets.calendly.com/assets/external/widget.js"]');
    
    if (!existingScript) {
      const script = document.createElement("script");
      script.src = "https://assets.calendly.com/assets/external/widget.js";
      script.async = true;
      document.body.appendChild(script);
    }

    // Cleanup function - don't remove the script as other components might use it
    return () => {};
  }, []);

  // Build prefill parameters
  const prefillParams = new URLSearchParams();
  if (prefillName) prefillParams.set("name", prefillName);
  if (prefillEmail) prefillParams.set("email", prefillEmail);
  
  const fullUrl = prefillParams.toString() 
    ? `${url}?${prefillParams.toString()}`
    : url;

  return (
    <div
      className={`calendly-inline-widget ${className}`}
      data-url={fullUrl}
      style={{ minWidth: "320px", minHeight }}
    />
  );
};

export default CalendlyWidget;
