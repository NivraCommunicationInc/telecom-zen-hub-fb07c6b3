import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Cable, Plug, History, ArrowRight, CheckCircle2, Info, AlertTriangle } from "lucide-react";
import type { CablingAnswer, CablingQuestionnaire as CablingData } from "@/lib/installationLogic";
import { isRiskyCoax } from "@/lib/installationLogic";
import coaxialImage from "@/assets/coaxial-outlet-example.png";
import cableConnectorImage from "@/assets/coaxial-cable-connector.jpg";

interface Props {
  isFrench: boolean;
  onComplete: (answers: CablingData) => void;
  initialValues?: CablingData;
}

interface QuestionDef {
  key: keyof CablingData;
  icon: typeof Cable;
  question: string;
  helpText?: string;
  showOutletImage?: boolean;
  showCableImage?: boolean;
  providerExamples?: string[];
  options: { value: CablingAnswer; label: string }[];
}

const QUESTIONS = (isFrench: boolean): QuestionDef[] => [
  {
    key: "hasCoaxial",
    icon: Cable,
    question: isFrench
      ? "Avez-vous une prise câble (prise TV ronde) dans votre logement ?"
      : "Do you have a cable outlet (round TV outlet) in your home?",
    helpText: isFrench
      ? "Ce type de prise est généralement utilisé par des services Internet ou télévision par câble tels que :"
      : "This type of outlet is typically used by cable Internet or TV services such as:",
    providerExamples: ["Vidéotron", "Fizz", "Cogeco", "Rogers", "Shaw"],
    showOutletImage: true,
    options: [
      { value: "yes", label: isFrench ? "Oui" : "Yes" },
      { value: "no", label: isFrench ? "Non" : "No" },
      { value: "unknown", label: isFrench ? "Je ne sais pas" : "I don't know" },
    ],
  },
  {
    key: "cableStatus",
    icon: Plug,
    question: isFrench
      ? "Voyez-vous un câble rond avec une vis métallique (connecteur) prêt à être branché ?"
      : "Do you see a round cable with a metal screw connector ready to plug in?",
    helpText: isFrench
      ? "Le câble coaxial est un câble noir rond avec un connecteur métallique qui se visse dans la prise murale et dans le modem."
      : "A coaxial cable is a round black cable with a metal connector that screws into the wall outlet and the modem.",
    showCableImage: true,
    options: [
      { value: "yes", label: isFrench ? "Oui, le câble est présent et intact" : "Yes, the cable is present and intact" },
      { value: "no", label: isFrench ? "Non, il est absent ou coupé" : "No, it is absent or cut" },
      { value: "unknown", label: isFrench ? "Je ne sais pas" : "I don't know" },
    ],
  },
  {
    key: "previousService",
    icon: History,
    question: isFrench
      ? "Un service Internet ou télévision par câble fonctionnait-il déjà ici dans les 24 derniers mois ?"
      : "Has a cable Internet or TV service worked at this address in the last 24 months?",
    helpText: isFrench
      ? "Par exemple avec :"
      : "For example with:",
    providerExamples: ["Vidéotron", "Fizz", "Cogeco", "Rogers"],
    options: [
      { value: "yes", label: isFrench ? "Oui" : "Yes" },
      { value: "no", label: isFrench ? "Non" : "No" },
      { value: "unknown", label: isFrench ? "Je ne sais pas" : "I don't know" },
    ],
  },
];

