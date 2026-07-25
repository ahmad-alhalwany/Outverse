import { apiFetch, apiFetchJson } from './api';

// Types
export interface Ad {
  id: number;
  campaign: number;
  campaign_name: string;
  creative: AdCreative;
  creative_id: number;
  status: string;
  targeting_override: Record<string, unknown>;
  impression_count: number;
  click_count: number;
  spend: number;
  ctr: number;
  cpc: number;
  cpm: number;
  created_at: string;
  updated_at: string;
  last_delivered_at: string | null;
}

export interface AdCreative {
  id: number;
  campaign: number;
  campaign_name: string;
  name: string;
  format: 'image' | 'carousel' | 'video' | 'story' | 'reel';
  status: string;
  media_urls: string[];
  aspect_ratio: string;
  headline: string;
  primary_text: string;
  description: string;
  cta_text: string;
  landing_url: string;
  utm_params: Record<string, string>;
  created_at: string;
  updated_at: string;
  reviewed_at: string | null;
}

export interface AdCampaign {
  id: number;
  advertiser: string;
  name: string;
  status: string;
  objective: string;
  bid_strategy: string;
  daily_budget: string;
  lifetime_budget: string;
  spent: string;
  start_date: string;
  end_date: string | null;
  targeting: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  is_active: boolean;
  daily_spend_limit_reached: boolean;
}

export interface AdImpressionResponse {
  success: boolean;
  impression_id: number;
  ad: Ad;
}

export interface AdClickResponse {
  success: boolean;
  click_id: number;
  redirect_url: string;
}

export interface AdReportSummary {
  total_spent: number;
  total_impressions: number;
  total_clicks: number;
  total_conversions: number;
  overall_ctr: number;
  by_campaign: Array<{
    campaign_id: number;
    name: string;
    status: string;
    impressions: number;
    clicks: number;
    conversions: number;
    spend: number;
    ctr: number;
    cpc: number;
  }>;
}

