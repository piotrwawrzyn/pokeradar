export interface ApiError {
  error: string;
  details?: Array<{
    code?: string;
    message: string;
    path: string[];
  }>;
}
