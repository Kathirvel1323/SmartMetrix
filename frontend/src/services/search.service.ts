import { apiClient } from './api';

export interface SearchParams {
  query?: string;
  entityType?: string;
  status?: string;
  city?: string;
  page?: number;
  limit?: number;
}

export interface SearchResultItem {
  id: string;
  entityType: 'INSTRUMENT' | 'INSPECTION' | 'VERIFICATION' | 'CERTIFICATE' | 'NOTICE' | 'COMPLAINT';
  title: string;
  subtitle: string;
  status?: string;
  date?: string;
  details?: Record<string, any>;
}

export interface SearchResponse {
  results: SearchResultItem[];
  total: number;
  page: number;
  limit: number;
}

export const searchService = {
  async search(params: SearchParams): Promise<SearchResponse> {
    const entityMap: Record<string, string> = {
      INSTRUMENT: 'instruments',
      INSPECTION: 'inspections',
      VERIFICATION: 'verifications',
      CERTIFICATE: 'certificates',
      NOTICE: 'improvement-notices',
      COMPLAINT: 'complaints',
    };
    const response = await apiClient.get('/search', {
      params: {
        ...params,
        entityType: params.entityType ? entityMap[params.entityType] || params.entityType : undefined,
      },
    });
    const data = response.data?.data || {};
    const grouped = data.results || {};
    const results: SearchResultItem[] = [];

    const addResults = (items: any[] | undefined, entityType: SearchResultItem['entityType']) => {
      for (const item of items || []) {
        const id = item.instrumentId || item.inspectionId || item.requestId || item.certificateNumber || item.noticeId || item.complaintId || item._id;
        const title = item.instrumentId || item.inspectionId || item.requestId || item.certificateNumber || item.noticeId || item.complaintId || 'Record';
        const subtitle = item.manufacturer
          ? `${item.manufacturer} ${item.model || ''}`.trim()
          : item.category || item.verificationType || item.description || item.instrumentSnapshot?.manufacturer || 'SmartMetrix record';
        results.push({
          id: String(id),
          entityType,
          title: String(title),
          subtitle: String(subtitle),
          status: item.status || item.inspectorResult,
          date: item.createdAt || item.submittedAt || item.issuedAt || item.inspectedAt,
          details: item,
        });
      }
    };

    addResults(grouped.instruments, 'INSTRUMENT');
    addResults(grouped.inspections, 'INSPECTION');
    addResults(grouped.verifications, 'VERIFICATION');
    addResults(grouped.certificates, 'CERTIFICATE');
    addResults(grouped.improvementNotices, 'NOTICE');
    addResults(grouped.complaints, 'COMPLAINT');

    return {
      results,
      total: results.length,
      page: data.pagination?.page || params.page || 1,
      limit: data.pagination?.limit || params.limit || 20,
    };
  }
};
