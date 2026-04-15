'use client';
import { getCategoryBg } from '@/lib/categoryColors';
import { CATEGORY_MAP } from '@/lib/categoryConstants';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Props {
  category?: string | null;
  subcategory?: string | null;
  confidence?: number | null;
  size?: 'sm' | 'default';
}

export function CategoryBadge({ category, subcategory, confidence, size = 'default' }: Props) {
  if (!category) return <Badge variant="outline" className="text-gray-500 border-gray-700">Uncategorised</Badge>;

  const catDef = CATEGORY_MAP[category];
  const subcatDef = catDef?.subcategories.find(s => s.slug === subcategory);
  const label = subcatDef?.label ?? catDef?.label ?? category;
  const isLowConf = confidence !== undefined && confidence !== null && confidence < 0.7;

  return (
    <Badge
      className={cn(
        getCategoryBg(category),
        'border-0 font-medium',
        size === 'sm' && 'text-xs px-1.5 py-0',
        isLowConf && 'ring-1 ring-yellow-400',
      )}
    >
      {label}
      {isLowConf && ' ⚠'}
    </Badge>
  );
}
