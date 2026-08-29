import axiosClient from "./axios-client";
import type { AxiosRequestConfig } from "axios";

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  errors?: Record<string, string[]>;
}

export const api = {
  get: async <T>(url: string, config?: AxiosRequestConfig): Promise<T> => {
    const response = await axiosClient.get<ApiResponse<T>>(url, config);
    return response.data.data;
  },

  post: async <T>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<T> => {
    const response = await axiosClient.post<ApiResponse<T>>(url, data, config);
    return response.data.data;
  },

  put: async <T>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<T> => {
    const response = await axiosClient.put<ApiResponse<T>>(url, data, config);
    return response.data.data;
  },

  patch: async <T>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<T> => {
    const response = await axiosClient.patch<ApiResponse<T>>(url, data, config);
    return response.data.data;
  },

  delete: async <T>(url: string, config?: AxiosRequestConfig): Promise<T> => {
    const response = await axiosClient.delete<ApiResponse<T>>(url, config);
    return response.data.data;
  },

  upload: async <T>(
    url: string,
    formData: FormData,
    config?: AxiosRequestConfig
  ): Promise<T> => {
    const response = await axiosClient.post<ApiResponse<T>>(url, formData, {
      ...config,
      headers: {
        ...(config?.headers ?? {}),
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data.data;
  },

  /** Download a file (e.g. CSV export) — returns a Blob */
  download: async (url: string, config?: AxiosRequestConfig): Promise<Blob> => {
    const response = await axiosClient.get(url, {
      ...config,
      responseType: "blob",
    });
    return response.data as Blob;
  },

  /** POST without unwrapping nested `data` — for endpoints that return flat responses (e.g. login) */
  rawPost: async <T>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<T> => {
    const response = await axiosClient.post<T>(url, data, config);
    return response.data;
  },

  /** DELETE without unwrapping nested `data` — for endpoints that answer flat. */
  rawDelete: async <T>(url: string, config?: AxiosRequestConfig): Promise<T> => {
    const response = await axiosClient.delete<T>(url, config);
    return response.data;
  },

  /** GET without unwrapping nested `data` — for endpoints that return a raw Laravel paginator ({data, links, meta}) instead of the {success, data, message} envelope */
  getRaw: async <T>(url: string, config?: AxiosRequestConfig): Promise<T> => {
    const response = await axiosClient.get<T>(url, config);
    return response.data;
  },
};
