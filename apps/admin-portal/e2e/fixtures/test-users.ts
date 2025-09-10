/**
 * Test korisnici za različite role u sistemu
 */
export const testUsers = {
  superAdmin: {
    email: 'admin@smartcity.rs',
    password: 'Admin123!',
    role: 'SUPER_ADMIN',
    name: 'Test Admin'
  },
  cityManager: {
    email: 'manager@smartcity.rs',
    password: 'Manager123!',
    role: 'CITY_MANAGER',
    name: 'Test Manager'
  },
  operator: {
    email: 'operator@smartcity.rs',
    password: 'Operator123!',
    role: 'OPERATOR',
    name: 'Test Operator'
  },
  analyst: {
    email: 'analyst@smartcity.rs',
    password: 'Analyst123!',
    role: 'ANALYST',
    name: 'Test Analyst'
  },
  citizen: {
    email: 'citizen@smartcity.rs',
    password: 'Citizen123!',
    role: 'CITIZEN',
    name: 'Test Citizen'
  }
};

export const API_ENDPOINTS = {
  login: '/api/auth/login',
  logout: '/api/auth/logout',
  profile: '/api/auth/profile',
  users: '/api/users',
  permissions: '/api/permissions',
  roles: '/api/roles'
};