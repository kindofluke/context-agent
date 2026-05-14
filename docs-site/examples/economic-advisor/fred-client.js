
export const fred = {
  apiKey: Deno.env.get('NL_PY_FRED_API_KEY'),
  
  async getSeries(seriesId, options = {}) {
    const baseUrl = 'https://api.stlouisfed.org/fred/series';
    const params = new URLSearchParams({
      api_key: this.apiKey,
      file_type: 'json',
      series_id: seriesId,
      ...options
    });
    
    const response = await fetch(`${baseUrl}?${params}`);
    return response.json();
  },
  
  async getObservations(seriesId, options = {}) {
    const baseUrl = 'https://api.stlouisfed.org/fred/series/observations';
    const params = new URLSearchParams({
      api_key: this.apiKey,
      file_type: 'json',
      series_id: seriesId,
      ...options
    });
    
    const response = await fetch(`${baseUrl}?${params}`);
    return response.json();
  },
  
  async searchSeries(searchText, options = {}) {
    const baseUrl = 'https://api.stlouisfed.org/fred/series/search';
    const params = new URLSearchParams({
      api_key: this.apiKey,
      file_type: 'json',
      search_text: searchText,
      ...options
    });
    
    const response = await fetch(`${baseUrl}?${params}`);
    return response.json();
  },
  
  async testConnection() {
    if (!this.apiKey) {
      return { connected: false, error: 'No API key configured' };
    }
    
    try {
      const data = await this.getObservations('GDP', { limit: 1 });
      if (data.status === 'invalid_api_key') {
        return { connected: false, error: 'Invalid API key' };
      }
      if (data.status === 'error') {
        return { connected: false, error: data.message };
      }
      return { 
        connected: true, 
        apiKey: this.apiKey.substring(0, 8) + '...',
        latestGDP: data.observations?.[data.observations.length - 1] 
      };
    } catch (error) {
      return { connected: false, error: error.message };
    }
  }
};
