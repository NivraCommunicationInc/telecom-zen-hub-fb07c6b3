import { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, Check, Clock, AlertCircle, Loader2, X, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Progress } from "@/components/ui/progress";

interface DocumentRequest {
  id: string;
  user_id: string;
  ticket_id: string | null;
  request_token: string;
  required_documents: string[];
  request_reason: string | null;
  deadline: string | null;
  status: string;
  created_at: string;
  completed_at: string | null;
}

interface UploadedFile {
  name: string;
  url: string;
  uploaded_at: string;
}

const ClientDocumentUpload = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const token = searchParams.get("token");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [request, setRequest] = useState<DocumentRequest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    if (!token) {
      setError("Lien invalide. Aucun jeton de demande trouvé.");
      setLoading(false);
      return;
    }

    loadRequest();
  }, [token]);

  const loadRequest = async () => {
    try {
      // First check if user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        // Redirect to login with return URL
        navigate(`/portal/auth?redirect=/portal/upload?token=${token}`);
        return;
      }

      // Fetch the document request by token
      const { data, error: fetchError } = await supabase
        .from("document_requests")
        .select("*")
        .eq("request_token", token)
        .single();

      if (fetchError || !data) {
        setError("Cette demande de documents n'existe pas ou a expiré.");
        setLoading(false);
        return;
      }

      // Verify user owns this request
      if (data.user_id !== user.id) {
        setError("Vous n'avez pas accès à cette demande de documents.");
        setLoading(false);
        return;
      }

      // Check if expired
      if (data.deadline && new Date(data.deadline) < new Date()) {
        setError("Cette demande de documents a expiré.");
        setLoading(false);
        return;
      }

      setRequest(data as DocumentRequest);
      
      // Load existing uploaded files
      await loadUploadedFiles(user.id, data.id);
    } catch (err) {
      console.error("Error loading request:", err);
      setError("Une erreur est survenue lors du chargement de la demande.");
    } finally {
      setLoading(false);
    }
  };

  const loadUploadedFiles = async (userId: string, requestId: string) => {
    try {
      const { data: files } = await supabase.storage
        .from("client-documents")
        .list(`${userId}/${requestId}`);

      if (files && files.length > 0) {
        const uploadedList = files.map(f => ({
          name: f.name,
          url: `${userId}/${requestId}/${f.name}`,
          uploaded_at: f.created_at || new Date().toISOString()
        }));
        setUploadedFiles(uploadedList);
      }
    } catch (err) {
      console.error("Error loading uploaded files:", err);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !request) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setUploading(true);
    setUploadProgress(0);

    const allowedTypes = ['image/jpeg', 'image/png', 'image/heic', 'application/pdf'];
    const maxSize = 15 * 1024 * 1024; // 15MB

    let successCount = 0;
    const totalFiles = files.length;

    for (let i = 0; i < totalFiles; i++) {
      const file = files[i];
      
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Type non supporté",
          description: `${file.name}: formats acceptés JPG, PNG, HEIC, PDF`,
          variant: "destructive"
        });
        continue;
      }

      if (file.size > maxSize) {
        toast({
          title: "Fichier trop volumineux",
          description: `${file.name}: maximum 15 MB`,
          variant: "destructive"
        });
        continue;
      }

      try {
        const timestamp = Date.now();
        const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const path = `${user.id}/${request.id}/${timestamp}_${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from("client-documents")
          .upload(path, file);

        if (uploadError) throw uploadError;

        setUploadedFiles(prev => [...prev, {
          name: safeName,
          url: path,
          uploaded_at: new Date().toISOString()
        }]);

        successCount++;
        setUploadProgress(Math.round(((i + 1) / totalFiles) * 100));
      } catch (err) {
        console.error("Upload error:", err);
        toast({
          title: "Erreur de téléversement",
          description: `Impossible de téléverser ${file.name}`,
          variant: "destructive"
        });
      }
    }

    if (successCount > 0) {
      toast({
        title: "Documents téléversés",
        description: `${successCount} fichier(s) téléversé(s) avec succès`
      });

      // Update request status
      const newStatus = uploadedFiles.length + successCount >= (request.required_documents?.length || 1) 
        ? "completed" 
        : "partial";

      await supabase
        .from("document_requests")
        .update({ 
          status: newStatus,
          completed_at: newStatus === "completed" ? new Date().toISOString() : null
        })
        .eq("id", request.id);

      if (newStatus === "completed") {
        setRequest(prev => prev ? { ...prev, status: "completed" } : null);
      }
    }

    setUploading(false);
    setUploadProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRemoveFile = async (fileUrl: string, fileName: string) => {
    try {
      const { error } = await supabase.storage
        .from("client-documents")
        .remove([fileUrl]);

      if (error) throw error;

      setUploadedFiles(prev => prev.filter(f => f.url !== fileUrl));
      toast({
        title: "Fichier supprimé",
        description: `${fileName} a été supprimé`
      });
    } catch (err) {
      console.error("Delete error:", err);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer le fichier",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Chargement de la demande...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-2" />
            <CardTitle>Erreur</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => navigate("/portal")}>
              Retour au portail
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!request) return null;

  const isCompleted = request.status === "completed";

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <img 
            src="/lovable-uploads/3c596b71-aa59-43f0-ac7e-8b87a060ad02.png" 
            alt="Nivra Telecom" 
            className="h-10 mx-auto mb-4"
          />
          <h1 className="text-2xl font-bold">Téléversement de documents</h1>
          <p className="text-muted-foreground mt-1">
            Documents requis pour votre demande
          </p>
        </div>

        {/* Request Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Demande de documents
            </CardTitle>
            {request.request_reason && (
              <CardDescription>{request.request_reason}</CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Deadline */}
            {request.deadline && (
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span>Date limite: {format(new Date(request.deadline), "d MMMM yyyy", { locale: fr })}</span>
              </div>
            )}

            {/* Required Documents List */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Documents requis:</p>
              <ul className="space-y-1">
                {request.required_documents?.map((doc, index) => (
                  <li key={index} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
                      uploadedFiles.length > index ? 'bg-green-500/20' : 'bg-muted'
                    }`}>
                      {uploadedFiles.length > index ? (
                        <Check className="w-3 h-3 text-green-500" />
                      ) : (
                        <span className="text-xs">{index + 1}</span>
                      )}
                    </div>
                    {doc}
                  </li>
                ))}
              </ul>
            </div>

            {/* Status Badge */}
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
              isCompleted 
                ? 'bg-green-500/20 text-green-600' 
                : request.status === 'partial'
                  ? 'bg-yellow-500/20 text-yellow-600'
                  : 'bg-blue-500/20 text-blue-600'
            }`}>
              {isCompleted ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Tous les documents reçus
                </>
              ) : request.status === 'partial' ? (
                <>
                  <Clock className="w-4 h-4" />
                  Documents partiellement reçus
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  En attente de documents
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Upload Section */}
        {!isCompleted && (
          <Card>
            <CardHeader>
              <CardTitle>Téléverser vos documents</CardTitle>
              <CardDescription>
                Formats acceptés: JPG, PNG, HEIC, PDF (max 15 MB par fichier)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".jpg,.jpeg,.png,.heic,.pdf"
                onChange={handleFileSelect}
                className="hidden"
              />

              <div 
                className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading ? (
                  <div className="space-y-2">
                    <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
                    <p className="text-sm text-muted-foreground">Téléversement en cours...</p>
                    <Progress value={uploadProgress} className="max-w-xs mx-auto" />
                  </div>
                ) : (
                  <>
                    <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                    <p className="font-medium">Cliquez pour sélectionner des fichiers</p>
                    <p className="text-sm text-muted-foreground">ou glissez-déposez ici</p>
                  </>
                )}
              </div>

              <Button 
                className="w-full" 
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <Upload className="w-4 h-4 mr-2" />
                Sélectionner des fichiers
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Uploaded Files */}
        {uploadedFiles.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                Documents téléversés ({uploadedFiles.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {uploadedFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-primary" />
                      <div>
                        <p className="text-sm font-medium">{file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(file.uploaded_at), "d MMM yyyy 'à' HH:mm", { locale: fr })}
                        </p>
                      </div>
                    </div>
                    {!isCompleted && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveFile(file.url, file.name)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Completed Message */}
        {isCompleted && (
          <Card className="bg-green-500/10 border-green-500/30">
            <CardContent className="pt-6 text-center">
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <h3 className="font-semibold text-lg">Merci!</h3>
              <p className="text-muted-foreground">
                Tous vos documents ont été reçus. Notre équipe les examinera sous peu.
              </p>
              <Button className="mt-4" onClick={() => navigate("/portal")}>
                Retour au portail
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground">
          <p>Besoin d'aide? Contactez-nous à support@nivratelecom.ca</p>
        </div>
      </div>
    </div>
  );
};

export default ClientDocumentUpload;
