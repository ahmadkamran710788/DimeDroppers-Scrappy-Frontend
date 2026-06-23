import axios, { AxiosRequestConfig, AxiosResponse } from "axios";
import toast from "react-hot-toast";
import { config } from "@/config";

const BASE_URL = config.apiUrl;

const apiCache = new Map<string, ApiResponse<unknown>>();

interface ApiCallParams {
  endpoint: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  data?: Record<string, unknown>;
  headers?: Record<string, string>;
  showSuccessToast?: boolean;
  successMessage?: string;
  // Bypass the in-memory GET cache (both read and write). Use for polling endpoints
  // whose value changes server-side between identical requests.
  skipCache?: boolean;
}

interface ApiResponse<T = unknown> {
  success: boolean;
  data: T | null;
  status: number | null;
  message: string;
}

const getCookie = (name: string) => {
  if (typeof document === "undefined") return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(";").shift();
  return null;
};

const formatBackendMessage = (msg: unknown): string => {
  if (!msg || typeof msg !== "string") return "";

  // Typically "fieldName: This value is already used."
  const colonIndex = msg.indexOf(": ");
  if (colonIndex > 0 && colonIndex < 30) {
    const field = msg.substring(0, colonIndex);
    let errorPart = msg.substring(colonIndex + 2);

    if (errorPart.toLowerCase().startsWith("this value")) {
      errorPart = `This ${field}` + errorPart.substring(10);
    }

    return errorPart.charAt(0).toUpperCase() + errorPart.slice(1);
  }

  return msg;
};

export default async function apiCall<T = unknown>({
  endpoint,
  method,
  data,
  headers,
  showSuccessToast = false,
  successMessage,
  skipCache = false,
}: ApiCallParams): Promise<ApiResponse<T>> {
  const cacheKey = `${method}:${endpoint}:${JSON.stringify(data || {})}`;

  if (method === "GET" && !skipCache && apiCache.has(cacheKey)) {
    return apiCache.get(cacheKey) as ApiResponse<T>;
  }

  try {
    const token = getCookie("authtoken");

    const axiosConfig: AxiosRequestConfig = {
      url: `${BASE_URL}${endpoint}`,
      method,
      headers: {
        "Content-Type": "application/ld+json",
        Accept: "application/ld+json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
    };

    if (data && ["POST", "PUT", "PATCH"].includes(method)) {
      axiosConfig.data = data;
    }

    if (data && method === "GET") {
      axiosConfig.params = data;
    }

    const response: AxiosResponse<T> = await axios(axiosConfig);

    if (showSuccessToast) {
      toast.success(successMessage || "Request successful");
    }

    const result = {
      success: true,
      data: response.data,
      status: response.status,
      message: successMessage || "Request successful",
    };

    // Cache successful GET requests (unless the caller opted out)
    if (method === "GET" && !skipCache) {
      apiCache.set(cacheKey, result);
    }
    // Clear cache on any mutation (create, update, delete) to ensure fresh data
    else if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
      apiCache.clear();
    }

    return result;
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const rawBackendMessage =
        error.response?.data?.violations?.[0]?.message ||
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.response?.data?.detail;

      const backendMessage = formatBackendMessage(rawBackendMessage);

      let errorMessage: string;

      switch (status) {
        case 400:
          errorMessage = "Invalid request. Please check your input.";
          break;
        case 401:
          errorMessage = "Session expired. Please login again.";
          break;
        case 403:
          errorMessage = "You don't have permission to perform this action.";
          break;
        case 404:
          errorMessage = "The requested resource was not found.";
          break;
        case 409:
          errorMessage = backendMessage || "This resource already exists.";
          break;
        case 422:
          errorMessage =
            backendMessage || "Validation failed. Please check your input.";
          break;
        case 429:
          errorMessage = "Too many requests. Please try again later.";
          break;
        case 500:
          errorMessage = "Something went wrong. Please try again later.";
          break;
        case 502:
        case 503:
        case 504:
          errorMessage =
            "Server is currently unavailable. Please try again later.";
          break;
        default:
          errorMessage = "Something went wrong. Please try again.";
      }

      toast.error(errorMessage);

      return {
        success: false,
        data: error.response?.data || null,
        status: status || null,
        message: errorMessage,
      };
    }

    if (error instanceof Error) {
      if (error.message === "Network Error") {
        toast.error("Please check your network and try again.");
        return {
          success: false,
          data: null,
          status: null,
          message: "Please check your network and try again.",
        };
      }

      toast.error("An unexpected error occurred. Please try again.");
      return {
        success: false,
        data: null,
        status: null,
        message: "An unexpected error occurred. Please try again.",
      };
    }

    toast.error("An unexpected error occurred. Please try again.");
    return {
      success: false,
      data: null,
      status: null,
      message: "An unexpected error occurred. Please try again.",
    };
  }
}
