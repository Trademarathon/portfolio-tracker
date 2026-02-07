"use client";

import { Alert, useAlerts } from "@/hooks/useAlerts";
import { Button } from "@/components/ui/button";
import {
    Bell,
    X,
    Trash2,
    Power,
    Plus,
    Settings2,
    Volume2,
    Calendar,
    History
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion, AnimatePresence } from "framer-motion";

export function AlertsSidebar({ open, onClose }: { open: boolean, onClose: () => void }) {
    const { alerts, removeAlert, toggleAlert, addAlert } = useAlerts();

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    initial={{ x: 320 }}
                    animate={{ x: 0 }}
                    exit={{ x: 320 }}
                    className="fixed right-0 top-0 h-screen w-80 bg-zinc-950 border-l border-white/10 z-[100] shadow-2xl flex flex-col pt-16"
                >
                    <div className="p-4 border-b border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Bell className="h-4 w-4 text-primary" />
                            <h2 className="text-sm font-bold uppercase tracking-widest text-white">Market Alerts</h2>
                        </div>
                        <Button variant="ghost" size="icon" onClick={onClose}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>

                    <Tabs defaultValue="active" className="flex-1 flex flex-col overflow-hidden">
                        <div className="px-4 py-2 bg-white/5">
                            <TabsList className="w-full bg-zinc-900 border-white/5">
                                <TabsTrigger value="active" className="flex-1 text-[10px] uppercase font-bold">Active</TabsTrigger>
                                <TabsTrigger value="history" className="flex-1 text-[10px] uppercase font-bold text-muted-foreground"><History className="h-3 w-3 mr-1" /> History</TabsTrigger>
                            </TabsList>
                        </div>

                        <TabsContent value="active" className="flex-1 flex flex-col overflow-hidden m-0">
                            <ScrollArea className="flex-1 px-4">
                                <div className="space-y-3 py-4">
                                    {alerts.filter(a => a.active).length === 0 ? (
                                        <div className="text-center py-10">
                                            <p className="text-xs text-zinc-500">No active alerts.</p>
                                        </div>
                                    ) : (
                                        alerts.filter(a => a.active).map(alert => (
                                            <div key={alert.id} className="p-3 rounded-lg bg-zinc-900 border border-white/5 hover:border-primary/30 transition-colors">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-xs font-bold text-white font-mono">{alert.symbol}</span>
                                                    <div className="flex items-center gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6 text-zinc-600 hover:text-primary"
                                                            onClick={() => toggleAlert(alert.id)}
                                                        >
                                                            <Power className="h-3 w-3" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6 text-zinc-600 hover:text-red-500"
                                                            onClick={() => removeAlert(alert.id)}
                                                        >
                                                            <Trash2 className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                </div>
                                                <div className="space-y-1">
                                                    {alert.conditions.map((cond, idx) => (
                                                        <div key={idx} className="flex items-center justify-between text-[10px]">
                                                            <span className="text-muted-foreground uppercase">{cond.type.replace('_', ' ')}</span>
                                                            <span className="text-white font-mono">{cond.target}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </ScrollArea>

                            <div className="p-4 border-t border-white/5 bg-zinc-950">
                                <Button
                                    className="w-full bg-primary hover:bg-primary/90 text-white font-bold text-xs uppercase"
                                    onClick={() => addAlert("GLOBAL", [{ type: "price_above", target: 100000 }])}
                                >
                                    <Plus className="h-3 w-3 mr-2" /> Create New Alert
                                </Button>
                            </div>
                        </TabsContent>

                        <TabsContent value="history" className="flex-1 p-4 m-0 overflow-auto">
                            <div className="flex flex-col items-center justify-center h-full opacity-20">
                                <Volume2 className="h-12 w-12 mb-2" />
                                <p className="text-xs font-bold uppercase tracking-widest">No Alerts History</p>
                            </div>
                        </TabsContent>
                    </Tabs>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
