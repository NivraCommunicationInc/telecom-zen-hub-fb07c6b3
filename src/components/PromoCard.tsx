import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { SiteOffer } from "@/hooks/useSiteOffers";
import { Check, Sparkles, Tag, Wifi, Tv, Smartphone, Shield, Zap } from "lucide-react";
import { Link } from "react-router-dom";

interface PromoCardProps {
  offer: SiteOffer;
}

const categoryIcons: Record<string, React.ReactNode> = {
  internet: <Wifi className="w-5 h-5" />,
  tv: <Tv className="w-5 h-5" />,
  mobile: <Smartphone className="w-5 h-5" />,
  security: <Shield className="w-5 h-5" />,
};

export function PromoCard({ offer }: PromoCardProps) {
  const { language } = useLanguage();
  
  const name = language === "en" && offer.name_en ? offer.name_en : offer.name_fr;
  const description = language === "en" && offer.description_en ? offer.description_en : offer.description_fr;
  
  const hasDiscount = offer.discount_percent || offer.discount_amount;
  
  // Extract features from features_json
  const featuresData = offer.features_json as { 
    badge?: string; 
    features?: string[]; 
    speed?: string;
  } | null;
  
  const features = featuresData?.features || [];
  const speedBadge = featuresData?.speed;
  const customBadge = featuresData?.badge;
  
  const categoryIcon = categoryIcons[offer.category] || <Zap className="w-5 h-5" />;
  
  return (
    <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-card group">
      {/* Category header with gradient */}
      <div className="h-2 bg-gradient-to-r from-primary via-accent to-primary" />
      
      <CardHeader className="pb-3 pt-5">
        {/* Badges row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              {categoryIcon}
            </div>
            {speedBadge && (
              <Badge variant="secondary" className="font-semibold">
                {speedBadge}
              </Badge>
            )}
          </div>
          
          <div className="flex gap-1.5">
            {offer.is_featured && (
              <Badge className="bg-accent text-accent-foreground font-medium">
                <Sparkles className="w-3 h-3 mr-1" />
                Vedette
              </Badge>
            )}
            {customBadge && !offer.is_featured && (
              <Badge variant="outline" className="font-medium">
                {customBadge}
              </Badge>
            )}
          </div>
        </div>
        
        {/* Title */}
        <h3 className="text-xl font-bold text-foreground leading-tight">
          {name}
        </h3>
        
        {/* Promo code */}
        {offer.promo_code && (
          <Badge variant="outline" className="w-fit mt-2 text-xs border-dashed">
            <Tag className="w-3 h-3 mr-1" />
            Code: {offer.promo_code}
          </Badge>
        )}
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Description */}
        {description && (
          <p className="text-sm text-muted-foreground leading-relaxed">
            {description}
          </p>
        )}
        
        {/* Features list */}
        {features.length > 0 && (
          <div className="space-y-2 py-3 border-y border-border/50">
            {features.slice(0, 5).map((feature, index) => (
              <div key={index} className="flex items-start gap-2 text-sm">
                <Check className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                <span className="text-foreground/80">{feature}</span>
              </div>
            ))}
            {features.length > 5 && (
              <p className="text-xs text-muted-foreground pl-6">
                + {features.length - 5} autres avantages
              </p>
            )}
          </div>
        )}
        
        {/* Price section */}
        <div className="flex items-end justify-between pt-2">
          <div className="flex items-baseline gap-1">
            {offer.price_monthly !== null && (
              <>
                <span className="text-3xl font-bold text-primary">
                  {offer.price_monthly.toFixed(2)}$
                </span>
                <span className="text-sm text-muted-foreground">/mois</span>
              </>
            )}
          </div>
          
          {hasDiscount && (
            <Badge variant="destructive" className="font-semibold">
              {offer.discount_percent 
                ? `-${offer.discount_percent}%` 
                : `-${offer.discount_amount?.toFixed(2)}$`
              }
            </Badge>
          )}
        </div>
        
        {/* Valid until */}
        {offer.valid_until && (
          <p className="text-xs text-muted-foreground">
            Offre valide jusqu'au {new Date(offer.valid_until).toLocaleDateString("fr-CA")}
          </p>
        )}
        
        {/* CTA Button */}
        <Button asChild className="w-full mt-2 group-hover:bg-primary/90" size="lg">
          <Link to={`/${offer.category}`}>
            Voir les détails
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
