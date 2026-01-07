import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { SiteOffer } from "@/hooks/useSiteOffers";
import { Sparkles, Tag } from "lucide-react";
import { Link } from "react-router-dom";

interface PromoCardProps {
  offer: SiteOffer;
}

export function PromoCard({ offer }: PromoCardProps) {
  const { language } = useLanguage();
  
  const name = language === "en" && offer.name_en ? offer.name_en : offer.name_fr;
  const description = language === "en" && offer.description_en ? offer.description_en : offer.description_fr;
  
  const hasDiscount = offer.discount_percent || offer.discount_amount;
  
  return (
    <Card className="relative overflow-hidden border-accent/20 bg-gradient-to-br from-background to-accent/5">
      {offer.is_featured && (
        <div className="absolute top-0 right-0">
          <Badge className="rounded-none rounded-bl-lg bg-accent text-accent-foreground">
            <Sparkles className="w-3 h-3 mr-1" />
            Vedette
          </Badge>
        </div>
      )}
      
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          {name}
          {offer.promo_code && (
            <Badge variant="outline" className="text-xs">
              <Tag className="w-3 h-3 mr-1" />
              {offer.promo_code}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
        
        <div className="flex items-baseline gap-2">
          {offer.price_monthly !== null && (
            <>
              <span className="text-2xl font-bold text-primary">
                {offer.price_monthly.toFixed(2)}$
              </span>
              <span className="text-sm text-muted-foreground">/mois</span>
            </>
          )}
          
          {hasDiscount && (
            <Badge variant="secondary" className="ml-auto">
              {offer.discount_percent 
                ? `-${offer.discount_percent}%` 
                : `-${offer.discount_amount?.toFixed(2)}$`
              }
            </Badge>
          )}
        </div>
        
        {offer.valid_until && (
          <p className="text-xs text-muted-foreground">
            Valide jusqu'au {new Date(offer.valid_until).toLocaleDateString("fr-CA")}
          </p>
        )}
        
        <Button asChild className="w-full mt-2" size="sm">
          <Link to={`/${offer.category}`}>Voir les détails</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
