import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, KeyRound, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

const FORBIDDEN_CODES = ["000000", "123456", "111111", "654321", "222222", "333333", "444444", "555555", "666666", "777777", "888888", "999999"];

const codeSchema = z.object({
  currentCode: z.string().length(6, "Le code doit contenir 6 chiffres").regex(/^\d{6}$/, "Chiffres uniquement"),
  newCode: z.string().length(6, "Le code doit contenir 6 chiffres").regex(/^\d{6}$/, "Chiffres uniquement"),
  confirmCode: z.string().length(6, "Le code doit contenir 6 chiffres").regex(/^\d{6}$/, "Chiffres uniquement"),
}).refine((data) => data.newCode === data.confirmCode, {
  message: "Les codes ne correspondent pas",
  path: ["confirmCode"],
}).refine((data) => !FORBIDDEN_CODES.includes(data.newCode) && !/^(\d)\1{5}$/.test(data.newCode), {
  message: "Ce code est trop faible. Choisissez un code plus sécuritaire.",
  path: ["newCode"],
});

type CodeFormData = z.infer<typeof codeSchema>;

export function AdminSecurityCodeSection() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const form = useForm<CodeFormData>({
    resolver: zodResolver(codeSchema),
    defaultValues: {
      currentCode: "",
      newCode: "",
      confirmCode: "",
    },
  });

  const onSubmit = async (data: CodeFormData) => {
    if (!user?.id) return;

    setIsSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/admin-secret-set`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": supabaseKey,
          "Authorization": `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          admin_user_id: user.id,
          current_code: data.currentCode,
          new_code: data.newCode,
        }),
      });

      const result = await response.json();

      if (result.ok) {
        setSuccess(true);
        form.reset();
        toast({
          title: "Succès",
          description: "Votre code secret a été mis à jour avec succès.",
        });
      } else {
        setError(result.error || "Erreur lors de la mise à jour du code");
      }
    } catch (err) {
      console.error("Error updating secret code:", err);
      setError("Erreur de connexion. Veuillez réessayer.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-5 w-5" />
          Code secret de connexion
        </CardTitle>
        <CardDescription>
          Ce code à 6 chiffres est requis à chaque connexion au portail administrateur.
          <br />
          <span className="text-xs text-muted-foreground">
            Si vous n'avez jamais défini de code, utilisez <strong>112233</strong> comme code actuel.
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="mb-4 border-green-500 bg-green-50 dark:bg-green-950/30">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-700 dark:text-green-400">
              Code secret mis à jour avec succès!
            </AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="currentCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Code actuel</FormLabel>
                  <FormControl>
                    <InputOTP
                      value={field.value}
                      onChange={field.onChange}
                      maxLength={6}
                    >
                      <InputOTPGroup>
                        <InputOTPSlot index={0} />
                        <InputOTPSlot index={1} />
                        <InputOTPSlot index={2} />
                        <InputOTPSlot index={3} />
                        <InputOTPSlot index={4} />
                        <InputOTPSlot index={5} />
                      </InputOTPGroup>
                    </InputOTP>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="newCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nouveau code</FormLabel>
                  <FormControl>
                    <InputOTP
                      value={field.value}
                      onChange={field.onChange}
                      maxLength={6}
                    >
                      <InputOTPGroup>
                        <InputOTPSlot index={0} />
                        <InputOTPSlot index={1} />
                        <InputOTPSlot index={2} />
                        <InputOTPSlot index={3} />
                        <InputOTPSlot index={4} />
                        <InputOTPSlot index={5} />
                      </InputOTPGroup>
                    </InputOTP>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="confirmCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirmer le nouveau code</FormLabel>
                  <FormControl>
                    <InputOTP
                      value={field.value}
                      onChange={field.onChange}
                      maxLength={6}
                    >
                      <InputOTPGroup>
                        <InputOTPSlot index={0} />
                        <InputOTPSlot index={1} />
                        <InputOTPSlot index={2} />
                        <InputOTPSlot index={3} />
                        <InputOTPSlot index={4} />
                        <InputOTPSlot index={5} />
                      </InputOTPGroup>
                    </InputOTP>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Mise à jour..." : "Mettre à jour le code"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

export default AdminSecurityCodeSection;
