import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Smartphone, CheckCircle2, Wifi, Bell, Shield, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const Install = () => {
  const navigate = useNavigate();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if already installed
    const isStandaloneMode = window.matchMedia("(display-mode: standalone)").matches 
      || (window.navigator as any).standalone === true;
    setIsStandalone(isStandaloneMode);
    
    // Check if iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(isIOSDevice);

    // Listen for install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === "accepted") {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  const features = [
    {
      icon: Zap,
      title: "Accès rapide",
      description: "Ouvrez l'app directement depuis votre écran d'accueil"
    },
    {
      icon: Wifi,
      title: "Mode hors-ligne",
      description: "Consultez vos informations même sans connexion"
    },
    {
      icon: Bell,
      title: "Notifications",
      description: "Recevez des alertes pour vos factures et services"
    },
    {
      icon: Shield,
      title: "Sécurisé",
      description: "Connexion sécurisée à votre portail client"
    }
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-12 max-w-4xl">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 mb-6">
            <Smartphone className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-4">
            Installez l'App Nivra
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Accédez rapidement à votre portail client, gérez vos services et recevez des notifications directement sur votre téléphone.
          </p>
        </div>

        {isStandalone ? (
          <Card className="mb-8 border-green-500/50 bg-green-500/10">
            <CardContent className="flex items-center gap-4 pt-6">
              <CheckCircle2 className="w-8 h-8 text-green-500 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-green-700 dark:text-green-400">
                  App déjà installée !
                </h3>
                <p className="text-sm text-muted-foreground">
                  Vous utilisez actuellement l'application Nivra Telecom.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : isInstalled ? (
          <Card className="mb-8 border-green-500/50 bg-green-500/10">
            <CardContent className="flex items-center gap-4 pt-6">
              <CheckCircle2 className="w-8 h-8 text-green-500 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-green-700 dark:text-green-400">
                  Installation réussie !
                </h3>
                <p className="text-sm text-muted-foreground">
                  L'app Nivra est maintenant sur votre écran d'accueil.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="w-5 h-5" />
                Installer l'application
              </CardTitle>
              <CardDescription>
                {isIOS 
                  ? "Suivez les étapes ci-dessous pour installer l'app sur votre iPhone/iPad"
                  : "Cliquez sur le bouton pour ajouter l'app à votre écran d'accueil"
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isIOS ? (
                <div className="space-y-4">
                  <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50">
                    <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">1</span>
                    <div>
                      <p className="font-medium">Appuyez sur le bouton Partager</p>
                      <p className="text-sm text-muted-foreground">En bas de Safari (icône carré avec flèche vers le haut)</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50">
                    <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">2</span>
                    <div>
                      <p className="font-medium">Faites défiler et appuyez sur "Sur l'écran d'accueil"</p>
                      <p className="text-sm text-muted-foreground">Ou "Add to Home Screen" en anglais</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50">
                    <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">3</span>
                    <div>
                      <p className="font-medium">Appuyez sur "Ajouter"</p>
                      <p className="text-sm text-muted-foreground">L'app Nivra apparaîtra sur votre écran d'accueil</p>
                    </div>
                  </div>
                </div>
              ) : deferredPrompt ? (
                <Button size="lg" onClick={handleInstallClick} className="w-full">
                  <Download className="w-5 h-5 mr-2" />
                  Installer Nivra Telecom
                </Button>
              ) : (
                <div className="text-center py-4">
                  <p className="text-muted-foreground mb-4">
                    L'installation est disponible via le menu de votre navigateur.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Cherchez l'option "Installer" ou "Ajouter à l'écran d'accueil" dans le menu (⋮ ou ⋯).
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {features.map((feature, index) => (
            <Card key={index} className="border-border/50">
              <CardContent className="flex items-start gap-4 pt-6">
                <div className="p-2 rounded-lg bg-primary/10">
                  <feature.icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="text-center">
          <Button variant="outline" onClick={() => navigate("/")}>
            Retour à l'accueil
          </Button>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Install;
