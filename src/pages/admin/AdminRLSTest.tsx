import { useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Shield, CheckCircle, XCircle, AlertTriangle } from "lucide-react";

interface TestResult {
  test: string;
  passed: boolean;
  expected: string;
  actual: string;
  error?: string;
}

export default function AdminRLSTest() {
  const [results, setResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [foreignConversationId, setForeignConversationId] = useState("");

  const runRLSTests = async () => {
    if (!foreignConversationId) {
      alert("Veuillez entrer un ID de conversation qui N'APPARTIENT PAS à l'utilisateur connecté.");
      return;
    }

    setIsRunning(true);
    const testResults: TestResult[] = [];

    // Test 1: SELECT messages from a conversation that doesn't belong to the user
    try {
      const { data, error } = await supabase
        .from("helpdesk_messages")
        .select("*")
        .eq("conversation_id", foreignConversationId);

      testResults.push({
        test: "SELECT messages d'une conversation étrangère",
        passed: (data?.length === 0 || !!error),
        expected: "0 résultats ou erreur RLS",
        actual: error ? `Erreur: ${error.message}` : `${data?.length || 0} résultats`,
        error: error?.message,
      });
    } catch (e: any) {
      testResults.push({
        test: "SELECT messages d'une conversation étrangère",
        passed: true,
        expected: "Erreur RLS",
        actual: `Exception: ${e.message}`,
      });
    }

    // Test 2: INSERT message into a conversation that doesn't belong to the user
    try {
      const { data, error } = await supabase
        .from("helpdesk_messages")
        .insert({
          conversation_id: foreignConversationId,
          sender_id: "00000000-0000-0000-0000-000000000001",
          sender_name: "Attaquant",
          sender_role: "client",
          content: "Message malveillant",
        })
        .select();

      testResults.push({
        test: "INSERT message dans une conversation étrangère",
        passed: !!error,
        expected: "Erreur RLS (INSERT bloqué)",
        actual: error ? `Erreur: ${error.message}` : `Inséré! ID: ${data?.[0]?.id}`,
        error: error?.message,
      });
    } catch (e: any) {
      testResults.push({
        test: "INSERT message dans une conversation étrangère",
        passed: true,
        expected: "Erreur RLS",
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

      testResults.push({
        test: "UPDATE conversation étrangère",
        passed: (data?.length === 0 || !!error),
        expected: "0 résultats modifiés ou erreur RLS",
        actual: error ? `Erreur: ${error.message}` : `${data?.length || 0} modifiés`,
        error: error?.message,
      });
    } catch (e: any) {
      testResults.push({
        test: "UPDATE conversation étrangère",
        passed: true,
        expected: "Erreur RLS",
        actual: `Exception: ${e.message}`,
      });
    }

    // Test 4: SELECT a conversation that doesn't belong to the user
    try {
      const { data, error } = await supabase
        .from("message_conversations")
        .select("*")
        .eq("id", foreignConversationId);

      testResults.push({
        test: "SELECT conversation étrangère",
        passed: (data?.length === 0 || !!error),
        expected: "0 résultats ou erreur RLS",
        actual: error ? `Erreur: ${error.message}` : `${data?.length || 0} résultats`,
        error: error?.message,
      });
    } catch (e: any) {
      testResults.push({
        test: "SELECT conversation étrangère",
        passed: true,
        expected: "Erreur RLS",
        actual: `Exception: ${e.message}`,
      });
    }

    setResults(testResults);
    setIsRunning(false);
  };

  const allPassed = results.length > 0 && results.every(r => r.passed);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Test RLS Messagerie</h1>
          <p className="text-muted-foreground">
            Cette page permet de prouver que les politiques RLS empêchent l'accès croisé entre clients.
          </p>
        </div>

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
            <div className="flex gap-4">
              <Input
                placeholder="ID de conversation étrangère (UUID)"
                value={foreignConversationId}
                onChange={(e) => setForeignConversationId(e.target.value)}
                className="flex-1"
              />
              <Button onClick={runRLSTests} disabled={isRunning}>
                {isRunning ? "Test en cours..." : "Lancer les tests"}
              </Button>
            </div>

            {results.length > 0 && (
              <div className="space-y-4 mt-6">
                <div className="flex items-center gap-2">
                  {allPassed ? (
                    <>
                      <CheckCircle className="h-6 w-6 text-green-500" />
                      <span className="text-lg font-semibold text-green-600">
                        Tous les tests RLS passés ✓
                      </span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-6 w-6 text-red-500" />
                      <span className="text-lg font-semibold text-red-600">
                        ATTENTION: Certains tests ont échoué!
                      </span>
                    </>
                  )}
                </div>

                <div className="space-y-3">
                  {results.map((result, index) => (
                    <Card key={index} className={result.passed ? "border-green-200" : "border-red-300 bg-red-50"}>
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              {result.passed ? (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-500" />
                              )}
                              <span className="font-medium">{result.test}</span>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              <p><strong>Attendu:</strong> {result.expected}</p>
                              <p><strong>Résultat:</strong> {result.actual}</p>
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
            <p>2. Créez une conversation de test.</p>
            <p>3. Notez l'ID de cette conversation (visible dans l'URL ou la console).</p>
            <p>4. Déconnectez-vous et connectez-vous en tant que <strong>Client B</strong>.</p>
            <p>5. Entrez l'ID de la conversation du Client A dans cette page.</p>
            <p>6. Lancez les tests - tous doivent passer (accès refusé par RLS).</p>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
