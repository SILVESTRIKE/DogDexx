"use client";

import { useState } from "react";
import { HealthRecord } from "@/lib/types";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Syringe, Stethoscope, Pill, Activity, Trash2, Edit, Plus, Calendar, DollarSign, Scale, FileText, Image as ImageIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n-context";

interface HealthRecordListProps {
    dogId: string;
    records: HealthRecord[];
    onUpdate: () => void;
}

export function HealthRecordList({ dogId, records, onUpdate }: HealthRecordListProps) {
    const { t } = useI18n();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRecord, setEditingRecord] = useState<HealthRecord | null>(null);
    const [loading, setLoading] = useState(false);

    // Form State
    const [formData, setFormData] = useState<any>({
        type: "vaccine",
        title: "",
        date: new Date().toISOString().split('T')[0],
        nextDueDate: "",
        notes: "",
        vetName: "",
        cost: "",
        weight: "",
        symptoms: "",
        diagnosis: "",
    });
    const [files, setFiles] = useState<File[]>([]);

    const resetForm = () => {
        setFormData({
            type: "vaccine",
            title: "",
            date: new Date().toISOString().split('T')[0],
            nextDueDate: "",
            notes: "",
            vetName: "",
            cost: "",
            weight: "",
            symptoms: "",
            diagnosis: "",
        });
        setFiles([]);
        setEditingRecord(null);
    };

    const handleOpenInfo = (record?: HealthRecord) => {
        if (record) {
            setEditingRecord(record);
            setFormData({
                type: record.type,
                title: record.title,
                date: new Date(record.date).toISOString().split('T')[0],
                nextDueDate: record.nextDueDate ? new Date(record.nextDueDate).toISOString().split('T')[0] : "",
                notes: record.notes || "",
                vetName: record.vetName || "",
                cost: record.cost || "",
                weight: record.weight || "",
                symptoms: record.symptoms || "",
                diagnosis: record.diagnosis || "",
            });
        } else {
            resetForm();
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const dataToSubmit = {
                ...formData,
                cost: formData.cost ? Number(formData.cost) : undefined,
                weight: formData.weight ? Number(formData.weight) : undefined,
            };

            if (editingRecord) {
                // Update
                const updatePayload = {
                    ...dataToSubmit,
                    newAttachments: files // Pass new files
                };
                await apiClient.updateHealthRecord(editingRecord.id, updatePayload);
                toast.success(t("healthRecords.messages.updateSuccess"));
            } else {
                // Create
                const createPayload = {
                    ...dataToSubmit,
                    attachments: files // Pass files
                };
                await apiClient.addHealthRecord(dogId, createPayload);
                toast.success(t("healthRecords.messages.createSuccess"));
            }
            setIsModalOpen(false);
            resetForm();
            onUpdate();
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || t("healthRecords.messages.errorSave"));
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm(t("healthRecords.messages.confirmDelete"))) return;
        try {
            await apiClient.deleteHealthRecord(id);
            toast.success(t("healthRecords.messages.deleteSuccess"));
            onUpdate();
        } catch (error) {
            toast.error(t("healthRecords.messages.errorDelete"));
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'vaccine': return <Syringe className="h-5 w-5" />;
            case 'checkup': return <Stethoscope className="h-5 w-5" />;
            case 'medicine': return <Pill className="h-5 w-5" />;
            case 'hygiene': return <ImageIcon className="h-5 w-5" />; // Using Image icon as placeholder for Spa/Bath if needed, or find better
            default: return <Activity className="h-5 w-5" />;
        }
    };

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'vaccine': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
            case 'checkup': return 'bg-green-500/10 text-green-500 border-green-500/20';
            case 'medicine': return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
            case 'surgery': return 'bg-red-500/10 text-red-500 border-red-500/20';
            default: return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent">
                    {t("healthRecords.title")}
                </h2>
                <Button onClick={() => handleOpenInfo()} className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white shadow-lg shadow-blue-500/20">
                    <Plus className="mr-2 h-4 w-4" /> {t("healthRecords.addRecord")}
                </Button>
            </div>

            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingRecord ? t("healthRecords.editRecord") : t("healthRecords.addTitle")}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>{t("healthRecords.form.type")}</Label>
                                <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="vaccine">{t("healthRecords.types.vaccine")}</SelectItem>
                                        <SelectItem value="checkup">{t("healthRecords.types.checkup")}</SelectItem>
                                        <SelectItem value="medicine">{t("healthRecords.types.medicine")}</SelectItem>
                                        <SelectItem value="surgery">{t("healthRecords.types.surgery")}</SelectItem>
                                        <SelectItem value="hygiene">{t("healthRecords.types.hygiene")}</SelectItem>
                                        <SelectItem value="other">{t("healthRecords.types.other")}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>{t("healthRecords.form.date")}</Label>
                                <Input type="date" required value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>{t("healthRecords.form.title")}</Label>
                            <Input placeholder={t("healthRecords.form.titlePlaceholder")} required value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>{t("healthRecords.form.vet")}</Label>
                                <Input placeholder={t("healthRecords.form.vetPlaceholder")} value={formData.vetName} onChange={e => setFormData({ ...formData, vetName: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <Label>{t("healthRecords.form.nextDue")}</Label>
                                <Input type="date" value={formData.nextDueDate} onChange={e => setFormData({ ...formData, nextDueDate: e.target.value })} />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>{t("healthRecords.form.cost")}</Label>
                                <div className="relative">
                                    <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input className="pl-8" type="number" placeholder="0" value={formData.cost} onChange={e => setFormData({ ...formData, cost: e.target.value })} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>{t("healthRecords.form.weight")}</Label>
                                <div className="relative">
                                    <Scale className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input className="pl-8" type="number" placeholder="0.0" step="0.1" value={formData.weight} onChange={e => setFormData({ ...formData, weight: e.target.value })} />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>{t("healthRecords.form.symptoms")}</Label>
                            <Input placeholder={t("healthRecords.form.symptomsPlaceholder")} value={formData.symptoms} onChange={e => setFormData({ ...formData, symptoms: e.target.value })} />
                        </div>

                        <div className="space-y-2">
                            <Label>{t("healthRecords.form.diagnosis")}</Label>
                            <Input placeholder={t("healthRecords.form.diagnosisPlaceholder")} value={formData.diagnosis} onChange={e => setFormData({ ...formData, diagnosis: e.target.value })} />
                        </div>

                        <div className="space-y-2">
                            <Label>{t("healthRecords.form.notes")}</Label>
                            <Textarea placeholder={t("healthRecords.form.notesPlaceholder")} value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} />
                        </div>

                        <div className="space-y-2">
                            <Label>{t("healthRecords.form.attachments")}</Label>
                            <Input type="file" multiple onChange={(e) => setFiles(Array.from(e.target.files || []))} />
                            {editingRecord && editingRecord.attachments && editingRecord.attachments.length > 0 && (
                                <div className="mt-2 text-sm text-muted-foreground">
                                    <p>{t("healthRecords.form.currentAttachments")}</p>
                                    <div className="flex gap-2 mt-1">
                                        {editingRecord.attachments.map((url, idx) => (
                                            <a key={idx} href={url} target="_blank" className="text-blue-500 underline truncate max-w-[100px]" rel="noreferrer">
                                                Link {idx + 1}
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end gap-2 mt-4">
                            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>{t("healthRecords.form.cancel")}</Button>
                            <Button type="submit" disabled={loading}>
                                {loading ? t("healthRecords.form.saving") : editingRecord ? t("healthRecords.form.update") : t("healthRecords.form.save")}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            <div className="space-y-4">
                {records.length === 0 ? (
                    <Card className="bg-muted/10 border-dashed border-2 border-muted">
                        <CardContent className="py-12 flex flex-col items-center text-center text-muted-foreground">
                            <FileText className="h-12 w-12 mb-4 opacity-50" />
                            <p className="text-lg font-medium">{t("healthRecords.empty.title")}</p>
                            <p className="text-sm">{t("healthRecords.empty.description")}</p>
                        </CardContent>
                    </Card>
                ) : (
                    records.map((record) => (
                        <Card key={record.id} className="group relative overflow-hidden transition-all hover:shadow-md bg-white/5 border-white/10">
                            <div className={`absolute left-0 top-0 bottom-0 w-1 ${record.type === 'vaccine' ? 'bg-blue-500' : record.type === 'checkup' ? 'bg-green-500' : 'bg-gray-500'}`} />
                            <CardContent className="p-5 pl-7">
                                <div className="flex flex-col md:flex-row gap-4 justify-between items-start">
                                    <div className="flex gap-4">
                                        <div className={`p-3 rounded-xl h-fit ${getTypeColor(record.type)}`}>
                                            {getIcon(record.type)}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="font-bold text-lg">{record.title}</h3>
                                                <Badge variant="outline" className="capitalize text-xs">{record.type}</Badge>
                                            </div>

                                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground mb-2">
                                                <div className="flex items-center">
                                                    <Calendar className="h-3 w-3 mr-1" />
                                                    {new Date(record.date).toLocaleDateString()}
                                                </div>
                                                {record.vetName && (
                                                    <div className="flex items-center text-foreground/80">
                                                        {t("healthRecords.card.vetPrefix")} {record.vetName}
                                                    </div>
                                                )}
                                            </div>

                                            {(record.diagnosis || record.symptoms) && (
                                                <div className="bg-red-500/10 border border-red-500/20 rounded p-2 text-sm text-red-200 mb-2">
                                                    {record.diagnosis && <div><strong>{t("healthRecords.card.diagnosis")}</strong> {record.diagnosis}</div>}
                                                    {record.symptoms && <div><strong>{t("healthRecords.card.symptoms")}</strong> {record.symptoms}</div>}
                                                </div>
                                            )}

                                            {record.notes && (
                                                <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                                                    {record.notes}
                                                </p>
                                            )}

                                            {record.attachments && record.attachments.length > 0 && (
                                                <div className="flex gap-2 mt-3">
                                                    {record.attachments.map((url, idx) => (
                                                        <a key={idx} href={url} target="_blank" rel="noopener noreferrer">
                                                            <img src={url} alt="attachment" className="w-16 h-16 object-cover rounded border border-white/10 hover:opacity-80 transition-opacity" />
                                                        </a>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-end gap-2 text-sm pl-4 border-l border-white/5 min-w-[120px]">
                                        {record.cost && (
                                            <div className="font-mono font-medium text-emerald-400">
                                                {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(record.cost)}
                                            </div>
                                        )}
                                        {record.weight && (
                                            <div className="text-muted-foreground">
                                                {t("healthRecords.card.weight")} <span className="text-foreground">{record.weight} kg</span>
                                            </div>
                                        )}
                                        {record.nextDueDate && (
                                            <div className="text-amber-400 mt-2 text-right">
                                                <p className="text-xs uppercase tracking-wider opacity-70">{t("healthRecords.card.nextDue")}</p>
                                                <p className="font-semibold">{new Date(record.nextDueDate).toLocaleDateString()}</p>
                                            </div>
                                        )}

                                        <div className="flex gap-1 mt-auto pt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-400 hover:text-blue-300 hover:bg-blue-400/10" onClick={() => handleOpenInfo(record)}>
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button size="icon" variant="ghost" className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-400/10" onClick={() => handleDelete(record.id)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
        </div>
    );
}