// Fetch ads for a campaign
export async function fetchAds(campaignId?: number): Promise<Ad[]> {
  try {
    const params = campaignId ? `?campaign=${campaignId}` : '';
    const res = await apiFetch(`ads/ads/${params}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : data.results || [];
  } catch {
    return [];
  }
}

// Create an ad
export async function createAd(data: {
  campaign: number;
  creative_id: number;
  status?: string;
  targeting_override?: Record<string, unknown>;
}): Promise<Ad | null> {
  try {
    const res = await apiFetchJson('ads/ads/', {
      method: 'POST',
      json: data,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// Update an ad
export async function updateAd(id: number, data: Partial<Ad>): Promise<Ad | null> {
  try {
    const res = await apiFetchJson(`ads/ads/${id}/`, {
      method: 'PATCH',
      json: data,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// Pause an ad
export async function pauseAd(id: number): Promise<Ad | null> {
  try {
    const res = await apiFetchJson(`ads/ads/${id}/pause/`, {
      method: 'POST',
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// Resume an ad
export async function resumeAd(id: number): Promise<Ad | null> {
  try {
    const res = await apiFetchJson(`ads/ads/${id}/resume/`, {
      method: 'POST',
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// Fetch campaigns
export async function fetchCampaigns(): Promise<AdCampaign[]> {
  try {
    const res = await apiFetch('ads/campaigns/');
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : data.results || [];
  } catch {
    return [];
  }
}

// Fetch a single campaign
export async function fetchCampaign(id: number): Promise<AdCampaign | null> {
  try {
    const res = await apiFetch(`ads/campaigns/${id}/`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export type CampaignPayload = {
  name: string;
  objective: string;
  bid_strategy: string;
  daily_budget: string;
  lifetime_budget: string;
  start_date: string;
  end_date?: string | null;
  targeting?: Record<string, unknown>;
};

// Create a campaign
export async function createCampaign(data: CampaignPayload): Promise<{ ok: boolean; data: AdCampaign | Record<string, unknown> }> {
  try {
    const res = await apiFetchJson('ads/campaigns/', {
      method: 'POST',
      json: data,
    });
    const body = await res.json().catch(() => ({}));
    return { ok: res.ok, data: body };
  } catch {
    return { ok: false, data: {} };
  }
}

// Update a campaign
export async function updateCampaign(id: number, data: Partial<CampaignPayload>): Promise<{ ok: boolean; data: AdCampaign | Record<string, unknown> }> {
  try {
    const res = await apiFetchJson(`ads/campaigns/${id}/`, {
      method: 'PATCH',
      json: data,
    });
    const body = await res.json().catch(() => ({}));
    return { ok: res.ok, data: body };
  } catch {
    return { ok: false, data: {} };
  }
}

// Pause a campaign
export async function pauseCampaign(id: number): Promise<AdCampaign | null> {
  try {
    const res = await apiFetchJson(`ads/campaigns/${id}/pause/`, { method: 'POST' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// Resume a campaign
export async function resumeCampaign(id: number): Promise<{ ok: boolean; data: AdCampaign | Record<string, unknown> }> {
  try {
    const res = await apiFetchJson(`ads/campaigns/${id}/resume/`, { method: 'POST' });
    const body = await res.json().catch(() => ({}));
    return { ok: res.ok, data: body };
  } catch {
    return { ok: false, data: {} };
  }
}

/** Activate a draft campaign (coin escrow billing). */
export async function activateCampaign(id: number): Promise<{ ok: boolean; data: AdCampaign | Record<string, unknown> }> {
  try {
    const res = await apiFetchJson(`ads/campaigns/${id}/activate/`, { method: 'POST' });
    const body = await res.json().catch(() => ({}));
    return { ok: res.ok, data: body };
  } catch {
    return { ok: false, data: {} };
  }
}

// Fetch per-campaign stats
export async function fetchCampaignStats(id: number): Promise<Record<string, unknown> | null> {
  try {
    const res = await apiFetch(`ads/campaigns/${id}/stats/`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// Fetch creatives for a campaign
export async function fetchCreatives(campaignId: number): Promise<AdCreative[]> {
  try {
    const res = await apiFetch(`ads/creatives/?campaign=${campaignId}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : data.results || [];
  } catch {
    return [];
  }
}

export type CreativePayload = {
  campaign: number;
  name: string;
  format: AdCreative['format'];
  media_urls: string[];
  aspect_ratio: string;
  headline: string;
  primary_text: string;
  description?: string;
  cta_text: string;
  landing_url: string;
  utm_params?: Record<string, string>;
};

// Create a creative
export async function createCreative(data: CreativePayload): Promise<{ ok: boolean; data: AdCreative | Record<string, unknown> }> {
  try {
    const res = await apiFetchJson('ads/creatives/', {
      method: 'POST',
      json: data,
    });
    const body = await res.json().catch(() => ({}));
    return { ok: res.ok, data: body };
  } catch {
    return { ok: false, data: {} };
  }
}

// Update a creative
export async function updateCreative(id: number, data: Partial<CreativePayload>): Promise<{ ok: boolean; data: AdCreative | Record<string, unknown> }> {
  try {
    const res = await apiFetchJson(`ads/creatives/${id}/`, {
      method: 'PATCH',
      json: data,
    });
    const body = await res.json().catch(() => ({}));
    return { ok: res.ok, data: body };
  } catch {
    return { ok: false, data: {} };
  }
}

// Log ad impression (public endpoint)
export async function logAdImpression(data: {
  ad_id: number;
  placement: string;
  session_id?: string;
  content_type?: string;
  content_id?: number;
}): Promise<AdImpressionResponse | null> {
  try {
    const res = await apiFetchJson('ads/delivery/impression/', {
      method: 'POST',
      json: data,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// Log ad click (public endpoint)
export async function logAdClick(data: {
  impression_id: number;
  landing_url?: string;
  referrer_url?: string;
}): Promise<AdClickResponse | null> {
  try {
    const res = await apiFetchJson('ads/delivery/click/', {
      method: 'POST',
      json: data,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// Fetch ad report summary (advertiser only)
export async function fetchAdReportSummary(): Promise<AdReportSummary | null> {
  try {
    const res = await apiFetch('ads/reports/');
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// Fetch campaign detail report
export async function fetchCampaignReport(campaignId: number): Promise<Record<string, unknown> | null> {
  try {
    const res = await apiFetch(`ads/reports/campaign_detail/?campaign_id=${campaignId}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}