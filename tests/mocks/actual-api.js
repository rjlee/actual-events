const api = {
  init: jest.fn(),
  downloadBudget: jest.fn(),
  sync: jest.fn(),
  shutdown: jest.fn(),
  getAccounts: jest.fn(),
  getTransactions: jest.fn(),
  getPayees: jest.fn(),
  getCategories: jest.fn(),
  getCategoryGroups: jest.fn(),
  getRules: jest.fn().mockResolvedValue([]),
};
module.exports = api;
