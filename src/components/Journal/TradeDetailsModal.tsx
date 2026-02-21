'use client';

import { useState } from 'react';
import { Transaction } from '@/lib/api/types';
import { X, Save, Image as ImageIcon } from 'lucide-react';
import { useVoiceRecognition } from '@/hooks/useVoiceRecognition';
import { VoiceInputButton } from '@/components/ui/VoiceInputButton';

interface TradeDetailsModalProps {
    transaction: Transaction;
    onClose: () => void;
    onSave: (id: string, updates: Partial<Transaction>) => void;
}

export function TradeDetailsModal({ transaction, onClose, onSave }: TradeDetailsModalProps) {
    const [notes, setNotes] = useState(transaction.notes || '');
    const [tags, setTags] = useState(transaction.tags?.join(', ') || '');
    const [screenshotUrl, setScreenshotUrl] = useState('');
    const { isListening, isTranscribing, error: voiceError, isSupported: voiceSupported, toggleListening } = useVoiceRecognition({
        onTranscript: (text) => setNotes(text),
    });

    const handleSave = () => {
        const tagArray = tags.split(',').map(t => t.trim()).filter(t => t.length > 0);
        onSave(transaction.id, {
            notes,
            tags: tagArray,
            // screenshot handling would be more complex in real app (upload), mocking slightly
            screenshots: screenshotUrl ? [screenshotUrl] : transaction.screenshots
        });
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-[#1E2026] border border-[#2B2F36] w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-[#2B2F36]">
                    <div>
                        <h2 className="text-xl font-bold text-gray-100 flex items-center gap-2">
                            {transaction.side === 'buy' ? <span className="text-green-400">LONG</span> : <span className="text-red-400">SHORT</span>}
                            {transaction.symbol}
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">
                            {new Date(transaction.timestamp).toLocaleString()} • {transaction.exchange}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-[#2B2F36] rounded-full text-gray-400 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1 space-y-6">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="bg-[#13151A] p-3 rounded-lg border border-[#2B2F36]">
                            <div className="text-xs text-gray-500 uppercase">Entry Price</div>
                            <div className="text-lg font-mono text-gray-200">${transaction.price}</div>
                        </div>
                        <div className="bg-[#13151A] p-3 rounded-lg border border-[#2B2F36]">
                            <div className="text-xs text-gray-500 uppercase">Size</div>
                            <div className="text-lg font-mono text-gray-200">{transaction.amount}</div>
                        </div>
                        <div className="bg-[#13151A] p-3 rounded-lg border border-[#2B2F36]">
                            <div className="text-xs text-gray-500 uppercase">PnL</div>
                            <div className={`text-lg font-mono font-bold ${transaction.pnl && transaction.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {transaction.pnl ? `$${transaction.pnl}` : '-'}
                            </div>
                        </div>
                    </div>

                    {/* Screenshot Area */}
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">Chart Screenshot URL</label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <ImageIcon className="absolute left-3 top-3 text-gray-500" size={16} />
                                <input
                                    type="text"
                                    value={screenshotUrl}
                                    onChange={(e) => setScreenshotUrl(e.target.value)}
                                    placeholder="https://..."
                                    className="w-full bg-[#13151A] border border-[#2B2F36] rounded-lg py-2 pl-10 pr-4 text-gray-200 focus:outline-none focus:border-blue-500 transition-colors"
                                />
                            </div>
                        </div>
                        {/* Preview */}
                        {(screenshotUrl || (transaction.screenshots && transaction.screenshots.length > 0)) && (
                            <div className="mt-4 rounded-lg overflow-hidden border border-[#2B2F36] aspect-video bg-[#13151A] flex items-center justify-center">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={screenshotUrl || transaction.screenshots?.[0]} alt="Chart" className="w-full h-full object-cover" />
                            </div>
                        )}
                    </div>

                    {/* Tags */}
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">Tags (comma separated)</label>
                        <input
                            type="text"
                            value={tags}
                            onChange={(e) => setTags(e.target.value)}
                            placeholder="Trend, Breakout, FOMO..."
                            className="w-full bg-[#13151A] border border-[#2B2F36] rounded-lg p-3 text-gray-200 focus:outline-none focus:border-blue-500 transition-colors"
                        />
                    </div>

                    {/* Notes */}
                    <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-400 mb-2">Trade Notes</label>
                        <div className="relative">
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Why did I take this trade? How did I feel?"
                                className="w-full h-32 bg-[#13151A] border border-[#2B2F36] rounded-lg p-3 pr-14 text-gray-200 focus:outline-none focus:border-blue-500 transition-colors resize-none"
                            />
                            <div className="absolute right-3 bottom-3">
                                <VoiceInputButton
                                    isListening={isListening}
                                    isTranscribing={isTranscribing}
                                    onClick={() => voiceSupported && toggleListening(notes)}
                                    disabled={!voiceSupported}
                                    title={voiceSupported ? (isListening ? "Stop recording" : "Record & transcribe") : "Voice not supported"}
                                    size="sm"
                                />
                            </div>
                        </div>
                        {voiceError && <p className="text-[10px] text-amber-400 mt-1">{voiceError}</p>}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-[#2B2F36] flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-[#2B2F36] transition-colors">
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg flex items-center gap-2 transition-colors"
                    >
                        <Save size={18} />
                        Save Entry
                    </button>
                </div>
            </div>
        </div>
    );
}
