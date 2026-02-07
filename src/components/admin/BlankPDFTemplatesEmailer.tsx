/**
 * Blank PDF Templates Emailer - Stub Component
 * 
 * @deprecated This component was removed during legacy cleanup.
 * Blank templates can now be generated from /admin/qa
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

export function BlankPDFTemplatesEmailer() {
  return (
    <Card className="border-amber-500/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-amber-600">
          <AlertTriangle className="h-5 w-5" />
          Fonctionnalité déplacée
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Les templates PDF vierges peuvent maintenant être générés depuis la page QA (/admin/qa).
        </p>
      </CardContent>
    </Card>
  );
}

export default BlankPDFTemplatesEmailer;
