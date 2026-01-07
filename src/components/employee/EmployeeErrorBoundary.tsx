/**
 * EmployeeErrorBoundary - TEMPORARY error boundary for employee portal
 * 
 * Catches errors in employee routes and displays them instead of blank screen
 * TODO: Remove after debugging is complete
 */

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class EmployeeErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[EmployeeErrorBoundary] Caught error:", error);
    console.error("[EmployeeErrorBoundary] Error info:", errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = "/employee/login";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <Card className="max-w-lg w-full">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <CardTitle>Erreur dans le portail employé</CardTitle>
                  <CardDescription>
                    Une erreur inattendue s'est produite
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Error message */}
              <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-4">
                <p className="text-sm font-medium text-destructive mb-2">
                  {this.state.error?.message || "Erreur inconnue"}
                </p>
                {this.state.error?.stack && (
                  <pre className="text-xs text-muted-foreground overflow-auto max-h-40 whitespace-pre-wrap">
                    {this.state.error.stack}
                  </pre>
                )}
              </div>

              {/* Component stack */}
              {this.state.errorInfo?.componentStack && (
                <div className="bg-muted rounded-lg p-4">
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    Pile de composants:
                  </p>
                  <pre className="text-xs text-muted-foreground overflow-auto max-h-32 whitespace-pre-wrap">
                    {this.state.errorInfo.componentStack}
                  </pre>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <Button onClick={this.handleReload} className="flex-1">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Recharger
                </Button>
                <Button variant="outline" onClick={this.handleGoHome} className="flex-1">
                  <Home className="h-4 w-4 mr-2" />
                  Retour au login
                </Button>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                Cette erreur a été enregistrée. Veuillez contacter le support si le problème persiste.
              </p>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default EmployeeErrorBoundary;
