export type Notes = {
    id: number;
    category_id: number;
    title: string;
    body: string;
    author_id: number;
    is_private: boolean;
    is_pinned: boolean;
    created_at: string;
    updated_at: string;
    deleted_at: string;
}

export type WaterSupplyNote = {
    id?: number;
    categoryId: string | number; // Format: "id | name" ili samo id
    title: string;
    body: string;
    authorId?: number;
    isPinned: number;
    isPrivate: number;
    createdAt?: string;
    updatedAt?: string;
}

export type NoteCategory = {
    id: number;
    name: string;
}