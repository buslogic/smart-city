import axios from 'axios';
import { TokenManager } from '../utils/token';
import { API_URL } from '../config/runtime';

const BASE_URL = `${API_URL}/api/linked-turnusi`;

export interface LinkedTurnus {
  id: number;
  lineNumber1: string;
  turnusId1: number;
  turnusName1: string;
  shiftNumber1: number;
  lineNumber2: string;
  turnusId2: number;
  turnusName2: string;
  shiftNumber2: number;
  description?: string;
  status: 'ACTIVE' | 'INACTIVE';
  validMonday: boolean;
  validTuesday: boolean;
  validWednesday: boolean;
  validThursday: boolean;
  validFriday: boolean;
  validSaturday: boolean;
  validSunday: boolean;
  createdBy: number;
  updatedBy?: number;
  createdAt: string;
  updatedAt: string;
  creator?: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
  };
  updater?: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
  };
}

export interface CreateLinkedTurnusDto {
  lineNumber1: string;
  turnusId1: number;
  turnusName1: string;
  shiftNumber1: number;
  lineNumber2: string;
  turnusId2: number;
  turnusName2: string;
  shiftNumber2: number;
  description?: string;
  status?: 'ACTIVE' | 'INACTIVE';
  validMonday?: boolean;
  validTuesday?: boolean;
  validWednesday?: boolean;
  validThursday?: boolean;
  validFriday?: boolean;
  validSaturday?: boolean;
  validSunday?: boolean;
}

export interface UpdateLinkedTurnusDto {
  lineNumber1?: string;
  turnusId1?: number;
  turnusName1?: string;
  shiftNumber1?: number;
  lineNumber2?: string;
  turnusId2?: number;
  turnusName2?: string;
  shiftNumber2?: number;
  description?: string;
  status?: 'ACTIVE' | 'INACTIVE';
  validMonday?: boolean;
  validTuesday?: boolean;
  validWednesday?: boolean;
  validThursday?: boolean;
  validFriday?: boolean;
  validSaturday?: boolean;
  validSunday?: boolean;
}

export interface QueryLinkedTurnusDto {
  lineNumber?: string;
  status?: 'ACTIVE' | 'INACTIVE';
}

class LinkedTurnusiService {
  private getAuthHeaders() {
    const token = TokenManager.getAccessToken();
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  async getAll(query?: QueryLinkedTurnusDto): Promise<LinkedTurnus[]> {
    const response = await axios.get<LinkedTurnus[]>(BASE_URL, {
      params: query,
      headers: this.getAuthHeaders(),
    });
    return response.data;
  }

  async getOne(id: number): Promise<LinkedTurnus> {
    const response = await axios.get<LinkedTurnus>(`${BASE_URL}/${id}`, {
      headers: this.getAuthHeaders(),
    });
    return response.data;
  }

  async create(data: CreateLinkedTurnusDto): Promise<LinkedTurnus> {
    const response = await axios.post<LinkedTurnus>(BASE_URL, data, {
      headers: this.getAuthHeaders(),
    });
    return response.data;
  }

  async update(id: number, data: UpdateLinkedTurnusDto): Promise<LinkedTurnus> {
    const response = await axios.put<LinkedTurnus>(`${BASE_URL}/${id}`, data, {
      headers: this.getAuthHeaders(),
    });
    return response.data;
  }

  async delete(id: number): Promise<{ success: boolean; message: string }> {
    const response = await axios.delete<{ success: boolean; message: string }>(
      `${BASE_URL}/${id}`,
      {
        headers: this.getAuthHeaders(),
      }
    );
    return response.data;
  }
}

export const linkedTurnusiService = new LinkedTurnusiService();
