/**
 * SEO Configuration - Single source of truth for SEO settings
 * Google Site Verification and other SEO-related settings
 */

export const SEO_CONFIG = {
  // Google Search Console verification code
  // Set this to your verification code from Google Search Console
  // Format: Just the code, not the full meta tag (e.g., "abc123xyz...")
  googleSiteVerification: "",
  
  // Base URL for canonical URLs and sitemaps
  baseUrl: "https://nivratelecom.ca",
  
  // Default OG image
  defaultOgImage: "/og-image.png",
  
  // Company name for OG tags
  siteName: "Nivra Telecom",
} as const;

/**
 * Instructions for Google Search Console verification:
 * 
 * METHOD 1: Meta tag verification (recommended)
 * 1. Go to Google Search Console: https://search.google.com/search-console
 * 2. Add property → URL prefix → Enter https://nivratelecom.ca
 * 3. Choose "HTML tag" verification method
 * 4. Copy the content value from: <meta name="google-site-verification" content="YOUR_CODE" />
 * 5. Paste the code (just "YOUR_CODE") in googleSiteVerification above
 * 6. Publish the site and verify in Search Console
 * 
 * METHOD 2: HTML file verification
 * 1. Go to Google Search Console
 * 2. Choose "HTML file" verification method  
 * 3. Download the HTML file (e.g., googleXXXXXXXXXXXX.html)
 * 4. Place the file in the public/ folder
 * 5. Publish the site and verify in Search Console
 * 
 * Note: The HTML file will be served correctly thanks to the _redirects configuration.
 */
