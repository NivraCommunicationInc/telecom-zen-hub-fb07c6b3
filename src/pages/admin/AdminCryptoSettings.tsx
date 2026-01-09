import { useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check, AlertCircle, Zap, Wallet, Settings } from "lucide-react";
import { useCryptoGatewaySettings, useUpdateCryptoSettings, useTestCryptoConnection } from "@/hooks/useCryptoPayments";

const SUPPORTED_CURRENCIES = [
  { code: "BTC", name: "Bitcoin", icon: "₿" },
  { code: "ETH", name: "Ethereum", icon: "Ξ" },
  { code: "XRP", name: "Ripple", icon: "✕" },
  { code: "SOL", name: "Solana", icon: "◎" },
  { code: "USDT", name: "Tether", icon: "₮" },
  { code: "USDC", name: "USD Coin", icon: "$" },
  { code: "LTC", name: "Litecoin", icon: "Ł" },
];

export default function AdminCryptoSettings() {
  const { data: settings, isLoading } = useCryptoGatewaySettings();
  const updateSettings = useUpdateCryptoSettings();
  const testConnection = useTestCryptoConnection();

  const [mode, setMode] = useState<"sandbox" | "production">("sandbox");
  const [isEnabled, setIsEnabled] = useState(false);
  const [enabledCurrencies, setEnabledCurrencies] = useState<string[]>(["BTC", "ETH", "XRP", "SOL"]);
  const [minConfirmations, setMinConfirmations] = useState(1);
  const [walletBtc, setWalletBtc] = useState("");
  const [walletEth, setWalletEth] = useState("");
  const [walletXrp, setWalletXrp] = useState("");
  const [walletSol, setWalletSol] = useState("");
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize form when settings load
  useState(() => {
    if (settings) {
      setMode(settings.mode);
      setIsEnabled(settings.is_enabled);
      setEnabledCurrencies(settings.enabled_currencies || []);
      setMinConfirmations(settings.min_confirmations);
      setWalletBtc(settings.payout_wallet_btc || "");
      setWalletEth(settings.payout_wallet_eth || "");
      setWalletXrp(settings.payout_wallet_xrp || "");
      setWalletSol(settings.payout_wallet_sol || "");
    }
  });

  const handleCurrencyToggle = (code: string) => {
    setEnabledCurrencies(prev => 
      prev.includes(code) 
        ? prev.filter(c => c !== code)
        : [...prev, code]
    );
    setHasChanges(true);
  };

  const handleSave = () => {
    updateSettings.mutate({
      mode,
      is_enabled: isEnabled,
      enabled_currencies: enabledCurrencies,
      min_confirmations: minConfirmations,
      payout_wallet_btc: walletBtc || null,
      payout_wallet_eth: walletEth || null,
      payout_wallet_xrp: walletXrp || null,
      payout_wallet_sol: walletSol || null,
    }, {
      onSuccess: () => setHasChanges(false),
    });
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Paramètres Crypto</h1>
            <p className="text-muted-foreground">Configuration de NOWPayments</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => testConnection.mutate()}
              disabled={testConnection.isPending}
            >
              {testConnection.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Zap className="h-4 w-4 mr-2" />
              )}
              Tester la connexion
            </Button>
            <Button
              onClick={handleSave}
              disabled={updateSettings.isPending || !hasChanges}
            >
              {updateSettings.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Enregistrer
            </Button>
          </div>
        </div>

        {/* Status Banner */}
        {settings && (
          <Card className={settings.is_enabled ? "border-green-500/50 bg-green-500/5" : "border-yellow-500/50 bg-yellow-500/5"}>
            <CardContent className="flex items-center gap-3 py-4">
              {settings.is_enabled ? (
                <>
                  <Check className="h-5 w-5 text-green-500" />
                  <span className="font-medium">Paiements crypto actifs</span>
                  <Badge variant="outline" className="ml-2">
                    {settings.mode === "production" ? "Production" : "Sandbox"}
                  </Badge>
                </>
              ) : (
                <>
                  <AlertCircle className="h-5 w-5 text-yellow-500" />
                  <span className="font-medium">Paiements crypto désactivés</span>
                </>
              )}
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {/* Main Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Configuration générale
              </CardTitle>
              <CardDescription>
                Paramètres principaux du gateway
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="enabled">Activer les paiements crypto</Label>
                  <p className="text-sm text-muted-foreground">
                    Permettre aux clients de payer en crypto
                  </p>
                </div>
                <Switch
                  id="enabled"
                  checked={isEnabled}
                  onCheckedChange={(checked) => {
                    setIsEnabled(checked);
                    setHasChanges(true);
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="mode">Mode</Label>
                <Select 
                  value={mode} 
                  onValueChange={(val: "sandbox" | "production") => {
                    setMode(val);
                    setHasChanges(true);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sandbox">
                      <span className="flex items-center gap-2">
                        🧪 Sandbox (Test)
                      </span>
                    </SelectItem>
                    <SelectItem value="production">
                      <span className="flex items-center gap-2">
                        🚀 Production
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {mode === "sandbox" 
                    ? "Utilisez le mode sandbox pour tester sans vrais paiements" 
                    : "⚠️ Mode production - les paiements seront réels"}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmations">Confirmations minimum</Label>
                <Input
                  id="confirmations"
                  type="number"
                  min={0}
                  max={10}
                  value={minConfirmations}
                  onChange={(e) => {
                    setMinConfirmations(parseInt(e.target.value) || 1);
                    setHasChanges(true);
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Nombre de confirmations blockchain requises
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Currencies */}
          <Card>
            <CardHeader>
              <CardTitle>Devises acceptées</CardTitle>
              <CardDescription>
                Sélectionnez les cryptomonnaies à accepter
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                {SUPPORTED_CURRENCIES.map((currency) => (
                  <div
                    key={currency.code}
                    className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                  >
                    <Checkbox
                      id={currency.code}
                      checked={enabledCurrencies.includes(currency.code)}
                      onCheckedChange={() => handleCurrencyToggle(currency.code)}
                    />
                    <Label
                      htmlFor={currency.code}
                      className="flex items-center gap-2 cursor-pointer flex-1"
                    >
                      <span className="text-lg font-mono">{currency.icon}</span>
                      <span className="font-medium">{currency.code}</span>
                      <span className="text-muted-foreground">- {currency.name}</span>
                    </Label>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Payout Wallets */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                Portefeuilles de réception (optionnel)
              </CardTitle>
              <CardDescription>
                Adresses de portefeuille pour la réception des fonds (informationnel)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="wallet-btc">Portefeuille BTC</Label>
                  <Input
                    id="wallet-btc"
                    placeholder="bc1q..."
                    value={walletBtc}
                    onChange={(e) => {
                      setWalletBtc(e.target.value);
                      setHasChanges(true);
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wallet-eth">Portefeuille ETH</Label>
                  <Input
                    id="wallet-eth"
                    placeholder="0x..."
                    value={walletEth}
                    onChange={(e) => {
                      setWalletEth(e.target.value);
                      setHasChanges(true);
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wallet-xrp">Portefeuille XRP</Label>
                  <Input
                    id="wallet-xrp"
                    placeholder="r..."
                    value={walletXrp}
                    onChange={(e) => {
                      setWalletXrp(e.target.value);
                      setHasChanges(true);
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wallet-sol">Portefeuille SOL</Label>
                  <Input
                    id="wallet-sol"
                    placeholder="..."
                    value={walletSol}
                    onChange={(e) => {
                      setWalletSol(e.target.value);
                      setHasChanges(true);
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* API Info */}
        <Card>
          <CardHeader>
            <CardTitle>Informations API</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label className="text-muted-foreground">Clé API</Label>
                <p className="font-mono text-sm">••••••••••••••••</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Configurée via variable d'environnement NOWPAYMENTS_API_KEY
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground">IPN Secret</Label>
                <p className="font-mono text-sm">••••••••••••••••</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Configurée via variable d'environnement NOWPAYMENTS_IPN_SECRET
                </p>
              </div>
            </div>
            <div>
              <Label className="text-muted-foreground">URL Webhook IPN</Label>
              <p className="font-mono text-sm break-all">
                {import.meta.env.VITE_SUPABASE_URL}/functions/v1/nowpayments-ipn
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Configurez cette URL dans votre dashboard NOWPayments
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
