import { Link } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  HelpCircle,
  FileText,
  Download,
  Wifi,
  Tv,
  RotateCcw,
  Mail,
  MessageSquare,
  Clock,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import SEOHead from "@/components/SEOHead";

const STORAGE_BASE =
  "https://xtgngmtxggascbxnswvb.supabase.co/storage/v1/object/public/installation-guides";

const SUPPORT_EMAIL = "support@nivra-telecom.ca";

const Support = () => {
  const { language } = useLanguage();
  const isFr = language === "fr";

  const guides = [
    {
      title: isFr ? "Borne Nivra WiFi" : "Nivra WiFi Modem",
      lang: "FR",
      file: "guide-borne-nivra-wifi-fr.pdf",
      icon: Wifi,
    },
    {
      title: isFr ? "Borne Nivra WiFi" : "Nivra WiFi Modem",
      lang: "EN",
      file: "guide-borne-nivra-wifi-en.pdf",
      icon: Wifi,
    },
    {
      title: isFr ? "Terminal Nivra TV" : "Nivra TV Terminal",
      lang: "FR",
      file: "guide-terminal-nivra-tv-fr.pdf",
      icon: Tv,
    },
    {
      title: isFr ? "Terminal Nivra TV" : "Nivra TV Terminal",
      lang: "EN",
      file: "guide-terminal-nivra-tv-en.pdf",
      icon: Tv,
    },
  ];

  const troubleshooting = [
    {
      title: isFr ? "Voyant orange ou clignotant" : "Orange or blinking light",
      body: isFr
        ? "La borne est en cours de démarrage. Attendez jusqu'à 20 minutes. Ne débranchez pas."
        : "The modem is starting up. Wait up to 20 minutes. Do not unplug.",
    },
    {
      title: isFr ? "Pas de connexion Internet" : "No Internet connection",
      body: isFr
        ? "1. Débranchez la borne 30 secondes\n2. Rebranchez et attendez 3 minutes\n3. Si le problème persiste, contactez-nous"
        : "1. Unplug the modem for 30 seconds\n2. Plug back in and wait 3 minutes\n3. If issue persists, contact us",
    },
    {
      title: isFr ? "WiFi lent ou instable" : "Slow or unstable WiFi",
      body: isFr
        ? "Rapprochez vos appareils de la borne. Évitez les obstacles (murs épais, électroménagers). Redémarrez la borne."
        : "Move devices closer to the modem. Avoid obstacles (thick walls, appliances). Restart the modem.",
    },
    {
      title: isFr ? "Terminal TV — écran noir" : "TV Terminal — black screen",
      body: isFr
        ? "Vérifiez que vous êtes sur la bonne entrée HDMI. Débranchez le terminal 30 secondes et rebranchez."
        : "Check that you selected the correct HDMI input. Unplug the terminal for 30 seconds and plug back in.",
    },
    {
      title: isFr
        ? "Terminal TV — ne se connecte pas au WiFi"
        : "TV Terminal — won't connect to WiFi",
      body: isFr
        ? "Vérifiez votre mot de passe WiFi (majuscules et minuscules). Essayez la connexion WPS — appuyez sur le bouton WPS sous la borne ET sous le terminal en même temps."
        : "Check your WiFi password (upper and lower case matter). Try WPS — press the WPS button under the modem AND under the terminal at the same time.",
    },
  ];

  const faq = [
    {
      q: isFr ? "Est-ce qu'il y a un contrat à signer?" : "Is there a contract to sign?",
      a: isFr
        ? "Non. Aucun contrat. Résiliez à tout moment sans frais."
        : "No. No contract. Cancel anytime at no charge.",
    },
    {
      q: isFr
        ? "Comment demander l'activation de mon service?"
        : "How do I request service activation?",
      a: isFr
        ? "Connectez-vous à votre portail client, cliquez sur « Activation WiFi » et remplissez le formulaire. Notre équipe active votre service en 10 à 30 minutes."
        : "Log in to your client portal, click \"WiFi Activation\" and fill out the form. Our team activates your service within 10 to 30 minutes.",
    },
    {
      q: isFr ? "Combien de temps prend l'activation?" : "How long does activation take?",
      a: isFr
        ? "Entre 10 et 30 minutes une fois votre demande soumise. Vous recevrez un courriel de confirmation."
        : "Between 10 and 30 minutes once your request is submitted. You will receive a confirmation email.",
    },
    {
      q: isFr
        ? "Est-ce que je peux garder mon équipement si j'annule?"
        : "Can I keep my equipment if I cancel?",
      a: isFr
        ? "Oui. L'équipement vous appartient après paiement. Vous n'avez pas à le retourner."
        : "Yes. The equipment belongs to you after purchase. You do not need to return it.",
    },
    {
      q: isFr ? "Comment payer ma facture?" : "How do I pay my bill?",
      a: isFr
        ? "Connectez-vous à votre espace client nivra-telecom.ca/portail et cliquez sur « Payer maintenant »."
        : "Log in to your client portal at nivra-telecom.ca/portail and click \"Pay Now\".",
    },
    {
      q: isFr
        ? "Que faire si mon voyant reste orange après 20 minutes?"
        : "What if my light stays orange after 20 minutes?",
      a: isFr
        ? "Vérifiez que le câble coaxial est bien vissé à la borne ET à la prise murale. Essayez une autre prise coaxiale si disponible. Contactez-nous si le problème persiste."
        : "Check that the coaxial cable is firmly screwed to the modem AND to the wall outlet. Try another coaxial outlet if available. Contact us if the issue persists.",
    },
    {
      q: isFr ? "Est-ce que la vérification de crédit est requise?" : "Is a credit check required?",
      a: isFr
        ? "Non. Aucune vérification de crédit. Tout le monde est accepté."
        : "No. No credit check. Everyone is accepted.",
    },
    {
      q: isFr ? "Comment réinitialiser mon équipement?" : "How do I reset my equipment?",
      a: isFr
        ? "Consultez la section « Réinitialisation complète » sur cette page ou téléchargez le guide PDF."
        : "See the \"Full Reset\" section on this page or download the PDF guide.",
    },
  ];

  const openChat = () => {
    window.dispatchEvent(new CustomEvent("nivra:open-chat"));
  };

  const remoteSteps = isFr
    ? [
        "Appuyez sur EXIT pour effacer tout message d'erreur",
        "Maintenez A + D simultanément pendant 5 secondes jusqu'au voyant vert",
        "Appuyez sur 9, 8, 1 rapidement — le voyant clignote 3 fois = succès",
      ]
    : [
        "Press EXIT to clear any error message",
        "Hold A + D simultaneously for 5 seconds until light turns green",
        "Press 9, 8, 1 quickly — light blinks 3 times = success",
      ];

  const terminalSteps = isFr
    ? [
        "Maintenez PWR 5 secondes",
        "Appuyez sur le bouton central de navigation",
        "Appuyez sur la flèche droite ▶",
        "Appuyez sur la flèche bas ▼",
        "Appuyez sur PWR pour redémarrer",
      ]
    : [
        "Hold PWR for 5 seconds",
        "Press the center navigation button",
        "Press the right arrow ▶",
        "Press the down arrow ▼",
        "Press PWR to restart",
      ];

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={isFr ? "Support — Nivra Télécom" : "Support — Nivra Telecom"}
        description={
          isFr
            ? "Centre de support Nivra : guides d'installation PDF, dépannage rapide, FAQ et contact."
            : "Nivra support center: PDF installation guides, quick troubleshooting, FAQ and contact."
        }
      />
      <Header />

      {/* Hero */}
      <section className="pt-28 pb-16 bg-primary relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 -right-20 w-80 h-80 bg-accent/10 rounded-full blur-3xl" />
        </div>
        <div className="container mx-auto px-4 text-center relative">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/15 border border-accent/25 mb-5">
            <HelpCircle className="w-4 h-4 text-accent" />
            <span className="text-sm font-medium text-accent">Support</span>
          </div>
          <h1 className="text-white mb-4">
            {isFr ? (
              <>Besoin d'aide? <span className="text-accent">On est là pour vous.</span></>
            ) : (
              <>Need help? <span className="text-accent">We're here for you.</span></>
            )}
          </h1>
          <p className="text-lg text-white/70 max-w-2xl mx-auto">
            {isFr
              ? "Support 7 jours sur 7 • 8h à 20h • "
              : "Support 7 days a week • 8AM to 8PM • "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-accent hover:underline">
              {SUPPORT_EMAIL}
            </a>
          </p>
        </div>
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
            <path d="M0 60L60 52C120 44 240 28 360 24C480 20 600 28 720 32C840 36 960 36 1080 32C1200 28 1320 20 1380 16L1440 12V60H0Z" fill="hsl(var(--background))" />
          </svg>
        </div>
      </section>

      {/* Section 1 — Guides PDF */}
      <section className="py-16">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center mb-10">
            <h2 className="mb-3">{isFr ? "Guides d'installation" : "Installation Guides"}</h2>
            <p className="text-muted-foreground">
              {isFr
                ? "Téléchargez le guide PDF correspondant à votre équipement."
                : "Download the PDF guide for your equipment."}
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {guides.map((g) => {
              const Icon = g.icon;
              return (
                <Card key={g.file} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-5 flex flex-col h-full">
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                        <Icon className="w-6 h-6 text-accent" />
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {g.lang}
                      </Badge>
                    </div>
                    <h3 className="font-semibold text-foreground mb-1">{g.title}</h3>
                    <p className="text-xs text-muted-foreground mb-4 flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      PDF
                    </p>
                    <a
                      href={`${STORAGE_BASE}/${g.file}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      download
                      className="mt-auto"
                    >
                      <Button variant="outline" size="sm" className="w-full">
                        <Download className="w-4 h-4" />
                        {isFr ? "Télécharger" : "Download"}
                      </Button>
                    </a>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Section 2 — Activation */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="text-center mb-8">
            <h2 className="mb-3">
              {isFr ? "Comment activer votre service?" : "How to activate your service?"}
            </h2>
          </div>

          <Card>
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-5">
                <CheckCircle2 className="w-8 h-8 text-accent" />
              </div>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                {isFr
                  ? "Votre équipement est branché et le voyant est blanc fixe? Connectez-vous à votre espace client pour soumettre votre demande d'activation. Notre équipe active votre service en 10 à 30 minutes."
                  : "Equipment plugged in and solid white light? Log in to your client portal to submit your activation request. Our team activates your service within 10 to 30 minutes."}
              </p>
              <Link to="/portail/activation">
                <Button variant="hero" size="lg">
                  {isFr ? "Demander l'activation" : "Request activation"}
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Section 3 — Troubleshooting */}
      <section className="py-16">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="text-center mb-8">
            <h2 className="mb-3">{isFr ? "Dépannage rapide" : "Quick Troubleshooting"}</h2>
          </div>

          <Accordion type="single" collapsible className="space-y-3">
            {troubleshooting.map((item, idx) => (
              <AccordionItem
                key={idx}
                value={`tr-${idx}`}
                className="bg-card border border-border rounded-xl px-6"
              >
                <AccordionTrigger className="text-left font-medium text-foreground hover:text-accent py-4">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-accent flex-shrink-0" />
                    <span>{item.title}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-4 pl-8 whitespace-pre-line">
                  {item.body}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* Section 4 — Full Reset */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 mb-4">
              <RotateCcw className="w-4 h-4 text-accent" />
              <span className="text-xs font-semibold text-accent uppercase tracking-wider">
                {isFr ? "Équipement reconditionné" : "Refurbished equipment"}
              </span>
            </div>
            <h2 className="mb-3">
              {isFr
                ? "Réinitialisation complète"
                : "Full Reset"}
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              {isFr
                ? "La majorité des équipements Nivra sont reconditionnés. Si votre terminal TV ne fonctionne pas correctement, un reset complet est nécessaire. Suivez ces étapes dans l'ordre."
                : "Most Nivra equipment is refurbished. If your TV terminal is not working correctly, a full reset is required. Follow these steps in order."}
            </p>
          </div>

          <div className="space-y-5">
            {/* Step A */}
            <Card className="border-accent/30">
              <CardContent className="p-6">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-10 h-10 rounded-full bg-accent text-accent-foreground flex items-center justify-center font-bold shrink-0">
                    1
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">
                      {isFr
                        ? "Reset de la télécommande"
                        : "Reset the remote control"}
                    </h3>
                    <Badge variant="destructive" className="text-[10px]">
                      {isFr ? "OBLIGATOIRE EN PREMIER" : "MUST DO FIRST"}
                    </Badge>
                  </div>
                </div>
                <ol className="space-y-2 text-sm text-muted-foreground pl-14 list-decimal">
                  {remoteSteps.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
                <div className="mt-4 ml-14 p-3 rounded-lg bg-destructive/5 border border-destructive/20 text-xs text-foreground">
                  ⚠️{" "}
                  {isFr
                    ? "Pas plus d'une seconde entre chaque étape. Lisez toutes les étapes avant de commencer."
                    : "No more than one second between each step. Read all steps before starting."}
                </div>
              </CardContent>
            </Card>

            {/* Step B */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold shrink-0">
                    2
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">
                      {isFr ? "Reset du terminal" : "Reset the terminal"}
                    </h3>
                    <span className="text-xs text-muted-foreground">
                      {isFr
                        ? "APRÈS la télécommande seulement"
                        : "AFTER the remote only"}
                    </span>
                  </div>
                </div>
                <ol className="space-y-2 text-sm text-muted-foreground pl-14 list-decimal">
                  {terminalSteps.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
                <div className="mt-4 ml-14 p-3 rounded-lg bg-accent/5 border border-accent/20 text-xs text-foreground flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-accent shrink-0" />
                  {isFr
                    ? "Succès — Vous verrez l'écran de bienvenue après quelques minutes."
                    : "Success — You will see the welcome screen after a few minutes."}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Section 5 — FAQ */}
      <section className="py-16">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="text-center mb-8">
            <h2 className="mb-3">
              {isFr ? "Questions fréquentes" : "Frequently Asked Questions"}
            </h2>
          </div>

          <Accordion type="single" collapsible className="space-y-3">
            {faq.map((item, idx) => (
              <AccordionItem
                key={idx}
                value={`faq-${idx}`}
                className="bg-card border border-border rounded-xl px-6"
              >
                <AccordionTrigger className="text-left font-medium text-foreground hover:text-accent py-4">
                  <div className="flex items-center gap-3">
                    <HelpCircle className="w-5 h-5 text-accent flex-shrink-0" />
                    <span>{item.q}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-4 pl-8">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* Section 6 — Contact */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center mb-10">
            <h2 className="mb-3">{isFr ? "Nous contacter" : "Contact Us"}</h2>
            <p className="text-muted-foreground">
              {isFr
                ? "Réponse en moins de 24 heures • 7 jours sur 7 • 8h à 20h"
                : "Response within 24 hours • 7 days a week • 8AM to 8PM"}
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <Card>
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
                  <Mail className="w-6 h-6 text-accent" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">
                  {isFr ? "Courriel" : "Email"}
                </h3>
                <p className="text-sm text-muted-foreground mb-4 break-all">
                  {SUPPORT_EMAIL}
                </p>
                <a href={`mailto:${SUPPORT_EMAIL}`}>
                  <Button variant="outline" size="sm">
                    {isFr ? "Envoyer un courriel" : "Send email"}
                  </Button>
                </a>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
                  <MessageSquare className="w-6 h-6 text-accent" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">
                  {isFr ? "Clavardage" : "Chat"}
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {isFr ? "Réponse instantanée 24/7" : "Instant response 24/7"}
                </p>
                <Button variant="hero" size="sm" onClick={openChat}>
                  {isFr ? "Clavarder maintenant" : "Chat now"}
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="text-center text-sm text-muted-foreground bg-card border border-border rounded-xl px-4 py-3 inline-flex items-center gap-2 mx-auto">
            <Clock className="w-4 h-4" />
            {isFr
              ? "Nous répondons uniquement par courriel. Pas de ligne téléphonique."
              : "We respond by email only. No phone line."}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Support;
