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
        <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-slate-900 border-b border-slate-100 pb-4">
                <DollarSign className="w-5 h-5 text-red-600" /> Create One-Time Invoice
            </h2>
            <form onSubmit={handleCreateInvoice} className="space-y-4">
                
                {error && (
                    <div className="p-3 bg-red-100 border border-red-300 text-red-800 rounded-lg text-sm flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        {error}
                    </div>
                )}

                {/* Product Selector for quick add */}
                <div className="flex gap-3 items-center">
                    <select
                        value={selectedOneTimePriceId}
                        onChange={(e) => setSelectedOneTimePriceId(e.target.value)}
                        className="flex-1 p-2 border border-slate-300 rounded-lg text-sm"
                        disabled={isProcessing}
                    >
                        <option value="">Select a one-time product to add...</option>
                        {oneTimeProducts.map(product => (
                            <option key={product.stripe_price_id} value={product.stripe_price_id}>
                                {product.name} (${(product.amount_cents / 100).toFixed(2)})
                            </option>
                        ))}
                    </select>
                    <button type="button" onClick={handleAddInvoiceItem} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50" disabled={isProcessing}>
                        Add
                    </button>
                </div>
                
                {/* Manual Line Items */}
                {invoiceItems.map((item, index) => (
                    <div key={index} className="flex gap-3 items-center">
                        <input
                            type="text"
                            placeholder="Item Description"
                            value={item.description}
                            onChange={(e) => handleInvoiceItemChange(index, 'description', e.target.value)}
                            className="flex-1 p-2 border border-slate-300 rounded-lg text-sm"
                            required
                            disabled={isProcessing}
                        />
                        <div className="relative w-24">
                            <span className="absolute left-3 top-2.5 text-slate-500 text-sm">$</span>
                            <input
                                type="number"
                                placeholder="Amount"
                                value={item.amount || ''}
                                onChange={(e) => handleInvoiceItemChange(index, 'amount', e.target.value)}
                                className="w-full pl-6 pr-2 py-2 border border-slate-300 rounded-lg text-sm"
                                required
                                min="0.01"
                                step="0.01"
                                disabled={isProcessing}
                            />
                        </div>
                        {invoiceItems.length > 1 && (
                            <button type="button" onClick={() => handleRemoveInvoiceItem(index)} className="text-red-500 hover:text-red-700" disabled={isProcessing}>
                                <Trash2 className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                ))}
                <div className="flex justify-between">
                    <button type="button" onClick={() => handleAddInvoiceItem()} className="text-indigo-600 hover:text-indigo-800 text-sm font-medium flex items-center gap-1" disabled={isProcessing}>
                        <Plus className="w-4 h-4" /> Add Custom Line Item
                    </button>
                    <div className="flex items-center gap-2">
                        <label className="text-sm text-slate-600">Due Date:</label>
                        <input
                            type="date"
                            value={invoiceDueDate}
                            onChange={(e) => setInvoiceDueDate(e.target.value)}
                            className="p-2 border border-slate-300 rounded-lg text-sm"
                            disabled={isProcessing}
                        />
                    </div>
                </div>
                <button 
                    type="submit"
                    disabled={isProcessing || invoiceItems.length === 0 || invoiceItems.some(item => !item.description || item.amount <= 0)}
                    className="w-full py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <DollarSign className="w-5 h-5" />}
                    Create & Send Invoice
                </button>
            </form>
        </div>
    );
};

export default CreateInvoiceForm;