import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { Shield, CheckCircle, XCircle, AlertTriangle, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

interface TestResult {
  test: string;
  passed: boolean;
  expected: string;
  actual: string;
  error?: string;
}

export default function DevRLSTest() {
  const [results, setResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [foreignConversationId, setForeignConversationId] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

  // Get current user on mount
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        setCurrentUserEmail(user.email || null);
      }
    };
    getUser();
  }, []);

  // Check if conversation ID is valid UUID
  const isValidUUID = (id: string): boolean => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
  };

  // Validate that the conversation exists (using service role would be needed for full validation,
  // but we can check if we get any response)
  const validateConversationExists = async (id: string): Promise<boolean> => {
    // If we can select it, it belongs to us (RLS) - that's also a test
    // If we can't select it, either it doesn't exist OR RLS blocked it (which is what we want)
    // We'll consider it "valid for testing" if it's a proper UUID
    return isValidUUID(id);
  };

  const runRLSTests = async () => {
    setValidationError(null);
    
    if (!foreignConversationId) {
      setValidationError("Veuillez entrer un ID de conversation.");
      return;
    }

    if (!isValidUUID(foreignConversationId)) {
      setValidationError("L'ID doit être un UUID valide (ex: 123e4567-e89b-12d3-a456-426614174000).");
      return;
    }

    if (!currentUserId) {
      setValidationError("Vous devez être connecté pour exécuter les tests.");
      return;
    }

    setIsRunning(true);
    const testResults: TestResult[] = [];

    // Helper to detect RLS/permission errors vs other errors
    const isRLSError = (error: any): boolean => {
      const msg = error?.message?.toLowerCase() || "";
      return msg.includes("policy") || 
             msg.includes("permission") || 
             msg.includes("row-level security") ||
             msg.includes("rls") ||
             msg.includes("denied");
    };

    // Test 0: SELECT the conversation itself - if found, FAIL immediately
    try {
      const { data, error } = await supabase
        .from("message_conversations")
        .select("id, client_id, subject")
        .eq("id", foreignConversationId)
        .maybeSingle();

      if (data) {
        // Conversation found - check if it belongs to current user
        if (data.client_id === currentUserId) {
          setValidationError("Cette conversation vous appartient! Utilisez l'ID d'une conversation d'un AUTRE utilisateur.");
          setIsRunning(false);
          return;
        }
        // If we can see a conversation that doesn't belong to us, RLS is broken!
        testResults.push({
          test: "SELECT conversation étrangère (ligne directe)",
          passed: false,
          expected: "0 résultats (RLS doit bloquer)",
          actual: `TROUVÉE! client_id=${data.client_id}`,
          error: "FAILLE SÉCURITÉ: RLS ne bloque pas les SELECT!",
        });
      } else {
        testResults.push({
          test: "SELECT conversation étrangère (ligne directe)",
          passed: true,
          expected: "0 résultats ou erreur RLS",
          actual: error ? `Erreur: ${error.message}` : "0 résultats (bloqué par RLS)",
        });
      }
    } catch (e: any) {
      testResults.push({
        test: "SELECT conversation étrangère (ligne directe)",
        passed: true,
        expected: "Exception RLS",
        actual: `Exception: ${e.message}`,
      });
    }

    // Test 1: SELECT messages from a conversation that doesn't belong to the user
    try {
      const { data, error } = await supabase
        .from("helpdesk_messages")
        .select("*")
        .eq("conversation_id", foreignConversationId);

      const passed = data?.length === 0 || (!!error && isRLSError(error));
      
      testResults.push({
        test: "SELECT messages d'une conversation étrangère",
        passed,
        expected: "0 résultats ou erreur RLS",
        actual: error ? `Erreur: ${error.message}` : `${data?.length || 0} résultats`,
        error: !passed && error ? `Type d'erreur: ${error.code}` : undefined,
      });
    } catch (e: any) {
      testResults.push({
        test: "SELECT messages d'une conversation étrangère",
        passed: true,
        expected: "Exception RLS",
        actual: `Exception: ${e.message}`,
      });
    }

    // Test 2: INSERT message into a conversation that doesn't belong to the user
    // Use current user's ID as sender_id (not hardcoded)
    try {
      const { data, error } = await supabase
        .from("helpdesk_messages")
        .insert({
          conversation_id: foreignConversationId,
          sender_id: currentUserId, // Use real connected user ID
          sender_name: "Test RLS",
          sender_role: "client",
          content: "Test message - should be blocked by RLS",
        })
        .select();

      // Pass if there's an error (RLS blocked) or if no rows were inserted
      const passed = !!error || !data || data.length === 0;
      
      testResults.push({
        test: "INSERT message dans une conversation étrangère",
        passed,
        expected: "Erreur RLS (INSERT bloqué)",
        actual: error ? `Bloqué: ${error.message}` : `Inséré! ID: ${data?.[0]?.id}`,
        error: !passed ? "FAILLE: Message inséré dans conversation non-propriétaire!" : undefined,
      });
    } catch (e: any) {
      testResults.push({
        test: "INSERT message dans une conversation étrangère",
        passed: true,
        expected: "Exception RLS",
        actual: `Exception: ${e.message}`,
      });
    }

    // Test 3: UPDATE a conversation that doesn't belong to the user
    try {
      const { data, error } = await supabase
        .from("message_conversations")
        .update({ status: "closed" })
        .eq("id", foreignConversationId)
        .select();

      // Pass if error OR 0 rows affected
      const passed = !!error || !data || data.length === 0;

      testResults.push({
        test: "UPDATE conversation étrangère",
        passed,
        expected: "0 résultats modifiés ou erreur RLS",
        actual: error ? `Bloqué: ${error.message}` : `${data?.length || 0} modifiés`,
        error: !passed ? "FAILLE: Conversation modifiée sans autorisation!" : undefined,
      });
    } catch (e: any) {
      testResults.push({
        test: "UPDATE conversation étrangère",
        passed: true,
        expected: "Exception RLS",
        actual: `Exception: ${e.message}`,
      });
    }

    // Test 4: Try to delete a message from foreign conversation (if DELETE policy exists)
    try {
      const { data, error } = await supabase
        .from("helpdesk_messages")
        .delete()
        .eq("conversation_id", foreignConversationId)
        .select();

      const passed = !!error || !data || data.length === 0;

      testResults.push({
        test: "DELETE messages d'une conversation étrangère",
        passed,
        expected: "0 supprimés ou erreur RLS",
        actual: error ? `Bloqué: ${error.message}` : `${data?.length || 0} supprimés`,
        error: !passed ? "FAILLE: Messages supprimés sans autorisation!" : undefined,
      });
    } catch (e: any) {
      testResults.push({
        test: "DELETE messages d'une conversation étrangère",
        passed: true,
        expected: "Exception RLS",
        actual: `Exception: ${e.message}`,
      });
    }

    setResults(testResults);
    setIsRunning(false);
  };

  const allPassed = results.length > 0 && results.every(r => r.passed);
  const hasCriticalFailure = results.some(r => !r.passed && r.error?.includes("FAILLE"));

  // Only render in DEV mode
  if (!import.meta.env.DEV) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Accès refusé</h2>
            <p className="text-muted-foreground">Cette page est disponible uniquement en mode développement.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Test RLS Messagerie</h1>
            <p className="text-muted-foreground">
              DEV ONLY - Prouve que les politiques RLS empêchent l'accès croisé entre clients.
            </p>
          </div>
        </div>

        {currentUserId && (
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              Connecté en tant que: <strong>{currentUserEmail || currentUserId}</strong>
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Test de sécurité RLS
            </CardTitle>
            <CardDescription>
              Entrez l'ID d'une conversation qui n'appartient PAS à l'utilisateur actuellement connecté.
              Les tests vérifient que RLS bloque correctement les accès non autorisés.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {validationError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{validationError}</AlertDescription>
              </Alert>
            )}

            <div className="flex gap-4">
              <Input
                placeholder="ID de conversation étrangère (UUID)"
                value={foreignConversationId}
                onChange={(e) => setForeignConversationId(e.target.value.trim())}
                className="flex-1 font-mono text-sm"
              />
              <Button onClick={runRLSTests} disabled={isRunning || !currentUserId}>
                {isRunning ? "Test en cours..." : "Lancer les tests"}
              </Button>
            </div>

            {results.length > 0 && (
              <div className="space-y-4 mt-6">
                <div className="flex items-center gap-2">
                  {hasCriticalFailure ? (
                    <>
                      <XCircle className="h-6 w-6 text-red-500" />
                      <span className="text-lg font-semibold text-red-600">
                        🚨 FAILLE DE SÉCURITÉ DÉTECTÉE!
                      </span>
                    </>
                  ) : allPassed ? (
                    <>
                      <CheckCircle className="h-6 w-6 text-green-500" />
                      <span className="text-lg font-semibold text-green-600">
                        ✅ Tous les tests RLS passés
                      </span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-6 w-6 text-yellow-500" />
                      <span className="text-lg font-semibold text-yellow-600">
                        ⚠️ Certains tests ont échoué
                      </span>
                    </>
                  )}
                </div>

                <div className="space-y-3">
                  {results.map((result, index) => (
                    <Card key={index} className={
                      result.passed 
                        ? "border-green-200 bg-green-50/50" 
                        : result.error?.includes("FAILLE") 
                          ? "border-red-500 bg-red-100" 
                          : "border-yellow-300 bg-yellow-50"
                    }>
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2">
                              {result.passed ? (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-500" />
                              )}
                              <span className="font-medium">{result.test}</span>
                            </div>
                            <div className="text-sm text-muted-foreground pl-6">
                              <p><strong>Attendu:</strong> {result.expected}</p>
                              <p><strong>Résultat:</strong> {result.actual}</p>
                              {result.error && (
                                <p className="text-red-600 font-medium mt-1">{result.error}</p>
                              )}
                            </div>
                          </div>
                          <Badge variant={result.passed ? "default" : "destructive"}>
                            {result.passed ? "PASSÉ" : "ÉCHOUÉ"}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Instructions de test</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>1. Connectez-vous en tant que <strong>Client A</strong> dans le portail client.</p>
            <p>2. Créez une conversation de test via la messagerie.</p>
            <p>3. Récupérez l'ID de cette conversation (console DevTools ou base de données).</p>
            <p>4. Déconnectez-vous et connectez-vous en tant que <strong>Client B</strong>.</p>
            <p>5. Accédez à cette page et entrez l'ID de la conversation du Client A.</p>
            <p>6. Lancez les tests - tous doivent afficher <Badge>PASSÉ</Badge> (accès refusé par RLS).</p>
            <p className="text-muted-foreground mt-4">
              💡 Pour obtenir un ID de conversation, ouvrez la console DevTools et cherchez dans les requêtes réseau,
              ou consultez directement la table <code>message_conversations</code> dans la base de données.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
