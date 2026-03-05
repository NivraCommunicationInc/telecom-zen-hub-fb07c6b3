import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Cable, Plug, History, ArrowRight, CheckCircle2 } from "lucide-react";
import type { CablingAnswer, CablingQuestionnaire as CablingData } from "@/lib/installationLogic";

interface Props {
  isFrench: boolean;
  onComplete: (answers: CablingData) => void;
  initialValues?: CablingData;
}

const QUESTIONS = (isFrench: boolean) => [
  {
    key: "hasCoaxial" as const,
    icon: Cable,
    question: isFrench
      ? "Avez-vous une prise coaxiale (câble TV) dans votre logement ?"
      : "Do you have a coaxial (TV cable) outlet in your home?",
    options: [
      { value: "yes" as CablingAnswer, label: isFrench ? "Oui" : "Yes" },
      { value: "no" as CablingAnswer, label: isFrench ? "Non" : "No" },
      { value: "unknown" as CablingAnswer, label: isFrench ? "Je ne sais pas" : "I don't know" },
    ],
  },
  {
    key: "cableStatus" as const,
    icon: Plug,
    question: isFrench
      ? "Le câble coaxial est-il connecté ou coupé ?"
      : "Is the coaxial cable connected or cut?",
    options: [
      { value: "yes" as CablingAnswer, label: isFrench ? "Connecté" : "Connected" },
      { value: "no" as CablingAnswer, label: isFrench ? "Coupé" : "Cut" },
      { value: "unknown" as CablingAnswer, label: isFrench ? "Je ne sais pas" : "I don't know" },
    ],
  },
  {
    key: "previousService" as const,
    icon: History,
    question: isFrench
      ? "Un ancien service câble (Vidéotron, Fizz, etc.) a-t-il déjà fonctionné ici ?"
      : "Has a previous cable service (Vidéotron, Fizz, etc.) ever worked here?",
    options: [
      { value: "yes" as CablingAnswer, label: isFrench ? "Oui" : "Yes" },
      { value: "no" as CablingAnswer, label: isFrench ? "Non" : "No" },
      { value: "unknown" as CablingAnswer, label: isFrench ? "Je ne sais pas" : "I don't know" },
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
          {isFrench ? "Questionnaire de câblage" : "Cabling Assessment"}
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
                <p className="font-medium text-foreground pt-1.5">{q.question}</p>
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
