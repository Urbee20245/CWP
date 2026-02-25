"use client";

import React, { useState } from 'react';
import { Loader2, DollarSign, Plus, Trash2, AlertCircle } from 'lucide-react';
import { AdminService } from '../services/adminService';

interface BillingProduct {
  id: string;
  name: string;
  billing_type: 'one_time' | 'subscription';
  amount_cents: number;
  stripe_price_id: string;
}

interface InvoiceItem {
    description: string;
    amount: number; // USD
}

interface CreateInvoiceFormProps {
    clientId: string;
    oneTimeProducts: BillingProduct[];
    onInvoiceCreated: () => void;
    isProcessing: boolean;
    setIsProcessing: (isProcessing: boolean) => void;
}

const CreateInvoiceForm: React.FC<CreateInvoiceFormProps> = ({
    clientId,
    oneTimeProducts,
    onInvoiceCreated,
    isProcessing,
    setIsProcessing,
}) => {
    const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([{ description: '', amount: 0 }]);
    const [invoiceDueDate, setInvoiceDueDate] = useState('');
    const [selectedOneTimePriceId, setSelectedOneTimePriceId] = useState('');
    const [error, setError] = useState<string | null>(null);

    const handleAddInvoiceItem = () => {
        if (selectedOneTimePriceId) {
            const product = oneTimeProducts.find(p => p.stripe_price_id === selectedOneTimePriceId);
            if (product) {
                setInvoiceItems(prev => [...prev, { 
                    description: product.name, 
                    amount: product.amount_cents / 100 
                }]);
                setSelectedOneTimePriceId('');
            }
        } else {
            setInvoiceItems(prev => [...prev, { description: '', amount: 0 }]);
        }
    };

    const handleRemoveInvoiceItem = (index: number) => {
        setInvoiceItems(prev => prev.filter((_, i) => i !== index));
    };

    const handleInvoiceItemChange = (index: number, field: 'description' | 'amount', value: string | number) => {
        setInvoiceItems(prev => prev.map((item, i) => {
            if (i === index) {
                return { ...item, [field]: field === 'amount' ? parseFloat(value as string) || 0 : value };
            }
            return item;
        }));
    };

    const handleCreateInvoice = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsProcessing(true);

        const validItems = invoiceItems.filter(item => item.description.trim() && item.amount > 0);

        if (validItems.length === 0) {
            setError('Please add at least one valid line item with a description and amount.');
            setIsProcessing(false);
            return;
        }

        try {
            await AdminService.createInvoice(clientId, validItems, invoiceDueDate);
            
            alert('Invoice created and sent successfully!');
            setInvoiceItems([{ description: '', amount: 0 }]);
            setInvoiceDueDate('');
            onInvoiceCreated(); // Trigger parent refresh
        } catch (e: any) {
            console.error('Invoice creation error:', e);
            setError(e.message || 'Failed to create invoice.');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-5 py-3.5 flex items-center gap-2.5">
                <DollarSign className="w-4 h-4 text-rose-400" />
                <h2 className="text-xs font-bold text-white tracking-widest uppercase">Create One-Time Invoice</h2>
            </div>
            <div className="bg-white p-5">
                <form onSubmit={handleCreateInvoice} className="space-y-4">

                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
                            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                            {error}
                        </div>
                    )}

                    {/* Quick-add product selector */}
                    <div className="flex gap-2 items-center">
                        <select
                            value={selectedOneTimePriceId}
                            onChange={(e) => setSelectedOneTimePriceId(e.target.value)}
                            className="flex-1 p-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:border-indigo-400 outline-none disabled:opacity-40"
                            disabled={isProcessing}
                        >
                            <option value="">Quick-add a product...</option>
                            {oneTimeProducts.map(product => (
                                <option key={product.stripe_price_id} value={product.stripe_price_id}>
                                    {product.name} (${(product.amount_cents / 100).toFixed(2)})
                                </option>
                            ))}
                        </select>
                        <button
                            type="button"
                            onClick={handleAddInvoiceItem}
                            className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors disabled:opacity-40 flex-shrink-0"
                            disabled={isProcessing}
                        >
                            Add
                        </button>
                    </div>

                    {/* Line items */}
                    <div className="space-y-2">
                        {invoiceItems.map((item, index) => (
                            <div key={index} className="flex gap-2 items-center">
                                <input
                                    type="text"
                                    placeholder="Item description"
                                    value={item.description}
                                    onChange={(e) => handleInvoiceItemChange(index, 'description', e.target.value)}
                                    className="flex-1 p-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:border-indigo-400 outline-none"
                                    required
                                    disabled={isProcessing}
                                />
                                <div className="relative w-28 flex-shrink-0">
                                    <span className="absolute left-3 top-2.5 text-slate-400 text-sm">$</span>
                                    <input
                                        type="number"
                                        placeholder="0.00"
                                        value={item.amount || ''}
                                        onChange={(e) => handleInvoiceItemChange(index, 'amount', e.target.value)}
                                        className="w-full pl-7 pr-2 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:border-indigo-400 outline-none"
                                        required
                                        min="0.01"
                                        step="0.01"
                                        disabled={isProcessing}
                                    />
                                </div>
                                {invoiceItems.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveInvoiceItem(index)}
                                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40 flex-shrink-0"
                                        disabled={isProcessing}
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="flex items-center justify-between pt-1">
                        <button
                            type="button"
                            onClick={() => handleAddInvoiceItem()}
                            className="text-indigo-500 hover:text-indigo-700 text-xs font-bold flex items-center gap-1 disabled:opacity-40"
                            disabled={isProcessing}
                        >
                            <Plus className="w-3.5 h-3.5" /> Add Line Item
                        </button>
                        <div className="flex items-center gap-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Due</label>
                            <input
                                type="date"
                                value={invoiceDueDate}
                                onChange={(e) => setInvoiceDueDate(e.target.value)}
                                className="p-2 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:border-indigo-400 outline-none"
                                disabled={isProcessing}
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isProcessing || invoiceItems.length === 0 || invoiceItems.some(item => !item.description || item.amount <= 0)}
                        className="w-full py-2.5 bg-gradient-to-r from-rose-600 to-red-600 text-white rounded-xl text-xs font-bold hover:from-rose-700 hover:to-red-700 transition-all disabled:opacity-40 flex items-center justify-center gap-2 shadow-sm"
                    >
                        {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <DollarSign className="w-3.5 h-3.5" />}
                        Create & Send Invoice
                    </button>
                </form>
            </div>
        </div>
    );
};

export default CreateInvoiceForm;