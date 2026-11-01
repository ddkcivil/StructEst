import { MaterialRate, Project } from '../types';

export const DEFAULT_MATERIALS: MaterialRate[] = [];

export const BLANK_PROJECT: Project = {
  id: 'proj-' + Date.now(),
  name: 'New Construction Project',
  client: '',
  location: '',
  currency: 'NPR',
  fiscalYear: '2083/84',
  duration: '',
  companyName: '',
  companyAddress: '',
  preparedBy: '',
  checkedBy: '',
  approvedBy: '',
  standardWallHeight: 3.0,
  extWallThickness: 0.23,
  intWallThickness: 0.115,
  discountAmount: 0,
  measurementStandard: 'IS 1200 / Standard',
  wastageDefault: 5,
  vatPercent: 13,
  contingencyPercent: 5,
  items: [],
  createdAt: new Date().toISOString().split('T')[0]
};

export const INITIAL_PROJECTS: Project[] = [BLANK_PROJECT];
