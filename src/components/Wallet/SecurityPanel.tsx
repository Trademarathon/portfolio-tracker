"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Shield, Smartphone, Lock, Eye, Check } from "lucide-react";
import { Switch } from "@/components/ui/switch";

export const SecurityPanel = () => {
    return (
        <Card className="bg-[#141318] border-white/5 h-full">
            <CardHeader>
                <CardTitle className="text-xl font-bold font-urbanist">Security & Privacy</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* 2FA */}
                    <div className="p-4 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                                <Smartphone className="h-5 w-5 text-orange-400" />
                            </div>
                            <div>
                                <h4 className="text-white font-bold text-sm">Two-Factor Auth</h4>
                                <p className="text-xs text-zinc-500">Enabled via Authenticator</p>
                            </div>
                        </div>
                        <Switch checked={true} />
                    </div>

                    {/* Encryption */}
                    <div className="p-4 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                                <Lock className="h-5 w-5 text-purple-400" />
                            </div>
                            <div>
                                <h4 className="text-white font-bold text-sm">Data Encryption</h4>
                                <p className="text-xs text-zinc-500">AES-256 Enabled</p>
                            </div>
                        </div>
                        <div className="h-6 w-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                            <Check className="h-3 w-3 text-emerald-400" />
                        </div>
                    </div>

                    {/* Transaction Privacy */}
                    <div className="p-4 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                                <Eye className="h-5 w-5 text-blue-400" />
                            </div>
                            <div>
                                <h4 className="text-white font-bold text-sm">Hide Balances</h4>
                                <p className="text-xs text-zinc-500">Blur sensitive data</p>
                            </div>
                        </div>
                        <Switch checked={false} />
                    </div>

                    {/* Security Audit */}
                    <div className="p-4 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-zinc-800 flex items-center justify-center">
                                <Shield className="h-5 w-5 text-zinc-400" />
                            </div>
                            <div>
                                <h4 className="text-white font-bold text-sm">Security Audit</h4>
                                <p className="text-xs text-zinc-500">Last scan: Today</p>
                            </div>
                        </div>
                        <span className="text-xs font-bold text-emerald-400">Clean</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};