export function CablingQuestionnaire({ isFrench, onComplete, initialValues }: Props) {
  const [answers, setAnswers] = useState<Partial<CablingData>>(initialValues || {});
  const [currentQ, setCurrentQ] = useState(0);

  const questions = QUESTIONS(isFrench);
  const allAnswered = questions.every((q) => answers[q.key]);

  const fullAnswers = allAnswered ? (answers as CablingData) : null;
  const risky = fullAnswers ? isRiskyCoax(fullAnswers) : false;

  const handleAnswer = (key: keyof CablingData, value: CablingAnswer) => {
    const updated = { ...answers, [key]: value };
    setAnswers(updated);
    if (currentQ < questions.length - 1) {
      setTimeout(() => setCurrentQ(currentQ + 1), 300);
    }
  };

  const handleSubmit = () => {
    if (allAnswered) {
      onComplete(answers as CablingData);
    }
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cable className="w-5 h-5 text-primary" />
          {isFrench ? "Vérification de votre câblage" : "Cabling Quick-Check"}
        </CardTitle>
        <CardDescription>
          {isFrench
            ? "Répondez à ces 3 questions pour déterminer le type d'installation adapté à votre logement."
            : "Answer these 3 questions to determine the right installation type for your home."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Progress indicators */}
        <div className="flex items-center gap-2">
          {questions.map((q, i) => (
            <div key={q.key} className="flex items-center gap-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors cursor-pointer ${
                  answers[q.key]
                    ? "bg-primary text-primary-foreground"
                    : i === currentQ
                    ? "bg-primary/20 text-primary border-2 border-primary"
                    : "bg-muted text-muted-foreground"
                }`}
                onClick={() => setCurrentQ(i)}
              >
                {answers[q.key] ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
              </div>
              {i < questions.length - 1 && (
                <div className={`w-8 h-0.5 ${answers[q.key] ? "bg-primary" : "bg-muted"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Current question */}
        {questions.map((q, i) => {
          if (i !== currentQ) return null;
          const Icon = q.icon;
          return (
            <div key={q.key} className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">{q.question}</p>

                  {q.helpText && (
                    <div className="mt-2 p-3 rounded-lg bg-muted/50 border border-border">
                      <div className="flex items-start gap-2">
                        <Info className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-muted-foreground">
                          <p>{q.helpText}</p>
                          {q.providerExamples && (
                            <div className="flex flex-wrap gap-2 mt-1.5">
                              {q.providerExamples.map((provider) => (
                                <span
                                  key={provider}
                                  className="inline-block px-2 py-0.5 rounded-md bg-background border border-border text-xs font-medium text-foreground"
                                >
                                  {provider}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Coaxial outlet image for Q1 */}
                  {q.showOutletImage && (
                    <div className="mt-3 p-3 rounded-lg bg-muted/30 border border-border">
                      <p className="text-xs font-medium text-muted-foreground mb-2">
                        {isFrench ? "Exemple de prise câble :" : "Cable outlet example:"}
                      </p>
                      <div className="flex items-center gap-4">
                        <img
                          src={coaxialImage}
                          alt={isFrench ? "Exemple de prise coaxiale murale" : "Wall coaxial outlet example"}
                          className="w-20 h-20 rounded-lg object-cover border border-border"
                        />
                        <ul className="text-xs text-muted-foreground space-y-1">
                          <li>• {isFrench ? "Petite prise ronde sur le mur" : "Small round wall outlet"}</li>
                          <li>• {isFrench ? "Filetage métallique" : "Metal threading"}</li>
                          <li>• {isFrench ? "Souvent dans le salon ou près de la TV" : "Usually in the living room or near the TV"}</li>
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* Cable connector image for Q2 */}
                  {q.showCableImage && (
                    <div className="mt-3 p-3 rounded-lg bg-muted/30 border border-border">
                      <p className="text-xs font-medium text-muted-foreground mb-2">
                        {isFrench ? "Exemple de câble coaxial avec connecteur :" : "Coaxial cable with connector example:"}
                      </p>
                      <div className="flex items-center gap-4">
                        <img
                          src={cableConnectorImage}
                          alt={isFrench ? "Câble coaxial avec connecteur F à vis métallique" : "Coaxial cable with F-type metal screw connector"}
                          className="w-24 h-20 rounded-lg object-cover border border-border"
                        />
                        <ul className="text-xs text-muted-foreground space-y-1">
                          <li>• {isFrench ? "Câble noir rond" : "Round black cable"}</li>
                          <li>• {isFrench ? "Connecteur métallique avec vis" : "Metal connector with screw threading"}</li>
                          <li>• {isFrench ? "Se visse dans la prise murale et le modem" : "Screws into the wall outlet and modem"}</li>
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <RadioGroup
                value={answers[q.key] || ""}
                onValueChange={(v) => handleAnswer(q.key, v as CablingAnswer)}
                className="grid grid-cols-1 sm:grid-cols-3 gap-3"
              >
                {q.options.map((opt) => (
                  <div key={opt.value}>
                    <RadioGroupItem value={opt.value} id={`${q.key}-${opt.value}`} className="peer sr-only" />
                    <Label
                      htmlFor={`${q.key}-${opt.value}`}
                      className={`flex items-center justify-center p-4 rounded-lg border-2 cursor-pointer transition-all text-center font-medium ${
                        answers[q.key] === opt.value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:border-primary/50 hover:bg-accent"
                      }`}
                    >
                      {opt.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          );
        })}

        {/* RISKY_COAX warning */}
        {allAnswered && risky && (
          <div className="flex items-start gap-3 p-3 rounded-lg bg-accent/50 border border-accent animate-in fade-in duration-300">
            <AlertTriangle className="w-5 h-5 text-accent-foreground flex-shrink-0 mt-0.5" />
            <p className="text-sm text-accent-foreground">
              {isFrench
                ? "Une validation sur place peut être nécessaire. Un technicien vérifiera l'état du câblage à votre adresse."
                : "On-site validation may be required. A technician will verify the cabling condition at your address."}
            </p>
          </div>
        )}

        {/* Submit */}
        {allAnswered && (
          <div className="pt-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <Button onClick={handleSubmit} className="w-full gap-2">
              {isFrench ? "Voir les disponibilités" : "See availability"}
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
