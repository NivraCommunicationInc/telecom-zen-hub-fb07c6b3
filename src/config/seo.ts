/**
 * SEO Configuration - Single source of truth for SEO settings
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 * GOOGLE SEARCH CONSOLE VERIFICATION
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * To verify your site with Google Search Console:
 * 
 * 1. Go to: https://search.google.com/search-console
 * 2. Click "Add property" → Select "URL prefix"
 * 3. Enter: https://nivratelecom.ca
 * 4. Choose "HTML tag" verification method
 * 5. Copy the content value from the meta tag Google provides:
 *    <meta name="google-site-verification" content="COPY_THIS_CODE" />
 * 6. Paste ONLY the code (not the full tag) below in googleSiteVerification
 * 7. Publish the site
 * 8. Click "Verify" in Google Search Console
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

export const SEO_CONFIG = {
  /**
   * Google Search Console verification code
   * Example: "abc123xyz456..." (just the code, not the full meta tag)
   * 
   * 🔴 REQUIRED: Add your verification code here to enable Google Search Console
   */
  googleSiteVerification: "",
  
  /**
   * Base URL for canonical URLs and sitemaps
   * Must match the production domain exactly
   */
  baseUrl: "https://nivratelecom.com",
  
  /**
   * Default Open Graph image (1200x630 recommended)
   * Used when no specific image is provided for a page
   */
  defaultOgImage: "/og-image.png",
  
  /**
   * Company/Site name for OG tags
   */
  siteName: "Nivra Telecom",
  
  /**
   * Default locale for the site
   */
  locale: "fr_CA",
  
  /**
   * Twitter handle (without @)
   */
  twitterHandle: "NivraQC",
} as const;

/**
 * Alternative verification methods (if meta tag doesn't work):
 * 
 * METHOD 2: HTML file verification
 * 1. Download the HTML file from Google Search Console
 *    (e.g., googleXXXXXXXXXXXX.html)
 * 2. Place the file in the public/ folder
 * 3. Publish the site
 * 4. Click "Verify" in Google Search Console
 * 
 * METHOD 3: DNS TXT record (for domain registrar)
 * 1. Choose DNS verification in Search Console
 * 2. Add the TXT record to your domain's DNS settings
 * 3. Wait for DNS propagation (up to 72 hours)
 * 4. Click "Verify" in Google Search Console
 */
