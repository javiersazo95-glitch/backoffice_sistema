export type AdTier = 'basica' | 'destacada' | 'premium' | 'empresarial';

export type AdModerationStatus = 'PENDIENTE' | 'APROBADO' | 'RECHAZADO';

export interface AdValidationItem {
  id: string;
  tier: AdTier | string;
  title: string;
  company: string;
  category: string;
  categoryLabel?: string;
  description: string;
  priceType?: string;
  priceText: string;
  priceValue?: number;
  region?: string;
  commune: string;
  address: string;
  phone: string;
  whatsapp?: string;
  openingHours?: string;
  rating?: number;
  reviewsCount?: number;
  images: string[];
  storyImages?: string[];
  features?: string[];
  servicesOffered?: string[];
  is24Hours?: boolean;
  hasOnlineBooking?: boolean;
  agendaConfig?: Record<string, any>;
  agendaConfigId?: string;
  agendaConfigName?: string;
  agendaHours?: string;
  ownerUserId?: string;
  ownerSellerId?: string;
  ownerEmail?: string;
  publishedAt: string;
  expiresAt: string;
  updatedAt?: string;
  moderationStatus?: AdModerationStatus;
  rejectionReason?: string;
  reviewedAt?: string;
  activo: boolean;
}
