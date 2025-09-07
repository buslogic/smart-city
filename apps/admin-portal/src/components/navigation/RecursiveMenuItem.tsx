import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, ChevronDown, Circle } from 'lucide-react';
import { NavigationItem } from '../../types/navigation.types';
import { usePermissions } from '../../hooks/usePermissions';
import { Badge } from 'antd';

interface RecursiveMenuItemProps {
  item: NavigationItem;
  level: number;
  isDesktop?: boolean;
  onItemClick?: () => void;
  expandedItems: Set<string>;
  onToggleExpand: (itemId: string) => void;
}

const RecursiveMenuItem: React.FC<RecursiveMenuItemProps> = ({
  item,
  level,
  isDesktop = false,
  onItemClick,
  expandedItems,
  onToggleExpand,
}) => {
  const location = useLocation();
  const { hasPermission } = usePermissions();
  const [isExpanded, setIsExpanded] = useState(false);

  // Proveri permisije
  const hasAccess = !item.permissions || 
    item.permissions.length === 0 || 
    item.permissions.some(permission => hasPermission(permission));

  // Ako nema pristup, ne prikazuj stavku
  if (!hasAccess) return null;

  // Filtriraj decu na osnovu permisija
  const accessibleChildren = item.children?.filter(child => 
    !child.permissions || 
    child.permissions.length === 0 || 
    child.permissions.some(permission => hasPermission(permission))
  );

  const hasChildren = accessibleChildren && accessibleChildren.length > 0;
  const isActive = item.href === location.pathname;
  const isChildActive = accessibleChildren?.some(child => 
    child.href === location.pathname || 
    child.children?.some((grandchild: NavigationItem) => 
      grandchild.href === location.pathname
    )
  );

  useEffect(() => {
    setIsExpanded(expandedItems.has(item.id));
  }, [expandedItems, item.id]);

  // Auto-expand ako je child aktivan
  useEffect(() => {
    if (isChildActive && !expandedItems.has(item.id)) {
      onToggleExpand(item.id);
    }
  }, [isChildActive, item.id, expandedItems, onToggleExpand]);

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onToggleExpand(item.id);
  };

  // Računaj padding na osnovu nivoa
  const paddingLeft = isDesktop 
    ? `${level * 12}px` 
    : `${level * 16}px`;

  // Stilovi na osnovu stanja
  const getItemClassName = () => {
    const baseClasses = "group flex items-center w-full py-2 text-sm font-medium rounded-md transition-all duration-200";
    const hoverClasses = "hover:bg-gray-50 hover:text-gray-900";
    
    if (isActive) {
      return `${baseClasses} bg-blue-50 text-blue-700 ${hoverClasses}`;
    }
    if (isChildActive) {
      return `${baseClasses} bg-gray-50 text-gray-900 ${hoverClasses}`;
    }
    if (item.disabled) {
      return `${baseClasses} text-gray-400 cursor-not-allowed opacity-50`;
    }
    return `${baseClasses} text-gray-600 ${hoverClasses}`;
  };

  // Render ikone na osnovu nivoa i stanja
  const renderIcon = () => {
    if (!item.icon && level > 0) {
      return <Circle className="h-2 w-2 mr-3" />;
    }
    if (item.icon) {
      const Icon = item.icon;
      return <Icon className={`mr-3 h-${5 - Math.min(level, 2)} w-${5 - Math.min(level, 2)}`} />;
    }
    return null;
  };

  // Render expand/collapse ikone
  const renderExpandIcon = () => {
    if (!hasChildren) return null;
    
    return (
      <button
        onClick={handleToggle}
        className="ml-auto p-1 hover:bg-gray-200 rounded transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
      </button>
    );
  };

  // Render badge ako postoji
  const renderBadge = () => {
    if (!item.badge) return null;
    
    const colorMap = {
      red: '#ff4d4f',
      blue: '#1890ff',
      green: '#52c41a',
      yellow: '#faad14',
      gray: '#8c8c8c',
    };

    return (
      <Badge 
        count={item.badge.text} 
        style={{ 
          backgroundColor: colorMap[item.badge.color || 'blue'],
          marginLeft: 'auto',
          marginRight: hasChildren ? '8px' : '0'
        }}
      />
    );
  };

  // Render divider
  if (item.divider) {
    return (
      <div 
        className="my-2 border-t border-gray-200" 
        style={{ marginLeft: paddingLeft }}
      />
    );
  }

  const content = (
    <>
      <div className={getItemClassName()} style={{ paddingLeft }}>
        {renderIcon()}
        <span className="flex-1 truncate">{item.name}</span>
        {item.description && level === 0 && (
          <span className="ml-2 text-xs text-gray-500 truncate max-w-[100px]">
            {item.description}
          </span>
        )}
        {renderBadge()}
        {renderExpandIcon()}
      </div>
      
      {/* Render children rekurzivno */}
      {hasChildren && isExpanded && (
        <div className={`mt-1 ${level > 0 ? 'border-l border-gray-200 ml-4' : ''}`}>
          {accessibleChildren.map((child) => (
            <RecursiveMenuItem
              key={child.id}
              item={child}
              level={level + 1}
              isDesktop={isDesktop}
              onItemClick={onItemClick}
              expandedItems={expandedItems}
              onToggleExpand={onToggleExpand}
            />
          ))}
        </div>
      )}
    </>
  );

  // Ako ima href, wrap u Link
  if (item.href && !item.disabled && !hasChildren) {
    return (
      <Link
        to={item.href}
        onClick={onItemClick}
        className="block"
      >
        {content}
      </Link>
    );
  }

  // Ako ima decu ili je disabled, render kao div
  return <div className="block">{content}</div>;
};

export default RecursiveMenuItem;