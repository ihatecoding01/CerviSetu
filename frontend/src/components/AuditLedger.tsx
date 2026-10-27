import { useState } from "react";
import { api, type AuditLog } from "../api/client";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "./careui/card";
import { Badge } from "./careui/badge";
import { Button } from "./careui/button";
import { Input } from "./careui/input";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "./careui/table";
import { Alert, AlertDescription } from "./careui/alert";
import { Lock, Unlock, ShieldCheck, RefreshCw, KeyRound, AlertTriangle, Search } from "lucide-react";

interface Props {
  logs: AuditLog[];
  loading: boolean;
  onRefresh?: () => void;
}

export function AuditLedger({ logs, loading, onRefresh }: Props) {
  const [vaultToken, setVaultToken] = useState("");
  const [vaultResult, setVaultResult] = useState<any>(null);
  const [vaultError, setVaultError] = useState<string | null>(null);
  const [vaultLoading, setVaultLoading] = useState(false);
  const [filter, setFilter] = useState("");

  const handleVaultInspect = async () => {
    if (!vaultToken.trim()) return;
    setVaultLoading(true);
    setVaultResult(null);
    setVaultError(null);
    try {
      const res = await api.inspectVault(vaultToken.trim());
      setVaultResult(res);
    } catch (err) {
      setVaultError(err instanceof Error ? err.message : "Vault access denied: unauthorized role token");
    } finally {
      setVaultLoading(false);
    }
  };

  const filteredLogs = logs.filter((l) =>
    !filter ||
    l.action.toLowerCase().includes(filter.toLowerCase()) ||
    (l.patient_token || "").toLowerCase().includes(filter.toLowerCase()) ||
    l.severity.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#111418]">
            Security Vault &amp; Cryptographic Audit Ledger
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Zero-knowledge cryptographic separation between patient identity and reasoning models with SHA-256 tamper-evident compliance chaining
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onRefresh && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onRefresh}
              disabled={loading}
              className="text-xs font-medium"
            >
              <RefreshCw className={`size-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
              Sync Ledger
            </Button>
          )}
          <Badge variant="primary" size="sm">AES-256-GCM Vault</Badge>
          <Badge variant="neutral" size="sm">SHA-256 Block Chained</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left: AES-256 Vault Inspector */}
        <Card className="bg-white border-gray-200 shadow-2xs lg:col-span-1">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-[#111418] flex items-center gap-2">
                  <KeyRound className="size-4 text-[#2B66E4]" />
                  PII Vault Decryption Gate
                </CardTitle>
                <CardDescription className="text-xs text-gray-500">Authorized medical officer role validation</CardDescription>
              </div>
              <Badge variant="warning" size="xs">CMO Role Only</Badge>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3.5">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-700">De-Identified Patient Token</label>
              <div className="flex gap-2">
                <Input
                  value={vaultToken}
                  onChange={(e) => setVaultToken(e.target.value)}
                  placeholder="e.g. PT-RURAL-7891"
                  className="font-mono text-xs"
                />
                <Button
                  onClick={handleVaultInspect}
                  disabled={vaultLoading || !vaultToken.trim()}
                  size="sm"
                  className="bg-[#111418] hover:bg-black text-white shrink-0 text-xs font-medium"
                >
                  <Unlock className="size-3.5 mr-1" />
                  Unmask
                </Button>
              </div>
            </div>

            {vaultError && (
              <Alert variant="destructive" className="py-2.5">
                <AlertTriangle className="size-3.5" />
                <AlertDescription className="text-xs">{vaultError}</AlertDescription>
              </Alert>
            )}

            {vaultResult && (
              <div className="p-3.5 rounded-xl bg-blue-50/50 border border-blue-200 flex flex-col gap-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#2B66E4]">
                  <ShieldCheck className="size-4" />
                  <span>[STATUTORY ACCESS AUTHORIZED]</span>
                </div>
                <pre className="text-[11px] font-mono text-gray-800 bg-white p-2.5 rounded-lg border border-gray-200 overflow-x-auto">
                  {JSON.stringify(vaultResult, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right: Cryptographic Audit Ledger */}
        <Card className="bg-white border-gray-200 shadow-2xs lg:col-span-2">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base font-bold text-[#111418] flex items-center gap-2">
                  <Lock className="size-4 text-[#4A91A7]" />
                  Tamper-Evident Audit Ledger
                </CardTitle>
                <CardDescription className="text-xs text-gray-500">
                  Every clinical decision, de-identification event, and notification dispatch is cryptographically chained
                </CardDescription>
              </div>

              <div className="relative flex items-center w-48">
                <Search className="absolute left-2.5 size-3 text-gray-400" />
                <Input
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Filter events..."
                  className="w-full pl-7 h-8 text-xs bg-gray-50/80 border-gray-200"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredLogs.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-xs">
                No matching audit logs recorded. Pipeline actions automatically commit to this ledger.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Action Triggered</TableHead>
                    <TableHead>Actor Component</TableHead>
                    <TableHead>Patient Token</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => (
                    <TableRow key={log.event_id}>
                      <TableCell className="font-mono text-xs text-gray-500">
                        {log.timestamp}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            log.severity === "CRITICAL"
                              ? "destructive"
                              : log.severity === "WARNING"
                              ? "warning"
                              : "neutral"
                          }
                          size="xs"
                        >
                          {log.severity}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-semibold text-gray-900 text-xs">
                        {log.action}
                      </TableCell>
                      <TableCell className="text-xs text-gray-600 font-mono">{log.actor}</TableCell>
                      <TableCell className="font-mono text-xs text-[#2B66E4] font-semibold">
                        {log.patient_token || "SYSTEM"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
