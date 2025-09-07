import { useState, useCallback, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { NavigationItem, NavigationState } from '../types/navigation.types';
import { navigationConfig, getBreadcrumbPath } from '../config/navigation.config';

export const useNavigation = () => {
  const location = useLocation();
  
  const [state, setState] = useState<NavigationState>({
    expandedItems: new Set<string>(),
    activeItem: null,
    searchQuery: '',
  });

  // Toggle expanded state za pojedinačnu stavku
  const toggleExpanded = useCallback((itemId: string) => {
    setState(prev => {
      const newExpanded = new Set(prev.expandedItems);
      if (newExpanded.has(itemId)) {
        newExpanded.delete(itemId);
      } else {
        newExpanded.add(itemId);
      }
      return { ...prev, expandedItems: newExpanded };
    });
  }, []);

  // Postavi aktivnu stavku
  const setActiveItem = useCallback((itemId: string | null) => {
    setState(prev => ({ ...prev, activeItem: itemId }));
  }, []);

  // Postavi search query
  const setSearchQuery = useCallback((query: string) => {
    setState(prev => ({ ...prev, searchQuery: query }));
  }, []);

  // Expand putanju do određene stavke
  const expandPath = useCallback((path: string[]) => {
    setState(prev => {
      const newExpanded = new Set(prev.expandedItems);
      path.forEach(id => newExpanded.add(id));
      return { ...prev, expandedItems: newExpanded };
    });
  }, []);

  // Collapse sve stavke
  const collapseAll = useCallback(() => {
    setState(prev => ({ ...prev, expandedItems: new Set() }));
  }, []);

  // Expand sve stavke
  const expandAll = useCallback(() => {
    const getAllIds = (items: NavigationItem[]): string[] => {
      const ids: string[] = [];
      items.forEach(item => {
        if (item.children && item.children.length > 0) {
          ids.push(item.id);
          ids.push(...getAllIds(item.children));
        }
      });
      return ids;
    };
    
    setState(prev => ({ 
      ...prev, 
      expandedItems: new Set(getAllIds(navigationConfig)) 
    }));
  }, []);

  // Auto-expand putanju do trenutne stranice
  useEffect(() => {
    const breadcrumbs = getBreadcrumbPath(location.pathname);
    if (breadcrumbs.length > 0) {
      const pathIds = breadcrumbs
        .slice(0, -1) // Ne expand poslednju stavku (trenutnu stranicu)
        .map(item => item.id);
      expandPath(pathIds);
      
      // Postavi aktivnu stavku
      const lastItem = breadcrumbs[breadcrumbs.length - 1];
      if (lastItem) {
        setActiveItem(lastItem.id);
      }
    }
  }, [location.pathname, expandPath, setActiveItem]);

  // Filter navigacije na osnovu search query
  const filterNavigation = useCallback((
    items: NavigationItem[], 
    query: string
  ): NavigationItem[] => {
    if (!query) return items;
    
    const lowerQuery = query.toLowerCase();
    
    return items.reduce((filtered: NavigationItem[], item) => {
      const matchesSearch = item.name.toLowerCase().includes(lowerQuery) ||
        item.description?.toLowerCase().includes(lowerQuery);
      
      let filteredChildren: NavigationItem[] = [];
      if (item.children) {
        filteredChildren = filterNavigation(item.children, query);
      }
      
      if (matchesSearch || filteredChildren.length > 0) {
        filtered.push({
          ...item,
          children: filteredChildren.length > 0 ? filteredChildren : item.children,
        });
      }
      
      return filtered;
    }, []);
  }, []);

  const filteredItems = filterNavigation(navigationConfig, state.searchQuery);

  return {
    items: filteredItems,
    state,
    toggleExpanded,
    setActiveItem,
    setSearchQuery,
    expandPath,
    collapseAll,
    expandAll,
  };
};