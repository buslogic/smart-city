import { LucideIcon } from 'lucide-react';

export interface NavigationItem {
  id: string;
  name: string;
  icon?: LucideIcon;
  href?: string;
  badge?: {
    text: string;
    color?: 'red' | 'blue' | 'green' | 'yellow' | 'gray';
  };
  permissions?: string[];
  children?: NavigationItem[];
  isExpanded?: boolean;
  level?: number;
  parent?: string;
  description?: string;
  divider?: boolean;
  disabled?: boolean;
}

export interface NavigationState {
  expandedItems: Set<string>;
  activeItem: string | null;
  searchQuery: string;
}

export interface NavigationContextType {
  items: NavigationItem[];
  state: NavigationState;
  toggleExpanded: (itemId: string) => void;
  setActiveItem: (itemId: string) => void;
  setSearchQuery: (query: string) => void;
  expandPath: (path: string[]) => void;
  collapseAll: () => void;
  expandAll: () => void;
}