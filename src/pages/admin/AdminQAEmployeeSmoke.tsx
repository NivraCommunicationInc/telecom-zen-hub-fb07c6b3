/**
 * DEV-ONLY: Employee Portal Smoke Test Page
 * Renders employee pages without auth for visual verification
 * Gated by import.meta.env.DEV - not included in production builds
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Import the employee page content (without layout wrapper for testing)
import EmployeeCancellations from "@/pages/employee/EmployeeCancellations";
import EmployeePaymentDisputes from "@/pages/employee/EmployeePaymentDisputes";
import EmployeeTickets from "@/pages/employee/EmployeeTickets";

const AdminQAEmployeeSmoke = () => {
  const [activeTab, setActiveTab] = useState("cancellations");

  if (!import.meta.env.DEV) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold text-red-500">DEV ONLY</h1>
        <p>This page is not available in production.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🧪 Employee Portal Smoke Test
            <Badge variant="outline" className="bg-amber-500/20 text-amber-500">DEV ONLY</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            This page renders Employee pages without auth for visual verification.
            Check console for errors.
          </p>
          
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-3 w-full max-w-md">
              <TabsTrigger value="cancellations">Cancellations</TabsTrigger>
              <TabsTrigger value="disputes">Disputes</TabsTrigger>
              <TabsTrigger value="tickets">Tickets</TabsTrigger>
            </TabsList>
            
            <TabsContent value="cancellations" className="mt-4">
              <div className="border rounded-lg overflow-hidden">
                <EmployeeCancellations />
              </div>
            </TabsContent>
            
            <TabsContent value="disputes" className="mt-4">
              <div className="border rounded-lg overflow-hidden">
                <EmployeePaymentDisputes />
              </div>
            </TabsContent>
            
            <TabsContent value="tickets" className="mt-4">
              <div className="border rounded-lg overflow-hidden">
                <EmployeeTickets />
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminQAEmployeeSmoke;
