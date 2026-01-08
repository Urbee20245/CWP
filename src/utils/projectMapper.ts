import { ensureArray } from './dataNormalization';

// --- DTO Definitions (Simplified for UI consumption) ---

export interface MessageDTO {
    id: string;
    body: string;
    sender_profile_id: string;
    created_at: string;
    profiles: { full_name: string };
}

export interface ThreadDTO {
    id: string;
    title: string;
    status: 'open' | 'closed' | 'archived';
    created_at: string;
    created_by: string;
    messages: MessageDTO[];
}

export interface TaskDTO {
    id: string;
    title: string;
    status: 'todo' | 'in_progress' | 'done' | 'blocked';
    due_date: string | null;
}

export interface MilestoneDTO {
    id: string;
    name: string;
    amount_cents: number;
    status: 'pending' | 'invoiced' | 'paid';
    order_index: number;
    stripe_invoice_id: string | null;
}

export interface FileItemDTO {
    id: string;
    file_name: string;
    file_type: string;
    file_size: number;
    storage_path: string;
    uploader_profile_id: string;
    created_at: string;
    profiles: { full_name: string };
}

export interface ProjectDTO {
    id: string;
    title: string;
    description: string;
    status: 'draft' | 'awaiting_deposit' | 'active' | 'paused' | 'completed';
    progress_percent: number;
    client_id: string;
    clients: { business_name: string };
    required_deposit_cents: number | null;
    deposit_paid: boolean;
    service_status: 'active' | 'paused' | 'awaiting_payment' | 'completed';
    sla_days: number | null;
    sla_start_date: string | null;
    sla_due_date: string | null;
    sla_status: 'on_track' | 'at_risk' | 'breached';
    sla_paused_at: string | null;
    sla_resume_offset_days: number;
    
    // Normalized Relations (Guaranteed Arrays)
    tasks: TaskDTO[];
    files: FileItemDTO[];
    milestones: MilestoneDTO[];
    threads: ThreadDTO[];
}

// --- Mapper Function ---

export function mapProjectDTO(rawProject: any): ProjectDTO {
    // Ensure rawProject is not null before proceeding
    if (!rawProject || !rawProject.id) {
        throw new Error("Invalid raw project data provided for mapping.");
    }

    // Normalize nested relations
    const rawThreads = ensureArray(rawProject.project_threads || rawProject.threads);
    
    const threads: ThreadDTO[] = rawThreads.map((thread: any) => ({
        ...thread,
        messages: ensureArray(thread.messages).map((msg: any) => ({
            ...msg,
            profiles: msg.profiles || { full_name: 'Unknown' }
        })),
    }));

    return {
        id: rawProject.id,
        title: rawProject.title || 'Untitled Project',
        description: rawProject.description || '',
        status: rawProject.status || 'draft',
        progress_percent: rawProject.progress_percent ?? 0,
        client_id: rawProject.client_id,
        clients: rawProject.clients || { business_name: 'N/A' },
        required_deposit_cents: rawProject.required_deposit_cents,
        deposit_paid: rawProject.deposit_paid ?? false,
        service_status: rawProject.service_status || 'onboarding',
        sla_days: rawProject.sla_days,
        sla_start_date: rawProject.sla_start_date,
        sla_due_date: rawProject.sla_due_date,
        sla_status: rawProject.sla_status || 'on_track',
        sla_paused_at: rawProject.sla_paused_at,
        sla_resume_offset_days: rawProject.sla_resume_offset_days ?? 0,

        // Normalized Arrays
        tasks: ensureArray(rawProject.tasks),
        files: ensureArray(rawProject.files).map((file: any) => ({
            ...file,
            profiles: file.profiles || { full_name: 'Unknown' }
        })),
        milestones: ensureArray(rawProject.milestones),
        threads: threads,
    };
}