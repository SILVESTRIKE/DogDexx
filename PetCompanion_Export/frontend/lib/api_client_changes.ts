// --- CHANGES FOR frontend/lib/api-client.ts ---

// Add these methods to the ApiClient class:

  // --- Dog Management ---
  async createDog(data: any) {
    return this.request<any>("/bff/dog", {
        method: "POST",
        body: JSON.stringify(data),
    }, true);
}

  async getMyDogs() {
    return this.request<any>("/bff/dog/my-dogs", {}, true);
}

  async getDog(id: string) {
    return this.request<any>(`/bff/dog/${id}`, {}, true);
}

  async updateDog(id: string, data: any) {
    return this.request<any>(`/bff/dog/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
    }, true);
}

  async deleteDog(id: string) {
    return this.request<any>(`/bff/dog/${id}`, {
        method: "DELETE",
    }, true);
}

  async addHealthRecord(dogId: string, data: any) {
    return this.request<any>(`/bff/dog/${dogId}/health`, {
        method: "POST",
        body: JSON.stringify(data),
    }, true);
}

  async getHealthRecords(dogId: string) {
    return this.request<any>(`/bff/dog/${dogId}/health`, {}, true);
}

  async searchLostDogs(params: any) {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value) queryParams.append(key, String(value));
    });
    return this.request<any>(`/bff/dog/search/lost?${queryParams.toString()}`, {}, false);
}
