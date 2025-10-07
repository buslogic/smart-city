import { fetchPostData } from './fetchUtil';

type Response = {
  success: boolean;
  msg: string;
  error?: string;
  data: any;
};

/**
 * Exports data as a CSV file by downloading it from the given endpoint.
 * @param endpoint - The API endpoint to fetch the CSV blob from.
 * @param filename - The name for the downloaded CSV file.
 */
export const exportCSV = async (endpoint: string, filename: string): Promise<void> => {
  try {
    const blob = await fetchPostData(endpoint, {}, 'blob');
    if (!(blob instanceof Blob)) {
      throw new Error('Failed to fetch CSV blob.');
    }
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('CSV export failed:', error);
  }
};

/**
 * Imports a CSV file by uploading it to the given endpoint.
 * @param e - The file input change event.
 * @param endpoint - The API endpoint to upload the CSV file to.
 * @returns The response from the server or null if no file was selected.
 */
export const importCSV = async (e: React.ChangeEvent<HTMLInputElement>, endpoint: string): Promise<Response | null> => {
  const file = e.target.files?.[0];
  if (!file) return null;

  const formData = new FormData();
  formData.append('csvFile', file);

  try {
    const data = await fetchPostData(endpoint, formData);
    return data;
  } catch (error) {
    console.error('CSV import failed:', error);
    return {
      success: false,
      msg: 'CSV import failed.',
      error: (error as Error).message,
      data: null,
    };
  } finally {
    e.target.value = '';
  }
};
