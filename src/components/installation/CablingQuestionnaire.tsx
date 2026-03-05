import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Cable, Plug, History, ArrowRight, CheckCircle2, Info } from "lucide-react";
import type { CablingAnswer, CablingQuestionnaire as CablingData } from "@/lib/installationLogic";
import coaxialImage from "@/assets/coaxial-outlet-example.png";

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
  showImage?: boolean;
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
      ? "Cette prise est généralement utilisée par des services Internet ou télévision par câble tels que :"
      : "This outlet is typically used by cable Internet or TV services such as:",
    providerExamples: ["Vidéotron", "Fizz", "Cogeco", "Rogers", "Shaw"],
    showImage: true,
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
      ? "Le câble est-il déjà branché ou présent dans la prise ?"
      : "Is the cable already plugged in or present in the outlet?",
    helpText: isFrench
      ? "Le câble coaxial est un câble rond qui se visse dans la prise murale et dans le modem."
      : "A coaxial cable is a round cable that screws into the wall outlet and the modem.",
    options: [
      { value: "yes", label: isFrench ? "Oui, le câble est présent" : "Yes, the cable is present" },
      { value: "no", label: isFrench ? "Non, il n'y a pas de câble" : "No, there is no cable" },
      { value: "unknown", label: isFrench ? "Je ne sais pas" : "I don't know" },
    ],
  },
  {
    key: "previousService",
    icon: History,
    question: isFrench
      ? "Un service Internet ou télévision par câble fonctionnait-il déjà dans ce logement ?"
      : "Has a cable Internet or TV service previously worked at this address?",
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

  const handleAnswer = (key: keyof CablingData, value: CablingAnswer) => {
    const updated = { ...answers, [key]: value };
    setAnswers(updated);

    // Auto-advance to next question after a short delay
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
          {isFrench ? "Évaluation de votre câblage" : "Cabling Assessment"}
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
                  
                  {/* Help text with provider examples */}
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
                  {q.showImage && (
                    <div className="mt-3 p-3 rounded-lg bg-muted/30 border border-border">
                      <p className="text-xs font-medium text-muted-foreground mb-2">
                        {isFrench ? "Exemple de prise câble :" : "Cable outlet example:"}
                      </p>
                      <div className="flex items-center gap-4">
                        <img
                          src={coaxialImage}
                          alt={isFrench ? "Exemple de prise coaxiale" : "Coaxial outlet example"}
                          className="w-20 h-20 rounded-lg object-cover border border-border"
                        />
                        <ul className="text-xs text-muted-foreground space-y-1">
                          <li>• {isFrench ? "Petite prise ronde" : "Small round outlet"}</li>
                          <li>• {isFrench ? "Filetage métallique" : "Metal threading"}</li>
                          <li>• {isFrench ? "Câble qui se visse" : "Cable that screws in"}</li>
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
