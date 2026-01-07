import { useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { backendClient as supabase } from "@/integrations/backend";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Briefcase, MapPin, Clock, Upload, CheckCircle, Loader2 } from "lucide-react";

const JobApplication = () => {
  const { jobId } = useParams();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    message: "",
    cvFile: null as File | null,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: job, isLoading } = useQuery({
    queryKey: ["job", jobId],
    queryFn: async () => {
      if (!jobId) return null;
      const { data, error } = await supabase
        .from("jobs")
        .select("*")
        .eq("id", jobId)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!jobId,
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const allowedTypes = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ];
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Format non supporté",
          description: "Veuillez téléverser un fichier PDF ou Word.",
          variant: "destructive",
        });
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "Fichier trop volumineux",
          description: "Le CV ne doit pas dépasser 5 Mo.",
          variant: "destructive",
        });
        return;
      }
      setFormData({ ...formData, cvFile: file });
      setErrors({ ...errors, cvFile: "" });
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.fullName.trim()) newErrors.fullName = "Le nom est requis";
    if (!formData.email.trim()) newErrors.email = "Le courriel est requis";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Courriel invalide";
    }
    if (!formData.phone.trim()) newErrors.phone = "Le téléphone est requis";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      let cvPath: string | null = null;
      let cvFilename: string | null = null;

      // Upload CV if provided
      if (formData.cvFile) {
        const fileExt = formData.cvFile.name.split(".").pop();
        const fileName = `applications/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("job-applications")
          .upload(fileName, formData.cvFile);

        if (uploadError) {
          console.error("CV upload error:", uploadError);
          // Continue without CV if upload fails
        } else {
          cvPath = fileName;
          cvFilename = formData.cvFile.name;
        }
      }

      // Insert application
      const { error } = await supabase.from("job_applications").insert({
        job_id: jobId || null,
        position: job?.title || "Candidature spontanée",
        full_name: formData.fullName.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        message: formData.message.trim() || null,
        cv_path: cvPath,
        cv_filename: cvFilename,
        status: "new",
      });

      if (error) {
        console.error("Application submit error:", error);
        throw error;
      }

      setIsSubmitted(true);
      toast({
        title: "Candidature envoyée!",
        description: "Nous examinerons votre candidature et vous contacterons bientôt.",
      });
    } catch (error) {
      console.error("Error submitting application:", error);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue. Veuillez réessayer.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="pt-32 pb-20">
          <div className="container mx-auto px-4 max-w-2xl text-center">
            <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-emerald-500" />
            </div>
            <h1 className="font-display text-3xl font-bold text-foreground mb-4">
              Candidature envoyée!
            </h1>
            <p className="text-muted-foreground mb-8">
              Merci pour votre intérêt. Notre équipe examinera votre candidature et vous contactera dans les plus brefs délais.
            </p>
            <Button variant="hero" asChild>
              <Link to="/careers">Voir d'autres postes</Link>
            </Button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const positionTitle = job?.title || "Candidature spontanée";

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="pt-32 pb-20">
        <div className="container mx-auto px-4 max-w-2xl">
          <Button variant="ghost" className="mb-6" asChild>
            <Link to="/careers">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour aux postes
            </Link>
          </Button>

          {isLoading && jobId ? (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Job Info (if specific job) */}
              {job && (
                <Card className="bg-card border-border mb-8">
                  <CardHeader>
                    <CardTitle className="font-display text-2xl">{job.title}</CardTitle>
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mt-2">
                      <span className="flex items-center gap-1">
                        <Briefcase className="w-4 h-4" />
                        {job.department}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {job.location}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {job.type}
                      </span>
                    </div>
                  </CardHeader>
                  {job.description && (
                    <CardContent>
                      <p className="text-muted-foreground">{job.description}</p>
                    </CardContent>
                  )}
                </Card>
              )}

              {/* Application Form */}
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle>
                    {job ? "Formulaire de candidature" : "Candidature spontanée"}
                  </CardTitle>
                  {!job && (
                    <p className="text-sm text-muted-foreground">
                      Envoyez-nous votre CV et nous vous contacterons si une opportunité correspondant à votre profil se présente.
                    </p>
                  )}
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Position (read-only) */}
                    <div>
                      <Label>Poste</Label>
                      <Input value={positionTitle} disabled className="bg-muted" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="fullName">Nom complet *</Label>
                        <Input
                          id="fullName"
                          value={formData.fullName}
                          onChange={(e) => {
                            setFormData({ ...formData, fullName: e.target.value });
                            if (errors.fullName) setErrors({ ...errors, fullName: "" });
                          }}
                          placeholder="Jean Tremblay"
                        />
                        {errors.fullName && (
                          <p className="text-sm text-destructive mt-1">{errors.fullName}</p>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="email">Courriel *</Label>
                        <Input
                          id="email"
                          type="email"
                          value={formData.email}
                          onChange={(e) => {
                            setFormData({ ...formData, email: e.target.value });
                            if (errors.email) setErrors({ ...errors, email: "" });
                          }}
                          placeholder="jean@exemple.com"
                        />
                        {errors.email && (
                          <p className="text-sm text-destructive mt-1">{errors.email}</p>
                        )}
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="phone">Téléphone *</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => {
                          setFormData({ ...formData, phone: e.target.value });
                          if (errors.phone) setErrors({ ...errors, phone: "" });
                        }}
                        placeholder="514-555-0123"
                      />
                      {errors.phone && (
                        <p className="text-sm text-destructive mt-1">{errors.phone}</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="cv">CV (PDF ou Word, max 5 Mo)</Label>
                      <div className="mt-1">
                        <label
                          htmlFor="cv"
                          className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-cyan-400/50 transition-colors"
                        >
                          <Upload className="w-5 h-5 text-muted-foreground" />
                          <span className="text-muted-foreground">
                            {formData.cvFile ? formData.cvFile.name : "Cliquez pour téléverser votre CV"}
                          </span>
                          <input
                            id="cv"
                            type="file"
                            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                            onChange={handleFileChange}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="message">Message / Lettre de motivation</Label>
                      <Textarea
                        id="message"
                        value={formData.message}
                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                        placeholder="Présentez-vous et expliquez pourquoi vous êtes intéressé par ce poste..."
                        rows={6}
                      />
                    </div>

                    <Button
                      type="submit"
                      variant="hero"
                      className="w-full"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Envoi en cours...
                        </>
                      ) : (
                        "Envoyer ma candidature"
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default JobApplication;