import { z } from 'zod'

export const productSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(200),
  description: z.string().max(2000).optional().or(z.literal('')),
  sku: z.string().max(100).optional().or(z.literal('')),
  barcode: z.string().max(100).optional().or(z.literal('')),
  category_id: z.string().uuid().optional().or(z.literal('')),
  brand_id: z.string().uuid().optional().or(z.literal('')),

  cost_price: z.coerce.number().min(0, 'Custo não pode ser negativo'),
  sale_price: z.coerce.number().min(0, 'Preço não pode ser negativo'),
  min_price: z.coerce.number().min(0).optional(),

  min_stock: z.coerce.number().min(0, 'Estoque mínimo não pode ser negativo'),
  max_stock: z.coerce.number().min(0).optional(),
  unit: z.enum(['un', 'kg', 'lt', 'cx', 'm', 'g', 'ml', 'par']),

  is_active: z.boolean(),
  is_featured: z.boolean(),

  image_url: z.string().url().optional().or(z.literal('')),

  // Fiscal
  ncm:  z.string().regex(/^\d{8}$/, 'NCM deve ter 8 dígitos numéricos').optional().or(z.literal('')),
})

export type ProductFormValues = z.infer<typeof productSchema>

export const productFilterSchema = z.object({
  search: z.string().optional(),
  category_id: z.string().uuid().optional(),
  status: z.enum(['all', 'active', 'inactive']).default('active'),
  stock_status: z.enum(['all', 'ok', 'low', 'out']).default('all'),
  page: z.coerce.number().min(1).default(1),
  per_page: z.coerce.number().min(10).max(100).default(20),
  no_image: z.boolean().optional(),
  no_cost: z.boolean().optional(),
})

export type ProductFilterValues = z.infer<typeof productFilterSchema>
